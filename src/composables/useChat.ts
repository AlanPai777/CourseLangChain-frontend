import { computed, onUnmounted, ref } from "vue";

export interface UseChatOptions {
  input: string;
  sessionId: string;
  /** SSE 端點,預設打排課系統的 /api/ask。政大 AI 助手走不同 host,由呼叫端傳入絕對網址。 */
  endpoint?: string;
  onFinish?: (message: ChatMessage) => void;
  onError?: () => void;
}

/**
 * 開一條 SSE 對話串流:發問、吃 token、處理 status/courses 側通道與 error 欄位、
 * 維護等待狀態列的耗時計時器。
 *
 * Chat.vue(排課系統)與 AssistantChat.vue(政大 AI 助手)共用同一套邏輯——
 * 差別只在 endpoint,以及排課系統另外要理會 candidates(課程候選卡片側通道)。
 */
export function useChat(options: UseChatOptions) {
  const endpoint = options.endpoint ?? "/api/ask";

  const output = ref("");
  const canStop = ref(false);
  const outputError = ref(false);
  // 後端側通道送來的候選課程,渲染成「加入課表」卡片(course_id 未經 LLM 轉述)
  const candidates = ref<CourseCandidate[]>([]);

  // --- 等待狀態列 ---------------------------------------------------------
  const statusText = ref(""); // 後端 status 事件的最新一句;開始吐字後清掉
  // 累積版，給展開式「思考過程」面板用——跟 statusText 不同，不會被清掉，
  // 只會一直往後 push，讓使用者可以回頭看完整的搜尋過程（不是每支後端都會送
  // status 事件；空陣列時呼叫端應該直接不顯示面板）。
  const statusLog = ref<string[]>([]);
  const errorMessage = ref("");
  const errorDetail = ref("");
  // 使用者按下停止(或連線斷了)而且完全沒有輸出。要有明確收尾,
  // 否則畫面停在 loading dots,看起來還在跑。
  const aborted = ref(false);
  const finished = ref(false);
  const startedAt = Date.now();
  const startedAtText = new Date(startedAt).toLocaleTimeString();
  const elapsedMs = ref(0);

  let ticker: ReturnType<typeof setInterval> | undefined = setInterval(() => {
    elapsedMs.value = Date.now() - startedAt;
  }, 1000);

  /** 停錶並補記最後一次,否則畫面會定格在最後一次 tick(最多差 1 秒)。 */
  const stopTicker = () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
    elapsedMs.value = Date.now() - startedAt;
  };
  onUnmounted(stopTicker);

  const elapsedText = computed(() => {
    const total = Math.floor(elapsedMs.value / 1000);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return min ? `${min}m${String(sec).padStart(2, "0")}s` : `${sec}s`;
  });

  /** 現在在做什麼。工具執行中優先顯示工具的進度句,否則看有沒有開始吐字。 */
  const phase = computed(() => {
    if (statusText.value) return statusText.value;
    return output.value.length ? "正在整理回覆…" : "思考中…";
  });

  // 用 URLSearchParams 組 query:問題裡的 &、#、+、空白都會被正確編碼
  const query = new URLSearchParams({
    question: options.input,
    session_id: options.sessionId,
  });

  // 刻意不用 @vueuse/core 的 useEventSource:它把每則 SSE 訊息存進一個 Vue
  // ref 再靠 watch(data, ...) 分派——但 Vue 的 ref setter 會先做
  // hasChanged(newValue, oldValue) 檢查，兩則訊息的原始字串「完全相同」時會
  // 直接跳過、不觸發任何 watcher。逐 token 串流很容易連續兩個 token 剛好是
  // 同一個字元（例如分機號碼「62275」中間那兩個連續的 "2"），這時第二個
  // token 對應的 SSE payload 跟前一個逐位元組相同，會被 Vue 悄悄吞掉、永遠
  // 不會被加進 output——這正是分機號碼位數少一碼的成因（62275 顯示成
  // 6275）。改用原生 EventSource、在 onmessage callback 裡直接同步處理，
  // 每一則訊息都保證被處理恰好一次，不管內容是否跟前一則相同。
  let es: EventSource | null = null;
  let closed = false;

  const close = () => {
    if (closed) return; // 保證 onFinish 只呼叫一次,即使 close() 被多個路徑觸發
    closed = true;
    es?.close();
    es = null;
    canStop.value = false;
    finished.value = true;
    stopTicker();
    if (!output.value && !errorMessage.value) aborted.value = true;
    // 一律通知呼叫端。按下停止時 output 還是空的,也要 emit,
    // 否則呼叫端的 chatting 停在 true,輸入框再也解不開。
    options.onFinish?.({
      input: options.input,
      output: output.value,
      time: new Date(),
    });
  };

  const handleMessage = (value: string) => {
    if (!value) return;
    const payload = JSON.parse(value);
    // 側通道事件一律帶 type 且沒有 data 欄位。不認得的 type 必須在這裡就 return:
    // 否則 payload.data 是 undefined,會被下面的 += 串成字面上的 "undefined"。
    if (payload.type) {
      if (payload.type === "courses") {
        candidates.value.push(...(payload.courses ?? []));
      } else if (payload.type === "status") {
        statusText.value = payload.text ?? "";
        if (payload.text) statusLog.value.push(payload.text);
      } else if (payload.type === "reset") {
        // self_eval 判定剛才那份已經打完的答案不夠完整，後端要重新生成一份。
        // 已經打出來的字不是白費——搬進思考記錄留個痕跡，而不是憑空消失。
        statusLog.value.push("已產生初版答案，但 self_eval 判斷不完整，重新生成中");
        output.value = "";
      }
      return;
    }
    // 帶 error 的 payload 是後端的例外回報。刻意不併進 output。
    if (payload.error) {
      outputError.value = true;
      errorMessage.value = payload.data ?? "系統發生錯誤";
      errorDetail.value = String(payload.error);
      return;
    }
    const token = payload.data;
    if (token === "SPECIAL_END_TOKEN") close();
    else {
      // 開始吐字 = 上一個工具跑完了,狀態句該退場
      statusText.value = "";
      output.value += token;
    }
  };

  es = new EventSource(`${endpoint}?${query}`);
  es.onopen = () => {
    canStop.value = true;
  };
  es.onmessage = (e) => handleMessage(e.data);
  es.onerror = (err) => {
    if (closed) return; // 正常關閉(SPECIAL_END_TOKEN/使用者按停止)後瀏覽器可能還會多送一次 error,略過
    outputError.value = true;
    errorMessage.value = "連線中斷,無法取得回覆。";
    // EventSource 的錯誤事件不帶訊息(它是 Event 不是 Error),只能報事件型別。
    errorDetail.value = `EventSource 事件:${(err as Event).type}`;
    options.onError?.();
    close();
  };

  return {
    output,
    canStop,
    outputError,
    candidates,
    statusText,
    statusLog,
    errorMessage,
    errorDetail,
    aborted,
    finished,
    startedAtText,
    elapsedText,
    phase,
    close,
  };
}
