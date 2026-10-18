/**
 * 政大 AI 助手後端(nccu-academic-rag 的 server.py)送來的進度與來源事件,轉成 camelCase 後在前端用的型別。
 * 事件格式的定義在後端的 rag/live/events.py 與 rag/live/sources.py,以及 docs/phase_j_live_fetch_plan.md 的 P8.2。
 */

/** 區塊裡的一列:一個被讀取的頁面/表單/人員頁。同一個 id 的 start → done 更新同一列。 */
interface ProgressRow {
  id: string;
  groupId: string;
  phase: "start" | "done";
  host: string;
  siteName: string;
  title: string;
  /** 空字串 = 內建固定資料,不是網頁,沒有連結可開 */
  url: string;
  /** pending|waiting|live_same|live_changed|live_new|snapshot_fallback|live_incomplete|discontinued|fixed_data|snapshot */
  state: string;
  label: string;
  time: string;
  checked: string | null;
  cached: boolean;
  ageMin: number | null;
  seconds: number | null;
  tlsUnverified: boolean;
  rowKind: string;
}

/** 動作區塊:一次工具動作(搜尋資料庫、比對關鍵字、讀取頁面、讀取表單、查詢聯絡人、抽取連結) */
interface ProgressGroup {
  type: "group";
  id: string;
  verb: string;
  title: string;
  phase: "start" | "done";
  seconds: number | null;
  rows: ProgressRow[];
}

/** 說明行:純文字,例如「判斷問題類型：辦理流程」 */
interface ProgressNote {
  type: "note";
  id: string;
  text: string;
}

type ProgressItem = ProgressGroup | ProgressNote;

interface SourceItem {
  title: string;
  kind: string;
  url: string;
  state: string;
  label: string;
  checked: string | null;
  time: string;
  cached: boolean;
  ageMin: number | null;
  tlsUnverified: boolean;
}

interface SourceGroup {
  host: string;
  name: string;
  items: SourceItem[];
}

interface SourcesPayload {
  live: boolean;
  snapshotDate: string;
  groups: SourceGroup[];
}

/** 每個串流開頭的 meta 事件:這題實際用不用現場、總開關有沒有開、資料庫的日期 */
interface ChatMeta {
  live: boolean;
  liveAvailable: boolean;
  snapshotDate: string;
}
