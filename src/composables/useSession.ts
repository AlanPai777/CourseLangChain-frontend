import { ref, Ref } from "vue";

/**
 * 對話 session 識別碼。
 *
 * 後端 `/api/ask?session_id=...` 用它當 LangGraph 的 thread_id:
 * 同一個 id 的多輪提問才共用上下文(追問「那第二門課的課綱?」要靠它)。
 *
 * 存在 sessionStorage 而非 localStorage —— 分頁關掉就消失,
 * 與後端刻意採用的 in-memory checkpointer 語意一致(對話不長期留存)。
 *
 * 依 namespace 分流:排課系統與政大 AI 助手是兩個不同後端(不同 LangGraph graph),
 * 共用同一個 session_id 會讓後端把兩邊的對話誤認成同一條 thread。
 */
export type SessionNamespace = "schedule" | "assistant";

const STORAGE_PREFIX = "course-chat-session-id";

function newSessionId(): string {
  // crypto.randomUUID 需要安全上下文(https / localhost);沒有時退回時間戳 + 亂數
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageKey(namespace: SessionNamespace): string {
  return `${STORAGE_PREFIX}:${namespace}`;
}

function load(namespace: SessionNamespace): string {
  const key = storageKey(namespace);
  const saved = sessionStorage.getItem(key);
  if (saved) return saved;
  const id = newSessionId();
  sessionStorage.setItem(key, id);
  return id;
}

// namespace 各自一個模組層級 ref,同一個 namespace 在整個 app 共用同一個 session
const sessionRefs = new Map<SessionNamespace, Ref<string>>();

function getSessionRef(namespace: SessionNamespace): Ref<string> {
  let sessionId = sessionRefs.get(namespace);
  if (!sessionId) {
    sessionId = ref(load(namespace));
    sessionRefs.set(namespace, sessionId);
  }
  return sessionId;
}

export function useSession(namespace: SessionNamespace = "schedule") {
  const sessionId = getSessionRef(namespace);

  /** 開一段新對話:換掉 id,後端那條 thread 的上下文就不再沿用。 */
  const resetSession = () => {
    const id = newSessionId();
    sessionStorage.setItem(storageKey(namespace), id);
    sessionId.value = id;
  };

  return { sessionId, resetSession };
}
