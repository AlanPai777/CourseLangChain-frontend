<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="!layout.blocks.length && !layout.undated.length"
      class="text-sm opacity-60 py-6 text-center"
    >
      還沒有排定任何課程。
    </div>

    <div v-else class="overflow-x-auto">
      <div
        class="grid text-xs min-w-[18rem]"
        :style="{
          gridTemplateColumns: `2.6rem repeat(${layout.weekdays.length}, minmax(3rem, 1fr))`,
          gridTemplateRows: `1.5rem repeat(${layout.rows.length}, 2.4rem)`,
        }"
      >
        <!-- 左上角空格 -->
        <div class="border-b border-base-300"></div>

        <!-- 星期標頭 -->
        <div
          v-for="wd in layout.weekdays"
          :key="`h-${wd}`"
          class="border-b border-l border-base-300 flex items-center justify-center font-medium"
        >
          {{ wd }}
        </div>

        <!-- 每一列:時間軸 + 空格線 -->
        <template v-for="(p, r) in layout.rows" :key="`r-${p}`">
          <div
            class="border-b border-base-300 flex flex-col items-end justify-center pr-1 leading-none"
            :style="{ gridRow: r + 2, gridColumn: 1 }"
          >
            <span class="opacity-60 text-[0.6rem]">{{ periodStart(p) }}</span>
            <span class="opacity-90 font-medium">{{ p }}</span>
          </div>
          <div
            v-for="(wd, c) in layout.weekdays"
            :key="`c-${p}-${wd}`"
            class="border-b border-l border-base-300"
            :style="{ gridRow: r + 2, gridColumn: c + 2 }"
          ></div>
        </template>

        <!-- 課程色塊:跨越連續節次 -->
        <button
          v-for="b in layout.blocks"
          :key="b.key"
          class="rounded-md m-[2px] p-1 overflow-hidden text-left leading-tight
                 hover:ring-2 hover:ring-base-content/30 transition-shadow"
          :style="{
            gridRow: `${b.rowStart} / span ${b.span}`,
            gridColumn: b.column,
            backgroundColor: b.color,
            color: b.textColor,
          }"
          :title="`${b.course.name}\n${b.course.time}・${b.course.credits} 學分\n${b.course.teacher || ''}\n${b.course.course_id}`"
          @click="emits('select', b.course)"
        >
          <span class="block font-medium truncate text-[0.7rem]">{{ b.course.name }}</span>
          <span class="block opacity-80 truncate text-[0.6rem]">{{ b.course.teacher }}</span>
        </button>
      </div>
    </div>

    <!-- 時間未定的課排不進格子,單獨列出 -->
    <div v-if="layout.undated.length" class="text-xs opacity-70">
      <p class="font-medium mb-1">時間未定 / 彈性:</p>
      <ul class="flex flex-col gap-1">
        <li v-for="c in layout.undated" :key="c.course_id" class="truncate">
          ・{{ c.name }}({{ c.credits }} 學分)
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ScheduleCourse } from "../composables/useSchedule";
import { periodStart } from "../composables/usePeriods";
import { buildTimetable } from "../composables/useTimetableLayout";

const props = defineProps<{ courses: ScheduleCourse[] }>();
const emits = defineEmits<{ (e: "select", course: ScheduleCourse): void }>();

const layout = computed(() => buildTimetable(props.courses));
</script>
