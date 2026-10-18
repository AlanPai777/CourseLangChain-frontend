<template>
  <span class="site-logo" :class="shape" :style="{ width: px, height: px, background: failed ? color : '#fff' }" :title="name || host">
    <img
      v-if="host && !failed"
      :src="`https://${host}/favicon.ico`"
      :alt="name || host"
      referrerpolicy="no-referrer"
      loading="lazy"
      @error="failed = true"
    />
    <span v-else class="letter" :style="{ fontSize: Math.round(size * 0.5) + 'px' }">{{ letter }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

/**
 * 網站標誌:先試網站自己的小圖示(favicon,由使用者的瀏覽器直接載入,不經我們的後端);
 * 載入失敗(沒有這個檔、被擋、憑證有問題)就退回名稱第一個字的彩色圓形。
 * 還沒驗證政大各站的 /favicon.ico 是否都存在,demo 看過效果再決定要不要另外建圖示表。
 */
const props = withDefaults(defineProps<{ host: string; name?: string; size?: number; shape?: "circle" | "square" }>(), {
  size: 22,
  shape: "circle",
});

const failed = ref(false);
const px = computed(() => `${props.size}px`);
const letter = computed(() => ((props.name || props.host || "?").trim()[0] ?? "?").toUpperCase());
const PALETTE = ["#8c2f39", "#4b6a8a", "#5b7f5a", "#9a6a2a", "#6a4f8a", "#2f7a7a", "#8a5a6a", "#5a6a8a"];
const color = computed(() => {
  let h = 0;
  for (const ch of props.host || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
});
</script>

<style scoped>
.site-logo {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--line, #e6ddcc);
}
.site-logo.circle { border-radius: 999px; }
.site-logo.square { border-radius: 6px; }
.site-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.site-logo .letter { color: #fff; font-weight: 700; line-height: 1; }
</style>
