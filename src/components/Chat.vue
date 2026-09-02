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
import { Icon } from "@iconify/vue";
import VueMarkdown from "vue-markdown-render";
import CourseCandidates from "./CourseCandidates.vue";
import { useChat } from "../composables/useChat";

const props = defineProps<{
  input: string;
  sessionId: string;
}>();
const emits = defineEmits<{
  (e: "finish", message: ChatMessage): void;
  (e: "error"): void;
}>();

const {
  output,
  canStop,
  outputError,
  candidates,
  errorMessage,
  errorDetail,
  aborted,
  finished,
  startedAtText,
  elapsedText,
  phase,
  close,
} = useChat({
  input: props.input,
  sessionId: props.sessionId,
  onFinish: (message) => emits("finish", message),
  onError: () => emits("error"),
});
</script>
