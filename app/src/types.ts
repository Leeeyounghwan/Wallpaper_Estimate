export type BuildingType = "apartment" | "villa" | "officetel" | "house" | "other";
export type AreaType = "평형" | "전용";
export type MaterialCategory = "silk" | "wide_hapji" | "narrow_hapji";
export type LaborGrade = "helper" | "intermediate" | "expert";
export type QuoteStatus = "quoted" | "missing_data";

export type MissingCode =
  | "INVALID_INPUT"
  | "MISSING_MATERIAL_SELECTION"
  | "MISSING_WALLPAPER_USAGE"
  | "MISSING_LABOR_CREW"
  | "UNSUPPORTED_AREA_REVERSE_MAPPING"
  | "MISSING_FLOORING_MATERIAL_PRICE"
  | "MISSING_FLOORING_USAGE"
  | "MISSING_FLOORING_LABOR";

export interface Material {
  id: string | null;
  category: MaterialCategory;
  brand: string | null;
  name: string | null;
  purchase_unit_pyeong: number | null;
  unit_label?: string | null;
  retail_krw: number | null;
  wholesale_krw?: number | null;
  supplies_krw_per_actual_pyeong: number | null;
  supplies_included_in_retail?: boolean;
  active?: boolean;
}

export interface FlooringMaterial {
  id: string | null;
  thickness: string;
  brand: string | null;
  name: string | null;
  purchase_unit_pyeong: number | null;
  retail_krw: number | null;
  wholesale_krw?: number | null;
  supplies_krw_per_actual_pyeong: number | null;
}

export interface RuleEntries<T> {
  category: MaterialCategory;
  area_type: AreaType;
  entries: Record<string, T | null>;
  building_scope: "generic" | string;
}

export interface Crew {
  helper: number;
  intermediate: number;
  expert: number;
}

export interface QuoteRules {
  schema_version: string;
  dataset_version: string;
  locale: string;
  currency: "KRW";
  policies: {
    vat_calculation: unknown;
    vat_notice: string;
    default_product_id: string | null;
    flooring_default_thickness: string;
    labor_duration_note: string;
    [key: string]: unknown;
  };
  area_conversion: {
    source_area_type: AreaType;
    target_area_type: AreaType;
    explicit_table: Record<string, number>;
    fallback: { type: "subtract_constant"; value_pyeong: number };
    reverse_automatic: boolean;
  };
  materials: Material[];
  flooring_materials: FlooringMaterial[];
  wallpaper_usage: RuleEntries<number>[];
  labor_requirements: RuleEntries<Crew>[];
  daily_labor_rates_krw: Record<LaborGrade, number>;
  flooring_usage: unknown;
  flooring_labor_requirements: unknown;
  catalogs: Catalog[];
  customer_notice: string;
  not_registered?: string[];
  visibility?: string;
}

export interface Catalog {
  id: string;
  name: string;
  brand: string | null;
  product_relation: string | null;
  url: string;
  verification: string;
  active?: boolean;
}

export interface QuoteInput {
  building_type: BuildingType;
  area_type: AreaType;
  area_pyeong: number;
  material_id: string | null;
  include_flooring?: boolean;
  flooring_thickness?: string;
}

export interface MissingField {
  code: MissingCode;
  field: string;
}

export interface QuoteCalculation {
  actual_usage_pyeong: number;
  purchase_units: number;
  purchase_applied_pyeong: number;
  material_unit_label: string;
  material_wholesale_krw: number | null;
  material_retail_krw: number;
  supplies_krw: number;
  labor_crew: Crew;
  labor_lines_krw: Record<LaborGrade, number>;
  labor_krw: number;
  extra_costs_included: false;
}

export interface QuoteResult {
  status: QuoteStatus;
  dataset_version: string;
  building_type: BuildingType;
  input_area_kind: AreaType;
  input_area_pyeong: number;
  resolved_area_kind: AreaType | null;
  resolved_area_pyeong: number | null;
  material_id: string | null;
  amount_krw: number | null;
  reference_cost_total_krw: number | null;
  vat_status: "unconfigured";
  missing_fields: MissingField[];
  calculation: QuoteCalculation | null;
  notice: string;
  lineItems: Array<{ label: string; amount_krw: number; internal?: boolean }>;
  sourceVersion: string;
}

export interface StoredState {
  rules: QuoteRules;
  history: AuditEvent[];
  quotes: QuoteSnapshot[];
  settings: StoreSettings;
}

export interface StoreSettings {
  shopName: string;
  contactText: string;
  managerName: string;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  reason?: string;
  version: string;
}

export interface QuoteSnapshot {
  id: string;
  createdAt: string;
  input: QuoteInput;
  result: QuoteResult;
  furniture: string[];
  preferredDates: string[];
  datasetVersion: string;
  inquiryDate?: string;
  customerPhone?: string;
  siteAddress?: string;
  memo?: string;
}
