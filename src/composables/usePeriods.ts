/**
 * 節次與時間的對照 —— 與後端 `utils/time.py` 的 `timeChar` 保持一致。
 *
 * 後端 `getSessionArray` 的換算是 start = 6 + index、end = 7 + index,
 * 也就是節次 A 從 06:00 起算,每節一小時。這裡沿用同一套,避免前後端對不上。
 */
export const PERIODS = [
  "A", "B", "1", "2", "3", "4", "C", "D",
  "5", "6", "7", "8", "E", "F", "G", "H",
] as const;

export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

/** 節次 → index;不認得的字元回 -1。 */
export function periodIndex(period: string): number {
  return PERIODS.indexOf(period as (typeof PERIODS)[number]);
}

/** 節次的起始時刻,如 "3" → "10:00"。 */
export function periodStart(period: string): string {
  const i = periodIndex(period);
  return i < 0 ? "" : `${String(6 + i).padStart(2, "0")}:00`;
}

/** 節次的結束時刻,如 "3" → "11:00"。 */
export function periodEnd(period: string): string {
  const i = periodIndex(period);
  return i < 0 ? "" : `${String(7 + i).padStart(2, "0")}:00`;
}
