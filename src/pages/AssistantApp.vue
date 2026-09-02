<template>
  <div class="h-full flex flex-col">
    <NavBar
      title="政大 AI 助手"
      :back="{ to: '/schedule', label: '回排課系統' }"
      @delete="startNewChat"
    />
    <div class="grow flex flex-col p-2 gap-2 overflow-hidden">
      <div
        ref="scrollBox"
        class="h-full rounded-xl flex flex-col gap-4 py-6 px-2 overflow-auto"
      >
        <AssistantChat
          :input="i"
          :session-id="sessionId"
          v-for="(i, idx) in history"
          :key="idx"
          @finish="finishChat"
          @error="finishErrorChat"
        />
        <div
          v-if="history.length === 0"
          class="h-full flex items-center justify-center text-center opacity-60 px-4"
        >
          <p>問我政大生活的任何問題。</p>
        </div>
        <div v-else ref="scrollTarget" />
      </div>
      <form class="shrink flex gap-2 p-2 relative" @submit="chat">
        <div
          class="absolute top-0 flex justify-center w-full mt-[-3rem]"
          id="StopGeneration"
        ></div>
        <div class="form-control w-full">
          <input
            :disabled="chatting"
            type="text"
            v-model="input"
            placeholder="Type here"
            class="input input-bordered w-full"
          />
        </div>
        <button class="btn btn-square" type="submit" :disabled="chatting">
          <Icon icon="mingcute:send-fill" class="h-6 w-6" />
        </button>
        <label for="assistant-upload">
          <div
            class="btn btn-square cursor-pointer"
            :class="{ 'btn-disabled': chatting }"
          >
            <Icon icon="mingcute:mic-fill" class="h-6 w-6" />
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

const startNewChat = () => {
  history.value = [];
  resetSession();
};

const chat = (e?: Event) => {
  if (e) e.preventDefault();
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
