<template>
  <div class="assistant-theme h-full flex flex-col">
    <NavBar
      title="政大 AI 助手"
      :switch-to="{ to: '/schedule', label: '切換至排課系統' }"
      :hide-theme="true"
      @delete="startNewChat"
    />

    <!-- 空狀態:置中窄卡片,呼應 Claude 官方介面「還沒開始對話時聚焦在輸入」的版面,
         跟下面對話中的寬版面刻意用不同的 max-width(--empty-w vs --thread-w)。 -->
    <div v-if="history.length === 0" class="grow flex items-center justify-center overflow-auto px-4">
      <div class="empty-wrap">
        <h1 class="empty-title">問我政大生活的任何問題。</h1>
        <form class="composer" @submit="chat">
          <input
            :disabled="chatting"
            type="text"
            v-model="input"
            placeholder="例如:目前政治大學的校長是誰?"
            class="composer-input"
          />
          <div class="composer-row">
            <span class="composer-hint">
              Enter 送出 · 按住
              <Icon icon="mingcute:mic-fill" class="h-3 w-3 inline-icon" />
              麥克風輸入語音
            </span>
            <div class="composer-actions">
              <label for="assistant-upload-empty">
                <div class="composer-icon-btn" :class="{ 'is-disabled': chatting }">
                  <Icon icon="mingcute:mic-fill" class="h-5 w-5" />
                </div>
                <input
                  id="assistant-upload-empty"
                  type="file"
                  accept="audio/*"
                  @change.prevent="handleUpload"
                  :disabled="chatting"
                  capture
                  hidden
                />
              </label>
              <button class="composer-send" type="submit" :disabled="chatting">
                <Icon icon="mingcute:arrow-up-line" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- 對話中:寬版面,訊息清單 + 底部固定輸入框,跟原本邏輯完全一樣,
         只多包了 max-width 容器讓內容置中對齊 --thread-w。 -->
    <div v-else class="grow flex flex-col p-2 gap-2 overflow-hidden">
      <div
        ref="scrollBox"
        class="h-full rounded-xl flex flex-col gap-4 py-6 px-2 overflow-auto"
      >
        <div class="thread-col">
          <AssistantChat
            :input="i"
            :session-id="sessionId"
            v-for="(i, idx) in history"
            :key="idx"
            :ref="(el) => setChatRef(idx, el)"
            @finish="finishChat"
            @error="finishErrorChat"
            @canstop="(v) => onCanStop(idx, v)"
          />
          <div ref="scrollTarget" />
        </div>
      </div>
      <form class="shrink flex gap-2 p-2 relative thread-col" @submit="chat">
        <div class="form-control w-full">
          <!-- 生成中還是可以打字準備下一句,只是「送出」要等這輪結束——
               同一個 session_id/LangGraph thread 一次只能跑一輪,真的要
               同時處理兩輪需要後端支援,這次先不做。之前用 disabled/readonly
               把整個輸入框鎖住,連打字都不行,是判斷錯了。 -->
          <input
            type="text"
            v-model="input"
            placeholder="Type here"
            class="thread-input w-full"
          />
        </div>
        <!-- 停止鈕不再用 Teleport(踩過兩次目標元素時序坑)—— 改成這裡
             自己畫按鈕,狀態(canStopIdx)由子元件的 canstop 事件更新,
             按下時透過 ref 呼叫子元件 defineExpose 出來的 stop()。
             送出/停止/麥克風三顆改用自訂樣式(跟空狀態的 .composer-send/
             .composer-icon-btn 同一套配色),不再用 daisyUI 的 .btn——
             那個顏色跟全域主題走,停止鈕一冒出來就是沒被蓋掉的灰底樣子。 -->
        <button v-show="!chatting" class="thread-send" type="submit">
          <Icon icon="mingcute:send-fill" class="h-5 w-5" />
        </button>
        <button
          v-show="chatting && canStopIdx !== null"
          class="thread-stop"
          type="button"
          title="停止生成"
          @click="stopActive"
        >
          <Icon icon="mingcute:stop-fill" class="h-4 w-4" />
        </button>
        <label for="assistant-upload">
          <div class="thread-mic" :class="{ 'is-disabled': chatting }">
            <Icon icon="mingcute:mic-fill" class="h-5 w-5" />
          </div>
          <input
            id="assistant-upload"
            type="file"
            accept="audio/*"
            @change.prevent="handleUpload"
            :disabled="chatting"
            capture
            hidden
          />
        </label>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { onMounted, ref } from "vue";
import { Icon } from "@iconify/vue";
import NavBar from "../components/NavBar.vue";
import AssistantChat from "../components/AssistantChat.vue";
import { useSession } from "../composables/useSession";
import { ASSISTANT_API_BASE, ASSISTANT_UPLOAD_URL } from "../config/assistant";

const scrollTarget = ref<HTMLDivElement | null>(null);
const scrollBox = ref<HTMLDivElement | null>(null);

const isNearBottom = () => {
  const el = scrollBox.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
};

const startAutoScroll = () => {
  clearInterval(timer.value);
  timer.value = setInterval(() => {
    if (isNearBottom()) scrollTarget.value?.scrollIntoView({ behavior: "smooth" });
  }, 300);
};

const chatting = ref(false);
const input = ref("");
const history = ref<string[]>([]);
const timer = ref(0);

// 獨立於排課系統的 session namespace,避免兩邊的 LangGraph thread 互相污染
const { sessionId, resetSession } = useSession("assistant");

// 停止鈕:哪個 history 索引「現在可以被停止」,以及對應元件實例的參照——
// 子元件用 canstop 事件通報狀態變化,按下停止鈕時透過這裡存的實例呼叫
// 它 defineExpose 出來的 stop()。同一時間理論上只會有最新那筆是 true。
type StoppableRef = { stop: () => void };
const chatRefs: Record<number, StoppableRef | null> = {};
const canStopIdx = ref<number | null>(null);
const setChatRef = (idx: number, el: unknown) => {
  chatRefs[idx] = el as StoppableRef | null;
};
const onCanStop = (idx: number, value: boolean) => {
  if (value) canStopIdx.value = idx;
  else if (canStopIdx.value === idx) canStopIdx.value = null;
};
const stopActive = () => {
  const idx = canStopIdx.value;
  if (idx !== null) chatRefs[idx]?.stop();
};

const startNewChat = () => {
  history.value = [];
  resetSession();
};

const chat = (e?: Event) => {
  if (e) e.preventDefault();
  // 生成中輸入框仍可打字,但不能真的送出第二輪——同一個 session_id 一次
  // 只能跑一個 LangGraph thread,真的並發需要後端支援,這次先擋在這裡,
  // 打好的字不會被清掉,等這輪結束就能正常送出。
  if (chatting.value) return;
  if (input.value.replace(" ", "") === "") return;
  history.value.push(input.value);
  input.value = "";
  chatting.value = true;
  startAutoScroll();
};

const handleUpload = (e: Event) => {
  e.preventDefault();
  const formData = new FormData();
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  formData.append("file", files[0]);
  chatting.value = true;
  axios
    .post(ASSISTANT_UPLOAD_URL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    .then((res) => {
      history.value.push(res.data.text);
      startAutoScroll();
    });
};

const finishChat = () => {
  clearInterval(timer.value);
  chatting.value = false;
};

const finishErrorChat = () => {
  clearInterval(timer.value);
  chatting.value = false;
};

onMounted(() => {
  if (!ASSISTANT_API_BASE) {
    // 待後端確認 /ask、/upload 端點後在 .env 補上 VITE_ASSISTANT_API_BASE——
    // 在那之前這頁的對話與語音輸入會打到錯誤的相對路徑,刻意留這個警告而不是假裝能動。
    console.warn(
      "[AssistantApp] VITE_ASSISTANT_API_BASE 尚未設定,對話與語音上傳暫時無法使用。"
    );
  }
});
</script>

<style scoped>
/* 固定類 Claude 視覺(米白底/墨色字/襯線大標),不依賴 daisyUI 的 data-theme——
   assistant 頁刻意跟排課系統的全域主題切換脫鉤,見 NavBar 的 hide-theme prop。 */
.assistant-theme {
  --bg: #faf6ee;
  --surface: #ffffff;
  --ink: #2a241d;
  --ink-soft: #746a5d;
  --ink-faint: #a89d8c;
  --accent: #8c2f39;
  --accent-soft: #f3e3e0;
  --line: #e6ddcc;
  --shadow: 0 1px 2px rgba(42, 36, 29, 0.04), 0 8px 24px rgba(42, 36, 29, 0.06);
  /* 空狀態(輸入卡片要「聚焦」,窄)跟對話中(要「舒服閱讀」,寬)刻意不同寬度 */
  --empty-w: 660px;
  --thread-w: 900px;

  background: var(--bg);
  color: var(--ink);
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
}

/* NavBar.vue 本身是排課系統共用的元件,樣式不動——這裡只在 assistant 頁的
   scope 內用 :deep() 覆寫顏色,蓋掉 daisyUI 全域主題可能帶來的深色底色,
   讓 navbar 跟下面米白底的內容視覺一致。NavBar.vue 檔案本身完全沒改。

   navbar 是殼、不是內容,刻意跟下面問題/思考記錄/答案的字級調整(1.35倍)
   脫鉤 —— 這裡固定用比原本 daisyUI 預設更小的尺寸,不會因為內容字級調大
   就跟著變大,兩者是分開的兩套決定。 */
.assistant-theme :deep(.navbar) {
  background: var(--surface) !important;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  min-height: auto;
  padding: 0.4rem 1rem;
}
.assistant-theme :deep(.navbar .btn) {
  background: transparent;
  border-color: transparent;
  color: var(--ink-soft);
}
.assistant-theme :deep(.navbar .btn:hover) {
  background: var(--accent-soft);
  color: var(--accent);
}
.assistant-theme :deep(.navbar .btn.btn-square) {
  width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0;
}
.assistant-theme :deep(.navbar .btn.btn-square svg) {
  width: 15px;
  height: 15px;
}
.assistant-theme :deep(.navbar-center a) {
  font-family: "Noto Serif TC", serif;
  font-weight: 600;
  font-size: 13px;
  opacity: 0.85;
}
.assistant-theme :deep(.navbar-end .btn.btn-ghost.btn-sm) {
  font-size: 11px;
  color: var(--ink-faint);
  padding: 4px 10px;
  height: auto;
  min-height: auto;
}
.assistant-theme :deep(.navbar-end .btn.btn-ghost.btn-sm svg) {
  width: 11px;
  height: 11px;
}

/* ---------- 空狀態 ---------- */
.empty-wrap {
  max-width: var(--empty-w);
  width: 100%;
  text-align: center;
}
.empty-title {
  font-family: "Noto Serif TC", serif;
  font-weight: 600;
  font-size: 38px; /* 28px * 1.35,使用者用 artifact 的字級滑桿確認過的倍率 */
  margin: 0 0 24px;
  text-wrap: balance;
}
.composer {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: var(--shadow);
  padding: 16px 18px 10px;
  text-align: left;
}
.composer-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 20px; /* 15px * 1.35 */
  color: var(--ink);
  font-family: inherit;
}
.composer-input::placeholder { color: var(--ink-faint); }
.composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.composer-hint {
  font-size: 17px; /* 12.5px * 1.35 */
  color: var(--ink-faint);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.inline-icon { color: var(--ink-faint); }
.composer-actions { display: flex; align-items: center; gap: 8px; }
.composer-icon-btn,
.composer-send {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
}
.composer-icon-btn {
  background: transparent;
  color: var(--ink-soft);
}
.composer-icon-btn.is-disabled { opacity: 0.5; pointer-events: none; }
.composer-send {
  background: var(--accent);
  color: var(--surface);
}
.composer-send:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---------- 對話中欄位置中 ---------- */
.thread-col {
  max-width: var(--thread-w);
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
form.thread-col {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

/* 對話中的輸入框、送出、停止、麥克風按鈕,跟空狀態的 composer 系列樣式
   同一套自訂配色,不再用 daisyUI 的 input/btn(那些顏色跟全域主題走)。 */
.thread-input {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--ink);
  font-family: inherit;
  font-size: 15px;
  outline: none;
}
.thread-input:focus { border-color: var(--accent); }
.thread-send,
.thread-stop {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 999px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.thread-send { background: var(--accent); color: var(--surface); }
.thread-send:hover { filter: brightness(1.08); }
.thread-stop { background: var(--ink); color: var(--bg); }
.thread-stop:hover { filter: brightness(1.2); }
.thread-mic {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
}
.thread-mic:hover { background: var(--accent-soft); color: var(--accent); }
.thread-mic.is-disabled { opacity: 0.5; pointer-events: none; }
</style>
