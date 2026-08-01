<template>
  <div class="bg-base-200 rounded-xl p-4 flex flex-col gap-2 text-left">
    <div class="flex items-center gap-2">
      <Icon icon="mingcute:file-import-line" class="h-5 w-5 shrink-0" />
      <span class="font-bold">上傳成績單,讓排課更貼近你(選用)</span>
    </div>

    <template v-if="!profile.has_profile">
      <p class="text-sm opacity-80 leading-relaxed">
        到
        <span class="font-mono">iNCCU</span>
        →「課業學習」頁面下載成績單 JSON 後上傳,助理就能避開你已經修過的課,
        並優先補你還缺的畢業學分。
      </p>

      <label for="transcript-upload" class="w-fit">
        <div
          class="btn btn-sm btn-primary"
          :class="{ 'btn-disabled': uploading }"
        >
          <span v-if="uploading" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="mingcute:upload-line" class="h-4 w-4" />
          選擇成績單 JSON
        </div>
        <input
          id="transcript-upload"
          type="file"
          accept="application/json,.json"
          @change="handleFile"
          :disabled="uploading"
          hidden
        />
      </label>
    </template>

    <template v-else>
      <p class="text-sm">
        已讀取
        <span class="font-medium">{{ profile.grade_label || profile.department }}</span>
        的修課狀況:已修
        <span class="font-medium">{{ profile.completed_count }}</span> 門
        <template v-if="profile.earned_credits != null">
          ・ {{ profile.earned_credits }} /
          {{ profile.graduation_credits ?? "?" }} 學分
        </template>
      </p>
      <div v-if="profile.graduation_gaps?.length" class="flex flex-wrap gap-1">
        <span
          v-for="gap in profile.graduation_gaps"
          :key="gap"
          class="badge badge-outline badge-sm"
        >
          {{ gap }}
        </span>
      </div>
      <button class="btn btn-ghost btn-xs w-fit" @click="remove">
        <Icon icon="mingcute:delete-2-line" class="h-4 w-4" />
        移除我的成績單資料
      </button>
    </template>

    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <!-- 隱私聲明:無論上傳前後都顯示 -->
    <p class="text-xs opacity-60 leading-relaxed border-t border-base-300 pt-2">
      <Icon icon="mingcute:lock-line" class="h-3 w-3 inline align-text-bottom" />
      我們<span class="font-medium">不會儲存</span>你的成績單。檔案內容只用來讀出「修過哪些課、還缺哪些學分」,
      姓名、學號、聯絡方式、成績分數與排名一律不會被取用;資料只存在這次的對話中,
      關掉頁面就消失,你也可以隨時按上面的按鈕移除。
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { Icon } from "@iconify/vue";
import { useProfile } from "../composables/useProfile";

const { profile, uploading, error, refresh, upload, remove } = useProfile();

const handleFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await upload(file);
  // 清掉 input,讓同一個檔案可以重選
  input.value = "";
};

onMounted(refresh);
</script>
