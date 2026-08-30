<template>
  <div class="flex flex-col gap-4">
    <div class="chat chat-end">
      <div class="chat-bubble">{{ input }}</div>
    </div>
    <div class="chat chat-start">
      <div class="avatar placeholder self-end mr-1">
        <div class="bg-success text-success-content rounded-full w-10">
          <span class="text-sm">B</span>
        </div>
      </div>
      <!--
        等待狀態列。CPU-only 一題要數分鐘,只有 loading dots 的話使用者無從判斷
        是還在跑還是當掉了,所以這裡同時給「在做什麼」與「跑了多久」。
        文字來自後端的 status 事件(人話,不含工具名)。
      -->
      <div class="chat-header text-xs opacity-60 mb-1 flex items-center gap-1">
        <template v-if="finished">
          <Icon icon="mingcute:check-line" class="h-3 w-3" />
          <span :title="`發問時間 ${startedAtText}`">耗時 {{ elapsedText }}</span>
        </template>
        <template v-else>
          <span class="loading loading-spinner loading-xs"></span>
          <span>{{ phase }}</span>
          <span>· {{ elapsedText }}</span>
        </template>
      </div>
      <div class="chat-bubble" :class="{ 'chat-bubble-error': outputError }">
        <span v-if="aborted" class="text-sm opacity-70">已停止生成。</span>
        <span
          v-else-if="output.length === 0"
          class="loading loading-dots loading-md"
        ></span>
        <VueMarkdown v-else :source="output" class="overflow-auto" />
        <CourseCandidates v-if="candidates.length" :courses="candidates" />
        <!--
          錯誤獨立顯示,不進 markdown 串流。技術細節預設摺疊,但一定看得到 ——
          先前它被丟棄,畫面上只剩「系統發生錯誤」,連是哪個例外都不知道。
        -->
        <div v-if="errorMessage" class="mt-2 text-sm">
          <p>{{ errorMessage }}</p>
          <details v-if="errorDetail" class="mt-1">
            <summary class="cursor-pointer text-xs opacity-70">技術細節</summary>
            <pre
              class="mt-1 text-xs whitespace-pre-wrap break-all opacity-80"
            >{{ errorDetail }}</pre>
          </details>
        </div>
        <Teleport to="#StopGeneration">
          <button class="btn" @click="close" v-if="canStop">
            <Icon icon="mingcute:stop-line" class="w-4 h-4" />
            Stop Generate
          </button>
        </Teleport>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import { useEventSource } from "@vueuse/core";
import VueMarkdown from "vue-markdown-render";
import CourseCandidates from "./CourseCandidates.vue";

const props = defineProps<{
  input: string;
  sessionId: string;
}>();
const emits = defineEmits<{
  (e: "finish", message: ChatMessage): void;
  (e: "error"): void;
}>();

const output = ref("");
const canStop = ref(false);
const outputError = ref(false);
// 後端側通道送來的候選課程,渲染成「加入課表」卡片(course_id 未經 LLM 轉述)
const candidates = ref<CourseCandidate[]>([]);

// --- 等待狀態列 ---------------------------------------------------------
// 這個元件一掛載就發出請求(useEventSource 在 setup 就開始連),所以計時從這裡起算。
const statusText = ref(""); // 後端 status 事件的最新一句;開始吐字後清掉
// 後端 SSE 的 error 欄位。後端一直有送,但先前只讀 data 就丟掉了,導致所有故障
// 在畫面上都長成同一句「系統發生錯誤」,除錯得改用 curl 才看得到原文。
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
// (先前直接字串相接,含 & 的提問會被截斷成兩個參數)
const query = new URLSearchParams({
  question: props.input,
  session_id: props.sessionId,
});

const { status, data, error, close } = useEventSource(`/api/ask?${query}`);

watch(data, (value) => {
  if (!value) return;
  const payload = JSON.parse(value);
  // 側通道事件一律帶 type 且沒有 data 欄位。不認得的 type 必須在這裡就 return:
  // 否則 payload.data 是 undefined,會被下面的 += 串成字面上的 "undefined"。
  // (後端日後新增事件型別時,舊前端才不會在畫面上吐字。)
  if (payload.type) {
    if (payload.type === "courses") {
      candidates.value.push(...(payload.courses ?? []));
    } else if (payload.type === "status") {
      statusText.value = payload.text ?? "";
    }
    return;
  }
  // 帶 error 的 payload 是後端的例外回報。刻意不併進 output:
  // 模型可能正吐到一半的程式碼區塊裡,混進去會被夾在 ``` 內不換行而捲出畫面。
  if (payload.error) {
    outputError.value = true;
    errorMessage.value = payload.data ?? "系統發生錯誤";
    errorDetail.value = String(payload.error);
    return;
  }
  const token = payload.data;
  if (token === "SPECIAL_END_TOKEN") close();
  else {
    // 開始吐字 = 上一個工具跑完了,狀態句該退場,否則會停在「正在查詢課程…」
    statusText.value = "";
    output.value += token;
  }
});

watch(error, (err) => {
  if (err) {
    outputError.value = true;
    errorMessage.value = "連線中斷,無法取得回覆。";
    // EventSource 的錯誤事件不帶訊息(它是 Event 不是 Error),只能報事件型別。
    // 常見成因:後端逾時、被 proxy 切斷、或伺服器沒起來。
    errorDetail.value = `EventSource 事件:${err.type}`;
    // 不倚賴 close() 一定會把 status 推到 CLOSED,這裡就先停錶,免得計時器跑不停
    finished.value = true;
    stopTicker();
    emits("error");
    close();
  }
});

watch(status, (value) => {
  if (value === "OPEN") {
    canStop.value = true;
  } else if (value === "CLOSED") {
    close();
    canStop.value = false;
    finished.value = true;
    stopTicker();
    if (!output.value && !errorMessage.value) aborted.value = true;
    // 一律通知父層。先前只在「有輸出」時才 emit,導致按下停止(此時 output 還是空的)
    // 之後 App.vue 的 chatting 停在 true,輸入框再也解不開。
    emits("finish", {
      input: props.input,
      output: output.value,
      time: new Date(),
    });
  }
});
</script>
