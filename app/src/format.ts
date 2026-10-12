export function krw(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function labelForCategory(category: string): string {
  return (
    {
      silk: "실크",
      wide_hapji: "광폭 합지",
      narrow_hapji: "소폭 합지",
    }[category] ?? category
  );
}
