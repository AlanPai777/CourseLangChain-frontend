<template>
  <div class="hero h-full">
    <div class="hero-content text-center">
      <div class="max-w-md flex flex-col gap-6">
        <div>
          <h1 class="text-4xl font-bold">政大選課助理</h1>
          <p class="py-4 opacity-80 leading-relaxed">
            用講的就能查課、排課表。告訴我你想修什麼、想避開哪些時段、要幾學分,
            我會從本學期的課程中排出不衝堂的組合。
          </p>
        </div>

        <TranscriptUpload />

        <div>
          <p class="text-sm opacity-60 mb-2">或直接試試看:</p>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="content in contents"
              :key="content"
              @click="emits('click', content)"
              class="bg-neutral hover:bg-neutral-focus transition-colors rounded-md p-2 py-4"
            >
              <p class="text-sm text-neutral-content text-left truncate">
                {{ content }}
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TranscriptUpload from "./TranscriptUpload.vue";

const emits = defineEmits<{
  (e: "click", content: string): void;
}>();

const contents = [
  "你好",
  "你可以做甚麼？",
  "我星期一不想排課，請幫我排課表！",
  "我想修經濟學，請幫我排課表！",
];
</script>
