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
      <div
        class="chat-header text-xs opacity-60 mb-1 flex items-center gap-1"
        :class="{ 'cursor-pointer': statusLog.length }"
        @click="statusLog.length && toggleLog()"
      >
        <template v-if="finished">
          <Icon icon="mingcute:check-line" class="h-3 w-3" />
          <span :title="`發問時間 ${startedAtText}`">耗時 {{ elapsedText }}</span>
        </template>
        <template v-else>
          <span class="loading loading-spinner loading-xs"></span>
          <span>{{ phase }}</span>
          <span>· {{ elapsedText }}</span>
        </template>
        <Icon
          v-if="statusLog.length"
          :icon="logExpanded ? 'mingcute:up-line' : 'mingcute:down-line'"
          class="h-3 w-3 opacity-60"
        />
      </div>
      <!-- 累積式思考過程：不是只顯示最新一句，是全部歷史疊起來——
           呼應 claude.ai 的 Thinking 面板，開始吐字後自動收合(見下方 script)。 -->
      <ul
        v-if="statusLog.length && logExpanded"
        class="text-xs opacity-50 flex flex-col gap-0.5 mb-2 pl-3 border-l-2 border-base-300"
      >
        <li v-for="(line, i) in statusLog" :key="i">{{ line }}</li>
      </ul>
      <div class="chat-bubble" :class="{ 'chat-bubble-error': outputError }">
        <span v-if="aborted" class="text-sm opacity-70">已停止生成。</span>
        <span
          v-else-if="output.length === 0"
          class="loading loading-dots loading-md"
        ></span>
        <VueMarkdown v-else :source="output" class="overflow-auto" />
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
import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import VueMarkdown from "vue-markdown-render";
import { useChat } from "../composables/useChat";
import { ASSISTANT_ASK_URL } from "../config/assistant";

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
  errorMessage,
  errorDetail,
  aborted,
  finished,
  startedAtText,
  elapsedText,
  phase,
  statusLog,
  close,
} = useChat({
  input: props.input,
  sessionId: props.sessionId,
  endpoint: ASSISTANT_ASK_URL,
  onFinish: (message) => emits("finish", message),
  onError: () => emits("error"),
});

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
</script>
