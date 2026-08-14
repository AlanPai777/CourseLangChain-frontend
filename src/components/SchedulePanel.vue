<template>
  <div
    class="bg-base-200 rounded-xl flex flex-col transition-all duration-200"
    :class="open ? 'w-full md:w-96 shrink-0' : 'w-full md:w-14 shrink-0'"
  >
    <!-- 標題列:永遠可見,收起時只剩這條 -->
    <button
      class="flex items-center gap-2 p-3 hover:bg-base-300 rounded-xl transition-colors"
      @click="open = !open"
      :title="open ? '收起課表' : '展開課表'"
    >
      <Icon
        :icon="open ? 'mingcute:right-line' : 'mingcute:calendar-line'"
        class="h-5 w-5 shrink-0"
      />
      <template v-if="open">
        <span class="font-bold grow text-left">我的課表</span>
        <span class="badge badge-primary">{{ totalCredits }} 學分</span>
      </template>
      <span
        v-else-if="courses.length"
        class="badge badge-primary badge-sm absolute ml-6 mt-6"
      >
        {{ courses.length }}
      </span>
    </button>

    <div v-if="open" class="flex flex-col gap-3 p-3 pt-0 overflow-auto">
      <!-- 新增:輸入課程代碼 -->
      <form class="flex gap-1" @submit.prevent="submitAdd">
        <input
          v-model="newId"
          type="text"
          inputmode="numeric"
          placeholder="輸入 13 位課程代碼"
          class="input input-bordered input-sm w-full"
          :disabled="loading"
        />
        <button
          class="btn btn-sm btn-square btn-primary"
          type="submit"
          :disabled="loading || !newId.trim()"
        >
          <Icon icon="mingcute:add-line" class="h-4 w-4" />
        </button>
      </form>

      <p v-if="lastMessage" class="text-xs opacity-70 leading-relaxed">
        {{ lastMessage }}
      </p>

      <!-- 檢視切換:週課表 / 清單 -->
      <div class="tabs tabs-boxed tabs-sm self-start">
        <button
          class="tab"
          :class="{ 'tab-active': view === 'week' }"
          @click="view = 'week'"
        >
          週課表
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': view === 'list' }"
          @click="view = 'list'"
        >
          清單
        </button>
      </div>

      <WeekTimetable
        v-if="view === 'week'"
        :courses="courses"
        @select="scrollToCourse"
      />

      <!-- 課程清單 -->
      <p
        v-else-if="!courses.length"
        class="text-sm opacity-60 py-4 text-center"
      >
        還沒有排定任何課程。<br />
        可以在上面輸入課程代碼,或直接請助理幫你排。
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="c in courses"
          :key="c.course_id"
          class="bg-base-100 rounded-lg p-2 flex gap-2 items-start transition-shadow"
          :class="{ 'ring-2 ring-primary': highlightId === c.course_id }"
        >
          <div class="grow min-w-0">
            <p class="font-medium text-sm truncate" :title="c.name">
              {{ c.name }}
            </p>
            <p class="text-xs opacity-70">
              {{ c.time || "時間未定" }} ・ {{ c.credits }} 學分
            </p>
            <p class="text-xs opacity-50 truncate">
              {{ c.teacher || "－" }} ・ {{ c.course_id }}
            </p>
          </div>
          <button
            class="btn btn-ghost btn-xs btn-square shrink-0"
            @click="removeCourse(c.course_id)"
            :disabled="loading"
            title="移除"
          >
            <Icon icon="mingcute:close-line" class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <button
        v-if="courses.length && view === 'list'"
        class="btn btn-ghost btn-xs"
        @click="clearSchedule"
        :disabled="loading"
      >
        清空課表
      </button>

      <p class="text-xs opacity-50 leading-relaxed border-t border-base-300 pt-2">
        加入的課若與現有課程衝堂、或是同一門課的另一個班,會自動替換掉舊的那幾門。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Icon } from "@iconify/vue";
import WeekTimetable from "./WeekTimetable.vue";
import { useSchedule, type ScheduleCourse } from "../composables/useSchedule";

const open = ref(true);
const newId = ref("");
const view = ref<"week" | "list">("week");
const highlightId = ref("");

/** 點週課表上的色塊 → 切到清單並高亮那門課(清單才有移除鈕)。 */
const scrollToCourse = (course: ScheduleCourse) => {
  view.value = "list";
  highlightId.value = course.course_id;
  setTimeout(() => {
    if (highlightId.value === course.course_id) highlightId.value = "";
  }, 2000);
};

const {
  courses,
  totalCredits,
  loading,
  lastMessage,
  refresh,
  addCourse,
  removeCourse,
  clearSchedule,
} = useSchedule();

const submitAdd = async () => {
  const id = newId.value.trim();
  if (!id) return;
  const ok = await addCourse(id);
  if (ok) newId.value = "";
};

onMounted(refresh);
</script>
