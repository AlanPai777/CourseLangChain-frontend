<template>
  <button
    type="button"
    role="switch"
    class="live-switch"
    :class="{ 'is-on': modelValue && !disabled, 'is-disabled': disabled }"
    :aria-checked="modelValue && !disabled"
    :disabled="disabled"
    :title="disabled ? '管理者已關閉現場查詢(LIVE_FETCH=off)' : '開啟時，回答前會先到官網核對資料'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="track"><span class="knob" /></span>
    <span>查現場</span>
  </button>
</template>

<script setup lang="ts">
/** 「查現場」開關(仿 Claude 的搜尋開關)。旁邊刻意不寫預估時間。 */
defineProps<{ modelValue: boolean; disabled?: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();
</script>

<style scoped>
.live-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--line, #e6ddcc);
  background: var(--surface, #fff);
  color: var(--ink, #2a241d);
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}
.live-switch.is-on { background: var(--accent-soft, #f3e3e0); }
.live-switch.is-disabled { opacity: 0.55; cursor: not-allowed; }
.track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: #c9bfae;
  transition: background 0.15s ease;
}
.is-on .track { background: var(--accent, #8c2f39); }
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.15s ease;
}
.is-on .knob { transform: translateX(14px); }
</style>
