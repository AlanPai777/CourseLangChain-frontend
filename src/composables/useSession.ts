import { ref } from "vue";

/**
 * 對話 session 識別碼。
 *
 * 後端 `/api/ask?session_id=...` 用它當 LangGraph 的 thread_id:
 * 同一個 id 的多輪提問才共用上下文(追問「那第二門課的課綱?」要靠它)。
 *
 * 存在 sessionStorage 而非 localStorage —— 分頁關掉就消失,
 * 與後端刻意採用的 in-memory checkpointer 語意一致(對話不長期留存)。
 */
const STORAGE_KEY = "course-chat-session-id";

function newSessionId(): string {
  // crypto.randomUUID 需要安全上下文(https / localhost);沒有時退回時間戳 + 亂數
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function load(): string {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  const id = newSessionId();
  sessionStorage.setItem(STORAGE_KEY, id);
  return id;
}

// 模組層級的 ref:整個 app 共用同一個 session
const sessionId = ref<string>(load());

export function useSession() {
  /** 開一段新對話:換掉 id,後端那條 thread 的上下文就不再沿用。 */
  const resetSession = () => {
    const id = newSessionId();
    sessionStorage.setItem(STORAGE_KEY, id);
    sessionId.value = id;
  };

  return { sessionId, resetSession };
}
