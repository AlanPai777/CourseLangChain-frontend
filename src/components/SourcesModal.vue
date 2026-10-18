<template>
  <div v-if="open" class="sm-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="sm-dialog" role="dialog" aria-modal="true" aria-label="來源" tabindex="-1" ref="dialog">
      <div class="sm-top">
        <span class="sm-spacer" />
        <span class="sm-heading">來源</span>
        <button type="button" class="sm-close" aria-label="關閉" @click="emit('close')">
          <Icon icon="mingcute:close-line" class="h-4 w-4" />
        </button>
      </div>
      <div class="sm-note">{{ note }}</div>
      <div class="sm-body">
        <div v-for="(g, gi) in sources.groups" :key="g.host" class="sm-group">
          <button type="button" class="sm-ghead" :aria-expanded="isOpen(g.host, gi)" @click="toggle(g.host, gi)">
            <SiteLogo :host="g.host === 'fixed' ? '' : g.host" :name="g.name" :size="36" :shape="logoShape" />
            <span class="sm-gtext">
              <span class="sm-gname">{{ g.name }}</span>
              <span class="sm-gcount">{{ g.items.length }} 筆來源</span>
            </span>
            <Icon icon="mingcute:down-line" class="sm-chev" :class="{ 'is-open': isOpen(g.host, gi) }" />
          </button>
          <div v-if="isOpen(g.host, gi)" class="sm-items">
            <div v-for="it in g.items" :key="it.url + it.title" class="sm-item">
              <a v-if="it.url" :href="it.url" target="_blank" rel="noopener noreferrer" class="sm-link">{{ it.title }}</a>
              <span v-else class="sm-plain">{{ it.title }}</span>
              <StateChip :state="it.state" :label="it.label" />
              <span class="sm-time">{{ it.time }}</span>
              <div v-if="it.tlsUnverified" class="sm-small">系統讀取此站時未驗證憑證。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SiteLogo from "./SiteLogo.vue";
import StateChip from "./StateChip.vue";
import { dateText } from "../utils/progressStyle";

/**
 * 來源視窗(仿 America.gov 的 Sources):依網站分組、每組可展開、每筆是連結並標示是現場核對還是資料庫。
 * 只列「內容真的進到答案資料裡的頁面」(由後端決定);內建固定資料沒有網址,只顯示名稱。
 */
const props = defineProps<{ sources: SourcesPayload; open: boolean; logoShape?: "circle" | "square" }>();
const emit = defineEmits<{ (e: "close"): void }>();

const state = reactive<Record<string, boolean>>({});
// 預設只展開第一組;使用者點過就照使用者的
const isOpen = (host: string, index: number) => (host in state ? state[host] : index === 0);
const toggle = (host: string, index: number) => {
  state[host] = !isOpen(host, index);
};

const note = computed(() =>
  props.sources.live
    ? "每筆來源都標示最近一次與官網核對的時間。只列內容真的進到答案資料裡的頁面。"
    : `本題關閉了「查現場」，答案來自資料庫（${dateText(props.sources.snapshotDate)}更新）。`
);

const dialog = ref<HTMLElement | null>(null);
watch(
  () => props.open,
  async (v) => {
    if (v) {
      await nextTick();
      dialog.value?.focus(); // 讓 Esc 可以關閉(keydown 要有焦點在視窗內才收得到)
    }
  }
);
</script>

<style scoped>
.sm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(42, 36, 29, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.sm-dialog {
  width: 640px;
  max-width: 100%;
  max-height: 80vh;
  background: var(--surface, #fffdf8);
  color: var(--ink, #2a241d);
  border-radius: 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}
.sm-top { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 8px; }
.sm-spacer { width: 36px; }
.sm-heading { font-weight: 700; font-size: 18px; }
.sm-close { width: 36px; height: 36px; border-radius: 999px; border: 0; background: #f1eadc; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink, #2a241d); }
.sm-note { padding: 0 22px 8px; font-size: 13px; color: var(--ink-soft, #746a5d); }
.sm-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 22px 18px; }
.sm-group { border-top: 1px solid #efe6d6; }
.sm-ghead { width: 100%; display: flex; align-items: center; gap: 14px; padding: 12px 0; border: 0; background: transparent; text-align: left; cursor: pointer; color: inherit; }
.sm-gtext { flex: 1; display: flex; flex-direction: column; }
.sm-gname { font-weight: 500; font-size: 16px; }
.sm-gcount { font-size: 13px; color: var(--ink-soft, #746a5d); }
.sm-chev { width: 16px; height: 16px; transition: transform 0.15s ease; }
.sm-chev.is-open { transform: rotate(180deg); }
.sm-items { padding: 0 0 10px 50px; display: flex; flex-direction: column; gap: 9px; }
.sm-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 14px; }
.sm-link { flex: 1 1 200px; min-width: 0; color: var(--accent, #8c2f39); text-decoration: underline dotted; }
.sm-plain { flex: 1 1 200px; min-width: 0; }
.sm-time { flex: none; font-size: 12px; color: var(--ink-soft, #746a5d); min-width: 110px; text-align: right; }
.sm-small { flex-basis: 100%; font-size: 12px; color: #7d5610; }
</style>
