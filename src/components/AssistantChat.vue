<template>
  <div class="flex flex-col gap-4">
    <div class="turn-user">
      <div class="bubble-user">{{ input }}</div>
    </div>

    <!-- 助手回合:永遠 flex-column,思考區塊固定在答案上方,不套用 daisyUI 的
         .chat 三欄 grid ——那個 grid 只認 chat-image/chat-header/chat-bubble/
         chat-footer 四種具名格子,思考記錄一多行就會被 grid auto-placement
         排到旁邊格子,把答案泡泡擠出橫向捲軸。 -->
    <div class="assistant-turn">
      <div class="avatar placeholder turn-avatar">
        <div class="bg-success text-success-content rounded-full w-10">
          <span class="text-sm">B</span>
        </div>
      </div>

      <div class="turn-body">
        <div
          class="thinking-row"
          :class="{ 'is-done': finished, 'is-clickable': timeline.length }"
          role="button"
          tabindex="0"
          :aria-expanded="logExpanded"
          @click="timeline.length && toggleLog()"
          @keydown.enter="timeline.length && toggleLog()"
        >
          <template v-if="finished">
            <Icon icon="mingcute:check-line" class="h-4 w-4 thinking-check" />
            <span :title="`發問時間 ${startedAtText}`">{{ finishedText }}</span>
          </template>
          <template v-else>
            <span class="walker-bob">
              <svg class="walker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <g class="frame frame-a"><circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" /><path d="M12 8v6" /><path d="M12 9l-4 2" /><path d="M12 9l4 3" /><path d="M12 14l-3 6" /><path d="M12 14l3 5" /></g>
                <g class="frame frame-b"><circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" /><path d="M12 8v6" /><path d="M12 9l-4 3" /><path d="M12 9l4 2" /><path d="M12 14l-4 5" /><path d="M12 14l4 6" /></g>
              </svg>
            </span>
            <span class="thinking-phase">{{ phase }}</span>
            <span class="thinking-time">· {{ elapsedText }}</span>
          </template>
          <Icon
            v-if="timeline.length"
            :icon="logExpanded ? 'mingcute:up-line' : 'mingcute:down-line'"
            class="h-3 w-3 thinking-chevron"
          />
        </div>

        <!-- 進度清單(仿 Claude 的 Searched the web):時間順序混排說明行與動作區塊,區塊點開是頁面列,
             整列是連結。第一行(上面的膠囊)本身就是整個清單的收合開關。 -->
        <ProgressList v-if="timeline.length && logExpanded" :items="timeline" :logo-shape="logoShape" />

        <!-- 等太久才出現(後端 120/300 秒);開始吐字後就消失 -->
        <div v-if="slowNotice && !finished && output.length === 0" class="slow-notice" role="status">
          <Icon icon="mingcute:time-line" class="h-4 w-4" />
          <span>{{ slowNotice }}</span>
        </div>

        <div class="answer-bubble" :class="{ 'is-error': outputError }">
          <span v-if="aborted" class="text-sm opacity-70">已停止生成。</span>
          <span
            v-else-if="output.length === 0 && !finished"
            class="loading loading-dots loading-md"
          ></span>
          <VueMarkdown v-else :source="renderedOutput" :options="{ linkify: true }" class="answer-markdown" @click="openLinksInNewTab" />
          <div v-if="errorMessage" class="mt-2 text-sm">
            <p>{{ errorMessage }}</p>
            <details v-if="errorDetail" class="mt-1">
              <summary class="cursor-pointer text-xs opacity-70">技術細節</summary>
              <pre
                class="mt-1 text-xs whitespace-pre-wrap break-all opacity-80"
              >{{ errorDetail }}</pre>
            </details>
          </div>
        </div>

        <!-- 答案下方:來源按鈕(America.gov 式,點開是依網站分組的視窗)與「改用查現場重新查詢」 -->
        <div v-if="finished && !outputError && sourceCount > 0" class="answer-actions">
          <button type="button" class="sources-pill" @click="sourcesOpen = true">
            <span class="stack">
              <SiteLogo v-for="g in sources!.groups.slice(0, 3)" :key="g.host" :host="g.host === 'fixed' ? '' : g.host" :name="g.name" :shape="logoShape" />
            </span>
            <span>來源 {{ sourceCount }} 筆 · {{ sources!.groups.length }} 個網站</span>
          </button>
        </div>
        <div v-if="canRequeryLive" class="requery-bar">
          <Icon icon="mingcute:information-line" class="h-4 w-4" />
          <span class="grow">本題沒有查官網，答案來自資料庫（{{ dateText(meta!.snapshotDate) }}更新），之後官網可能已有變動。</span>
          <button type="button" class="requery-btn" @click="emits('requery', props.input)">改用「查現場」重新查詢</button>
        </div>
      </div>
    </div>

    <SourcesModal v-if="sources" :sources="sources" :open="sourcesOpen" :logo-shape="logoShape" @close="sourcesOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import VueMarkdown from "vue-markdown-render";
import { useChat } from "../composables/useChat";
import { ASSISTANT_ASK_URL } from "../config/assistant";
import ProgressList from "./ProgressList.vue";
import SourcesModal from "./SourcesModal.vue";
import SiteLogo from "./SiteLogo.vue";
import { dateText } from "../utils/progressStyle";

const props = defineProps<{
  input: string;
  sessionId: string;
  /** 這一題要不要查現場(前端開關);每題在建立時決定,之後切換開關不影響已經送出的題目 */
  live?: boolean;
  /** 後端總開關有沒有開(GET /config);關著就不提供「改用查現場重新查詢」 */
  liveAvailable?: boolean;
  logoShape?: "circle" | "square";
}>();
const emits = defineEmits<{
  (e: "finish", message: ChatMessage): void;
  (e: "error"): void;
  (e: "canstop", value: boolean): void;
  (e: "requery", question: string): void;
}>();

const {
  output,
  canStop,
  outputError,
  errorMessage,
  errorDetail,
  aborted,
  finished,
  startedAtText,
  elapsedText,
  phase,
  timeline,
  meta,
  sources,
  slowNotice,
  close,
} = useChat({
  input: props.input,
  sessionId: props.sessionId,
  endpoint: ASSISTANT_ASK_URL,
  live: props.live,
  onFinish: (message) => emits("finish", message),
  onError: () => emits("error"),
});

// 上面膠囊完成後的文字:知道這題實際有沒有查官網(後端的 meta 事件)就說清楚,不知道就只寫耗時
const finishedText = computed(() => {
  if (!meta.value) return `耗時 ${elapsedText.value}`;
  return meta.value.live ? `已查詢官網 · 耗時 ${elapsedText.value}` : `未查官網 · 使用資料庫 · 耗時 ${elapsedText.value}`;
});

// 後端偶爾會寫出 LaTeX 的箭頭($\rightarrow$),這裡換成真正的箭頭字元(純外觀)
const renderedOutput = computed(() => output.value.replace(/\$\\(?:rightarrow|to)\$/g, "→"));

// 答案裡的連結一律開新分頁,不要把正在看的對話換掉
const openLinksInNewTab = (e: MouseEvent) => {
  const a = (e.target as HTMLElement | null)?.closest("a");
  const href = a?.getAttribute("href");
  if (a && href && /^https?:/i.test(href)) {
    e.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  }
};

const sourcesOpen = ref(false);
const sourceCount = computed(() => (sources.value ? sources.value.groups.reduce((n, g) => n + g.items.length, 0) : 0));
// 關閉現場的題目,答案旁邊提供一鍵改用現場重查(後端總開關關著就不提供)
const canRequeryLive = computed(
  () => finished.value && !outputError.value && !!meta.value && meta.value.live === false && props.liveAvailable !== false && meta.value.liveAvailable
);

// 開始吐字後自動收合思考面板(呼應 claude.ai 的 Thinking 面板行為)，
// 但使用者手動展開/收合過就不再自動介入，尊重使用者的操作。
const logExpanded = ref(true);
const userToggledLog = ref(false);
const toggleLog = () => {
  logExpanded.value = !logExpanded.value;
  userToggledLog.value = true;
};
watch(output, (val) => {
  if (val.length > 0 && !userToggledLog.value) logExpanded.value = false;
});

// 停止鈕不再用 Teleport(踩過兩次目標元素時序坑,見 commit history)——
// 改成父層 AssistantApp.vue 自己畫按鈕,這裡只負責:(1) canStop 變動時
// 通知父層要不要顯示停止鈕,(2) 把 close 暴露出去讓父層按下時能呼叫。
watch(canStop, (val) => emits("canstop", val));
defineExpose({ stop: close });
</script>

<style scoped>
/* 這個元件仰賴父層 AssistantApp.vue 的 .assistant-theme 設定的 CSS 變數
   (--surface/--ink/--ink-soft/--ink-faint/--accent/--accent-soft/--line/--shadow) ——
   CSS 自訂屬性會穿過 Vue 的 scoped 邊界正常繼承,不需要在這裡重複定義。 */

.turn-user { display: flex; justify-content: flex-end; }
.bubble-user {
  background: var(--ink, #2a241d);
  color: var(--surface, #faf6ee);
  padding: 10px 14px;
  border-radius: 14px 14px 4px 14px;
  max-width: 80%;
  font-size: 19.5px; /* 14.5px * 1.35,使用者用 artifact 的字級滑桿確認過的倍率 */
}

.assistant-turn {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.turn-avatar { flex: none; }
.turn-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0; /* 讓這個 flex item 可以縮到比內容窄,markdown 才會換行
                   而不是撐開整列 —— 這是這次橫向捲軸 bug 的另一半成因,
                   flexbox 預設 min-width:auto 會用內容的最小寬度頂住。 */
}

.thinking-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  max-width: 100%;
  padding: 5px 10px 5px 8px;
  border-radius: 999px;
  background: var(--surface, #fff);
  border: 1px solid var(--line, #e6ddcc);
  font-size: 17px; /* 12.5px * 1.35 */
  color: var(--ink-soft, #746a5d);
  user-select: none;
}
.thinking-row.is-clickable { cursor: pointer; }
.thinking-row.is-clickable:hover { border-color: var(--accent, #8c2f39); }
.thinking-check { color: var(--accent, #8c2f39); }
.thinking-phase { color: var(--ink, #2a241d); }
.thinking-time { color: var(--ink-faint, #a89d8c); }
.thinking-chevron {
  display: inline-flex;
  color: var(--ink-faint, #a89d8c);
  transition: transform 0.15s ease;
}
.thinking-row[aria-expanded="true"] .thinking-chevron { transform: rotate(180deg); }

/* 不設 max-height/overflow-y —— log 有多長就長多長,交給 AssistantApp.vue
   的 scrollBox(它自己的 overflow-auto + 貼底自動捲動)去處理,不要在這裡
   另開一個獨立捲動的小視窗逼使用者自己滑。這樣「log 往下長、答案接著出現
   在下面」是同一條自然的頁面流。 */
.thinking-log {
  margin: 0 0 0 4px;
  padding: 2px 0 2px 14px;
  border-left: 2px solid var(--line, #e6ddcc);
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 16px; /* 12px * 1.35 */
  color: var(--ink-faint, #a89d8c);
  line-height: 1.5;
}

.slow-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f8ecd2;
  color: #7d5610;
  font-size: 16px;
}
.answer-actions { display: flex; align-items: center; gap: 8px; }
.sources-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px 5px 8px;
  border-radius: 999px;
  border: 1px solid var(--line, #e6ddcc);
  background: var(--surface, #fff);
  color: var(--ink, #2a241d);
  font-size: 15px;
  cursor: pointer;
}
.sources-pill:hover { border-color: var(--accent, #8c2f39); }
.sources-pill .stack { display: inline-flex; }
.sources-pill .stack :deep(.site-logo) { margin-right: -6px; border: 2px solid var(--surface, #fff); }
.requery-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #ece6da;
  color: #5e5546;
  font-size: 15px;
}
.requery-btn {
  flex: none;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--accent, #8c2f39);
  background: var(--surface, #fff);
  color: var(--accent, #8c2f39);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.requery-btn:hover { background: var(--accent-soft, #f3e3e0); }

.answer-bubble {
  background: var(--surface, #fff);
  border: 1px solid var(--line, #e6ddcc);
  border-radius: 14px 14px 14px 4px;
  padding: 16px 18px;
  font-size: 19.5px; /* 14.5px * 1.35 */
  color: var(--ink, #2a241d);
  box-shadow: var(--shadow, none);
  min-width: 0;
}
.answer-bubble.is-error { border-color: var(--accent, #8c2f39); background: var(--accent-soft, #f3e3e0); }
.answer-markdown { overflow-wrap: anywhere; }
.answer-markdown :deep(pre) { overflow-x: auto; }
.answer-markdown :deep(a) { color: var(--accent, #8c2f39); }
.answer-markdown :deep(p:first-child) { margin-top: 0; }
.answer-markdown :deep(p:last-child) { margin-bottom: 0; }

/* ---------- 走路圖示:兩幀交替 + 上下輕彈,讀作「正在走動查資料」 ---------- */
.walker { width: 16px; height: 16px; overflow: visible; }
.walker .frame { transform-origin: 12px 21px; }
.walker .frame-a { animation: walk-a 0.7s steps(1) infinite; }
.walker .frame-b { animation: walk-b 0.7s steps(1) infinite; }
.walker-bob { animation: bob 0.7s ease-in-out infinite; display: inline-flex; color: var(--accent, #8c2f39); }

@keyframes walk-a { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes walk-b { 0%, 49% { opacity: 0; } 50%, 100% { opacity: 1; } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }

@media (prefers-reduced-motion: reduce) {
  .walker .frame-a { animation: none; opacity: 1; }
  .walker .frame-b { animation: none; opacity: 0; }
  .walker-bob { animation: none; }
}
</style>
