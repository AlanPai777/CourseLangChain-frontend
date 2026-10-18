<template>
  <div class="progress-list">
    <template v-for="it in items" :key="it.id">
      <div v-if="it.type === 'note'" class="pl-note">{{ it.text }}</div>

      <div v-else class="pl-group">
        <button type="button" class="pl-head" :aria-expanded="!!open[it.id]" @click="toggle(it.id)">
          <span class="pl-verb">{{ VERB_LABEL[it.verb] ?? it.verb }}</span>
          <span class="pl-title">{{ it.title }}</span>
          <Icon icon="mingcute:right-line" class="pl-chev" :class="{ 'is-open': open[it.id] }" />
        </button>

        <div v-if="open[it.id]" class="pl-rows">
          <div v-if="!it.rows.length" class="pl-empty">沒有找到相關頁面</div>
          <template v-for="r in it.rows" :key="r.id">
            <component
              :is="r.url ? 'a' : 'div'"
              class="pl-row"
              v-bind="r.url ? { href: r.url, target: '_blank', rel: 'noopener noreferrer' } : {}"
            >
              <SiteLogo :host="r.host" :name="r.siteName" :shape="logoShape" />
              <span class="pl-main">
                <span class="pl-row-title">{{ r.title }}</span>
                <span v-if="r.host" class="pl-host">{{ r.host }}</span>
              </span>
              <StateChip :state="r.state" :label="r.label" />
              <span class="pl-time">{{ r.time }}</span>
              <Icon v-if="r.url" icon="mingcute:arrow-right-up-line" class="pl-open" />
            </component>
            <div v-if="r.tlsUnverified" class="pl-small">系統讀取此站時未驗證憑證。</div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { Icon } from "@iconify/vue";
import SiteLogo from "./SiteLogo.vue";
import StateChip from "./StateChip.vue";
import { VERB_LABEL } from "../composables/useChat";

/**
 * 進度清單(仿 Claude 的 Searched the web):依時間順序混排說明行與動作區塊;區塊預設收合,點開是頁面列,
 * 整列是連結,點了直接開官網頁面(開新分頁)。區塊旁刻意不加「執行中」記號——最上面那一行已經寫了現在在做什麼。
 */
defineProps<{ items: ProgressItem[]; logoShape?: "circle" | "square" }>();

const open = reactive<Record<string, boolean>>({});
const toggle = (id: string) => {
  open[id] = !open[id];
};
</script>

<style scoped>
.progress-list {
  border: 1px solid var(--line, #e6ddcc);
  border-radius: 12px;
  background: var(--surface, #fff);
  padding: 4px 0;
  overflow: hidden;
}
.pl-note { padding: 6px 16px; font-size: 15px; color: var(--ink-soft, #746a5d); line-height: 1.5; }
.pl-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  background: transparent;
  border: 0;
  text-align: left;
  color: var(--ink, #2a241d);
  font-size: 15px;
  cursor: pointer;
}
.pl-head:hover { background: var(--accent-soft, #f3e3e0); }
.pl-verb { flex: none; color: var(--ink-faint, #a89d8c); }
.pl-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-chev { flex: none; width: 14px; height: 14px; color: var(--ink-faint, #a89d8c); transition: transform 0.15s ease; }
.pl-chev.is-open { transform: rotate(90deg); }
.pl-rows { background: #faf6ee; border-top: 1px solid #f1e9da; border-bottom: 1px solid #f1e9da; margin: 2px 0 4px; }
.pl-empty { padding: 8px 28px; font-size: 14px; color: var(--ink-faint, #a89d8c); }
.pl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px 7px 28px;
  border-top: 1px solid #f1e9da;
  color: var(--ink, #2a241d);
  text-decoration: none;
  font-size: 14px;
}
a.pl-row:hover { background: var(--accent-soft, #f3e3e0); }
.pl-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.pl-row-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-host { flex: none; font-size: 12px; color: var(--ink-faint, #a89d8c); }
.pl-time { flex: none; min-width: 90px; text-align: right; font-size: 12px; color: var(--ink-soft, #746a5d); }
.pl-open { flex: none; width: 14px; height: 14px; color: var(--ink-soft, #746a5d); }
.pl-small { padding: 0 14px 6px 62px; font-size: 12px; color: #7d5610; }
@media (max-width: 640px) {
  .pl-host, .pl-time { display: none; }
}
</style>
