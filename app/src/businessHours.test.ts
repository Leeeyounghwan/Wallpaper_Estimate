import { describe, expect, it } from "vitest";
import { businessStatus } from "./businessHours";

describe("businessStatus", () => {
  it("opens from 09:00 to before 18:00 in Korea time", () => {
    expect(businessStatus(new Date("2026-10-12T00:00:00.000Z")).isOpen).toBe(true);
    expect(businessStatus(new Date("2026-10-12T08:59:00.000Z")).isOpen).toBe(true);
    expect(businessStatus(new Date("2026-10-12T09:00:00.000Z")).isOpen).toBe(false);
  });
});
