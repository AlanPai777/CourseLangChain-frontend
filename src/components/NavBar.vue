<template>
  <div class="navbar bg-base-200">
    <div class="navbar-start">
      <button class="btn btn-square" @click="emits('delete')" title="開新對話">
        <Icon icon="mingcute:delete-2-line" class="h-6 w-6" />
      </button>
    </div>
    <div class="navbar-center">
      <router-link to="/" class="text-xl font-bold" style="text-decoration: none; color: inherit;">
        {{ title }}
      </router-link>
    </div>
    <div class="navbar-end gap-2">
      <router-link
        v-if="back"
        :to="back.to"
        class="btn btn-ghost btn-sm gap-1"
      >
        <Icon icon="mingcute:left-line" class="h-4 w-4" />
        {{ back.label }}
      </router-link>
      <Theme />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import Theme from "./Theme.vue";

withDefaults(
  defineProps<{
    title?: string;
    back?: { to: string; label: string };
  }>(),
  { title: "Course LangChain" }
);

const emits = defineEmits<{
  (e: "delete"): void
}>()
</script>
