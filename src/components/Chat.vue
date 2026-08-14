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
        <span
          v-if="output.length === 0"
          class="loading loading-dots loading-md"
        ></span>
        <VueMarkdown v-else :source="output" class="overflow-auto" />
        <CourseCandidates v-if="candidates.length" :courses="candidates" />
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
    output.value = "An error occurred while attempting to connect.";
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
    if (output.value.length > 0) {
      emits("finish", {
        input: props.input,
        output: output.value,
        time: new Date(),
      });
    }
  }
});
</script>
