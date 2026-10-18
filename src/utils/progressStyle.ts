/** 來源/頁面列的狀態 → 標籤顏色類別。文字永遠由後端的 label 提供,這裡只決定顏色,所以文字與顏色不會各說各話。 */
export function chipClass(state: string): string {
  switch (state) {
    case "live_same":
      return "chip-ok";
    case "live_changed":
    case "live_new":
      return "chip-changed";
    case "snapshot_fallback":
    case "live_incomplete":
    case "discontinued":
      return "chip-warn";
    case "pending":
    case "waiting":
      return "chip-pending";
    default: // snapshot、fixed_data
      return "chip-muted";
  }
}

/** "2026-08-19" → "8 月 19 日"(認不得就原樣回傳) */
export function dateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[2])} 月 ${Number(m[3])} 日` : iso || "";
}
