<template>
  <span class="state-chip" :class="chipClass(state)">{{ label }}</span>
</template>

<script setup lang="ts">
import { chipClass } from "../utils/progressStyle";
/** 狀態標籤:文字由後端的 label 提供,顏色只看 state(進度清單與來源視窗共用)。 */
defineProps<{ state: string; label: string }>();
</script>

<style scoped>
.state-chip {
  flex: none;
  padding: 1px 9px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
}
.chip-ok { background: #e4f0e8; color: #2f6b4c; }
.chip-changed { background: #f8ecd2; color: #7d5610; }
.chip-warn { background: #f5dedb; color: #9a2f27; }
.chip-muted { background: #ece6da; color: #6a6052; }
.chip-pending { background: #ece6da; color: #6a6052; animation: chip-pulse 1.2s ease-in-out infinite; }
@keyframes chip-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .chip-pending { animation: none; } }
</style>
