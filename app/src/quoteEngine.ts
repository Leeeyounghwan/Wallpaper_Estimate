import type {
  AreaType,
  Crew,
  LaborGrade,
  Material,
  MissingCode,
  MissingField,
  QuoteInput,
  QuoteResult,
  QuoteRules,
  RuleEntries,
} from "./types";

const LABOR_GRADES: LaborGrade[] = ["helper", "intermediate", "expert"];

export function formatMissingField(issue: MissingField): string {
  const labels: Record<MissingCode, string> = {
    INVALID_INPUT: "입력값이 올바르지 않습니다.",
    MISSING_MATERIAL_SELECTION: "벽지 제품 선택 또는 등록",
    MISSING_WALLPAPER_USAGE: "벽지 실제 사용량 기준",
    MISSING_LABOR_CREW: "시공 인원 기준",
    UNSUPPORTED_AREA_REVERSE_MAPPING: "전용 면적의 평형 역환산 기준",
    MISSING_FLOORING_MATERIAL_PRICE: "장판 자재 단가",
    MISSING_FLOORING_USAGE: "장판 실제 사용량 기준",
    MISSING_FLOORING_LABOR: "장판 시공 인원/노무 기준",
  };
  return `${labels[issue.code]}: ${issue.field}`;
}

export function quote(input: QuoteInput, rules: QuoteRules): QuoteResult {
  const issues: MissingField[] = [];
  const addMissing = (code: MissingCode, field: string) => {
    if (!issues.some((item) => item.code === code)) {
      issues.push({ code, field });
    }
  };

  if (!["apartment", "villa", "officetel", "house", "other"].includes(input.building_type)) {
    addMissing("INVALID_INPUT", "등록된 건물 유형이 아닙니다.");
  }
  if (!["평형", "전용"].includes(input.area_type) || !Number.isInteger(input.area_pyeong) || input.area_pyeong <= 0) {
    addMissing("INVALID_INPUT", "면적 타입 또는 면적이 올바르지 않습니다.");
  }

  const material = rules.materials.find((item) => item.id === input.material_id && item.active !== false);
  if (!material) {
    addMissing("MISSING_MATERIAL_SELECTION", "벽지 제품 선택/등록");
  }

  let actualUsage: number | null = null;
  let crew: Crew | null = null;
  let resolvedKind: AreaType | null = null;
  let resolvedArea: number | null = null;

  if (material && !issues.some((item) => item.code === "INVALID_INPUT")) {
    const usageRecord = lookupRule(rules.wallpaper_usage, material.category);
    const laborRecord = lookupRule(rules.labor_requirements, material.category);
    const requiredKind = usageRecord?.area_type ?? laborRecord?.area_type ?? null;

    if (!requiredKind) {
      addMissing("MISSING_WALLPAPER_USAGE", "해당 벽지 종류 사용량 기준표");
      addMissing("MISSING_LABOR_CREW", "해당 벽지 종류 시공 인원표");
    } else if (input.area_type === requiredKind) {
      resolvedKind = input.area_type;
      resolvedArea = input.area_pyeong;
    } else if (input.area_type === "평형" && requiredKind === "전용") {
      resolvedKind = "전용";
      resolvedArea = convertPyeongToExclusive(input.area_pyeong, rules);
      if (!resolvedArea || resolvedArea <= 0) {
        addMissing("INVALID_INPUT", "평형→전용 계산 결과가 0 이하입니다.");
      }
    } else {
      addMissing("UNSUPPORTED_AREA_REVERSE_MAPPING", "전용→평형 역환산 기준 미등록");
    }

    if (resolvedKind && resolvedArea && !issues.some((item) => item.code === "INVALID_INPUT")) {
      actualUsage = lookupEntry(usageRecord, resolvedArea);
      crew = lookupEntry(laborRecord, resolvedArea);
      if (actualUsage == null) {
        addMissing("MISSING_WALLPAPER_USAGE", `${resolvedKind} ${resolvedArea}평 실제 벽지 사용량`);
      }
      if (crew == null) {
        addMissing("MISSING_LABOR_CREW", `${resolvedKind} ${resolvedArea}평 시공 인원`);
      }
    }
  }

  if (input.include_flooring) {
    const thickness = input.flooring_thickness ?? rules.policies.flooring_default_thickness;
    const flooring = rules.flooring_materials.find((item) => item.thickness === thickness);
    if (!flooring || flooring.retail_krw == null) {
      addMissing("MISSING_FLOORING_MATERIAL_PRICE", `${thickness} 장판 자재 단가`);
    }
    if (rules.flooring_usage == null) {
      addMissing("MISSING_FLOORING_USAGE", "장판 실사용 및 구매량 산정 기준");
    }
    if (rules.flooring_labor_requirements == null) {
      addMissing("MISSING_FLOORING_LABOR", "장판 시공 인원/시공비 기준");
    }
  }

  const baseResult: QuoteResult = {
    status: issues.length ? "missing_data" : "quoted",
    dataset_version: rules.dataset_version,
    building_type: input.building_type,
    input_area_kind: input.area_type,
    input_area_pyeong: input.area_pyeong,
    resolved_area_kind: resolvedKind,
    resolved_area_pyeong: resolvedArea,
    material_id: input.material_id,
    amount_krw: null,
    reference_cost_total_krw: null,
    vat_status: "unconfigured",
    missing_fields: issues,
    calculation: null,
    notice: rules.customer_notice,
    lineItems: [],
    sourceVersion: rules.dataset_version,
  };

  if (issues.length) {
    return baseResult;
  }

  if (!material || actualUsage == null || !crew) {
    return baseResult;
  }

  assertPositiveInt(actualUsage, "벽지 사용량");
  assertPositiveInt(material.purchase_unit_pyeong, "구매단위");
  assertPositiveInt(material.retail_krw, "소매 단가");
  assertNonNegativeInt(material.supplies_krw_per_actual_pyeong, "부자재 단가");

  const purchaseUnits = ceilDiv(actualUsage, material.purchase_unit_pyeong);
  const materialRetail = purchaseUnits * material.retail_krw;
  const materialWholesale = material.wholesale_krw == null ? null : purchaseUnits * material.wholesale_krw;
  const supplies = actualUsage * material.supplies_krw_per_actual_pyeong;
  const laborLines = Object.fromEntries(
    LABOR_GRADES.map((grade) => [grade, (crew[grade] ?? 0) * rules.daily_labor_rates_krw[grade]]),
  ) as Record<LaborGrade, number>;
  const labor = LABOR_GRADES.reduce((sum, grade) => sum + laborLines[grade], 0);
  const amount = materialRetail + supplies + labor;

  return {
    ...baseResult,
    status: "quoted",
    amount_krw: amount,
    reference_cost_total_krw: materialWholesale == null ? null : materialWholesale + supplies + labor,
    calculation: {
      actual_usage_pyeong: actualUsage,
      purchase_units: purchaseUnits,
      purchase_applied_pyeong: purchaseUnits * material.purchase_unit_pyeong,
      material_unit_label: material.unit_label ?? `${material.purchase_unit_pyeong}평 단위`,
      material_wholesale_krw: materialWholesale,
      material_retail_krw: materialRetail,
      supplies_krw: supplies,
      labor_crew: crew,
      labor_lines_krw: laborLines,
      labor_krw: labor,
      extra_costs_included: false,
    },
    lineItems: [
      { label: "벽지 소매 자재비", amount_krw: materialRetail },
      { label: "부자재비", amount_krw: supplies },
      { label: "시공비", amount_krw: labor },
    ],
  };
}

function lookupRule<T>(records: RuleEntries<T>[], category: Material["category"]): RuleEntries<T> | undefined {
  return records.find((row) => row.category === category);
}

function lookupEntry<T>(record: RuleEntries<T> | undefined, area: number): T | null {
  return record?.entries[String(area)] ?? null;
}

function convertPyeongToExclusive(area: number, rules: QuoteRules): number {
  return rules.area_conversion.explicit_table[String(area)] ?? area - rules.area_conversion.fallback.value_pyeong;
}

function ceilDiv(numerator: number, denominator: number): number {
  assertPositiveInt(numerator, "구매 계산 사용량");
  assertPositiveInt(denominator, "구매 계산 단위");
  return Math.ceil(numerator / denominator);
}

function assertPositiveInt(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label}은 양의 정수여야 합니다.`);
  }
}

function assertNonNegativeInt(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
  }
}
