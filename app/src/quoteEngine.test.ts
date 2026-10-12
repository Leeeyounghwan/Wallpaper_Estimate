import { describe, expect, it } from "vitest";
import rules from "./data/retail_rules.example.json";
import { quote } from "./quoteEngine";
import type { QuoteInput, QuoteRules } from "./types";

const quoteRules = rules as unknown as QuoteRules;

const cases: Array<{
  id: string;
  input: QuoteInput;
  expectedStatus: "quoted" | "missing_data";
  expectedAmount: number | null;
  expectedMissingCodes: string[];
  expectedCalculation?: Partial<{
    actual_usage_pyeong: number;
    purchase_units: number;
    material_retail_krw: number;
    supplies_krw: number;
    labor_krw: number;
  }>;
}> = [
  {
    id: "villa17_narrow",
    input: { building_type: "villa", area_type: "전용", area_pyeong: 17, material_id: "SHINHAN_FEINHEIM" },
    expectedStatus: "quoted",
    expectedAmount: 912000,
    expectedMissingCodes: [],
    expectedCalculation: {
      actual_usage_pyeong: 60,
      purchase_units: 2,
      material_retail_krw: 352000,
      supplies_krw: 0,
      labor_krw: 560000,
    },
  },
  {
    id: "apartment24_silk_sketch",
    input: { building_type: "apartment", area_type: "평형", area_pyeong: 24, material_id: "SHINHAN_SKETCH" },
    expectedStatus: "quoted",
    expectedAmount: 1860000,
    expectedMissingCodes: [],
    expectedCalculation: {
      actual_usage_pyeong: 60,
      purchase_units: 12,
      material_retail_krw: 600000,
      supplies_krw: 240000,
      labor_krw: 1020000,
    },
  },
  {
    id: "apartment24_wide_iris",
    input: { building_type: "apartment", area_type: "평형", area_pyeong: 24, material_id: "SHINHAN_IRIS" },
    expectedStatus: "quoted",
    expectedAmount: 1100000,
    expectedMissingCodes: [],
    expectedCalculation: {
      actual_usage_pyeong: 60,
      purchase_units: 12,
      material_retail_krw: 360000,
      supplies_krw: 180000,
      labor_krw: 560000,
    },
  },
  {
    id: "villa16_narrow_missing",
    input: { building_type: "villa", area_type: "전용", area_pyeong: 16, material_id: "SHINHAN_FEINHEIM" },
    expectedStatus: "missing_data",
    expectedAmount: null,
    expectedMissingCodes: ["MISSING_WALLPAPER_USAGE", "MISSING_LABOR_CREW"],
  },
  {
    id: "villa17_silk_no_reverse",
    input: { building_type: "villa", area_type: "전용", area_pyeong: 17, material_id: "SHINHAN_SKETCH" },
    expectedStatus: "missing_data",
    expectedAmount: null,
    expectedMissingCodes: ["UNSUPPORTED_AREA_REVERSE_MAPPING"],
  },
  {
    id: "apartment24_flooring_missing",
    input: {
      building_type: "apartment",
      area_type: "평형",
      area_pyeong: 24,
      material_id: "SHINHAN_SKETCH",
      include_flooring: true,
    },
    expectedStatus: "missing_data",
    expectedAmount: null,
    expectedMissingCodes: ["MISSING_FLOORING_USAGE", "MISSING_FLOORING_LABOR"],
  },
  {
    id: "missing_product_choice",
    input: { building_type: "apartment", area_type: "평형", area_pyeong: 24, material_id: null },
    expectedStatus: "missing_data",
    expectedAmount: null,
    expectedMissingCodes: ["MISSING_MATERIAL_SELECTION"],
  },
];

describe("quote", () => {
  it.each(cases)("matches the registered rule scenario: $id", (testCase) => {
    const result = quote(testCase.input, quoteRules);

    expect(result.status).toBe(testCase.expectedStatus);
    expect(result.amount_krw).toBe(testCase.expectedAmount);
    expect(result.missing_fields.map((item) => item.code)).toEqual(testCase.expectedMissingCodes);

    if (testCase.expectedCalculation) {
      expect(result.calculation).toMatchObject(testCase.expectedCalculation);
    }
  });

  it("does not expose wholesale values when using the public retail dataset", () => {
    const result = quote(
      { building_type: "apartment", area_type: "평형", area_pyeong: 24, material_id: "SHINHAN_SKETCH" },
      quoteRules,
    );

    expect(result.calculation?.material_wholesale_krw).toBeNull();
    expect(result.reference_cost_total_krw).toBeNull();
  });
});
