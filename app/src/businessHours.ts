const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 18 * 60;

export function businessStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  const isOpen = minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;
  return {
    isOpen,
    label: isOpen ? "영업 중 · 18:00에 영업 종료" : "영업 종료 · 09:00에 영업 시작",
  };
}
