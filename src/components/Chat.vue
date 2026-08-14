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
import { ref, watch } from "vue";
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
  // type=courses 是側通道事件(候選課程),不是文字 token,別串進 output
  if (payload.type === "courses") {
    candidates.value.push(...(payload.courses ?? []));
    return;
  }
  const token = payload.data;
  if (token === "SPECIAL_END_TOKEN") close();
  else output.value += token;
});

watch(error, (err) => {
  if (err) {
    outputError.value = true;
    output.value = "An error occurred while attempting to connect.";
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
