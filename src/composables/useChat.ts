import { computed, onUnmounted, ref } from "vue";

export interface UseChatOptions {
  input: string;
  sessionId: string;
  /** SSE 端點,預設打排課系統的 /api/ask。政大 AI 助手走不同 host,由呼叫端傳入絕對網址。 */
  endpoint?: string;
  /** 政大 AI 助手的「查現場」開關:有給才會在網址加 live=on|off(排課系統不傳,後端行為不變) */
  live?: boolean;
  onFinish?: (message: ChatMessage) => void;
  onError?: () => void;
}

/** 動作區塊標題前的動詞:後端 step 事件的 verb → 畫面上的字 */
export const VERB_LABEL: Record<string, string> = {
  search: "搜尋資料庫",
  grep: "比對關鍵字",
  page: "讀取頁面",
  form: "讀取表單",
  contacts: "查詢聯絡人",
  links: "抽取連結",
};

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

  // --- 進度清單(政大 AI 助手)---------------------------------------------
  // 依到達順序混排「說明行」(status 事件)與「動作區塊」(step 事件 kind=group),
  // 區塊底下的頁面列(kind=row)依 group_id 歸屬、依 id 更新。排課系統的後端不送 step/
  // meta/sources/slow,這些保持空的,Chat.vue 不受影響。
  const timeline = ref<ProgressItem[]>([]);
  const meta = ref<ChatMeta | null>(null);
  const sources = ref<SourcesPayload | null>(null);
  const slowNotice = ref("");
  let seq = 0;
  const nextId = () => `n${++seq}`;

  const pushNote = (text: string) => {
    const last = timeline.value[timeline.value.length - 1];
    if (last && last.type === "note" && last.text === text) return; // 連續重複的說明行略過
    timeline.value.push({ type: "note", id: nextId(), text });
  };

  const findGroup = (id: string): ProgressGroup | undefined =>
    timeline.value.find((i): i is ProgressGroup => i.type === "group" && i.id === id);

  const applyStep = (p: any) => {
    if (p.kind === "group") {
      const g = findGroup(p.id);
      if (!g) {
        timeline.value.push({ type: "group", id: p.id, verb: p.verb, title: p.title, phase: p.phase, seconds: p.seconds ?? null, rows: [] });
      } else {
        g.title = p.title;
        g.phase = p.phase;
        g.seconds = p.seconds ?? null;
      }
    } else if (p.kind === "row") {
      const g = findGroup(p.group_id);
      if (!g) return; // 屬於不認得的區塊(理論上不會發生):略過,不要讓整個串流壞掉
      const row: ProgressRow = {
        id: p.id, groupId: p.group_id, phase: p.phase, host: p.host ?? "", siteName: p.site_name ?? "", title: p.title ?? "",
        url: p.url ?? "", state: p.state ?? "snapshot", label: p.label ?? "", time: p.time ?? "", checked: p.checked ?? null,
        cached: !!p.cached, ageMin: p.age_min ?? null, seconds: p.seconds ?? null, tlsUnverified: !!p.tls_unverified, rowKind: p.row_kind ?? "page",
      };
      const i = g.rows.findIndex((r) => r.id === row.id);
      if (i >= 0) g.rows[i] = row;
      else g.rows.push(row);
    }
  };
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

  /** 現在在做什麼。開始吐字就是整理回覆;否則看清單最後一項(跑到一半的區塊優先),再退回舊的 status 句。 */
  const phase = computed(() => {
    if (output.value.length) return "正在整理回覆…";
    const last = timeline.value[timeline.value.length - 1];
    if (last && last.type === "group" && last.phase === "start") return `${VERB_LABEL[last.verb] ?? last.verb}：${last.title}`;
    if (last && last.type === "note") return last.text;
    if (statusText.value) return statusText.value;
    return "思考中…";
  });

  // 用 URLSearchParams 組 query:問題裡的 &、#、+、空白都會被正確編碼
  const query = new URLSearchParams({
    question: options.input,
    session_id: options.sessionId,
  });
  // 一律明確傳 live:後端沒收到參數時預設是「只看 LIVE_FETCH」(沒設就不查),前端開關的預設「開」要靠這裡傳出去
  if (options.live !== undefined) query.set("live", options.live ? "on" : "off");

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
        if (payload.text) {
          statusLog.value.push(payload.text);
          pushNote(payload.text);
        }
      } else if (payload.type === "meta") {
        meta.value = { live: !!payload.live, liveAvailable: payload.live_available !== false, snapshotDate: payload.snapshot_date ?? "" };
      } else if (payload.type === "step") {
        applyStep(payload);
      } else if (payload.type === "sources") {
        sources.value = { live: !!payload.live, snapshotDate: payload.snapshot_date ?? "", groups: (payload.groups ?? []).map((g: any) => ({
          host: g.host, name: g.name,
          items: (g.items ?? []).map((it: any) => ({
            title: it.title, kind: it.kind, url: it.url ?? "", state: it.state, label: it.label, checked: it.checked ?? null, time: it.time ?? "",
            cached: !!it.cached, ageMin: it.age_min ?? null, tlsUnverified: !!it.tls_unverified,
          })),
        })) };
      } else if (payload.type === "slow") {
        slowNotice.value = payload.text ?? "";
      } else if (payload.type === "reset") {
        // self_eval 判定剛才那份已經打完的答案不夠完整，後端要重新生成一份。
        // 已經打出來的字不是白費——搬進思考記錄留個痕跡，而不是憑空消失。
        statusLog.value.push("已產生初版答案，但 self_eval 判斷不完整，重新生成中");
        pushNote("答案不夠完整，重新生成");
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
      slowNotice.value = ""; // 等待提示只在還沒有答案時有意義
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
    timeline,
    meta,
    sources,
    slowNotice,
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
