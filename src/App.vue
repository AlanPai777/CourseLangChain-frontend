<template>
  <div class="h-full flex flex-col">
    <NavBar @delete="startNewChat" />
    <div class="grow flex flex-col md:flex-row p-2 gap-2 overflow-hidden">
      <div class="grow flex flex-col gap-4 overflow-hidden">
        <div
          class="h-full rounded-xl flex flex-col gap-4 py-6 px-2 overflow-auto"
        >
          <Chat
            :input="i"
            :session-id="sessionId"
            v-for="(i, idx) in history"
            :key="idx"
            @finish="finishChat"
            @error="finishErrorChat"
          />
          <Intro v-if="history.length == 0" @click="handleIntroClick" />
          <div v-else ref="scrollTarget" />
        </div>
        <form class="shrink flex gap-2 p-2 relative" @submit="chat">
          <div
            class="absolute top-0 flex justify-center w-full mt-[-3rem]"
            id="StopGeneration"
          ></div>
          <div class="form-control w-full">
            <input
              :disabled="chatting"
              type="text"
              v-model="input"
              placeholder="Type here"
              class="input input-bordered w-full"
            />
          </div>
          <button class="btn btn-square" type="submit" :disabled="chatting">
            <Icon icon="mingcute:send-fill" class="h-6 w-6" />
          </button>
          <label for="my-upload">
            <div
              class="btn btn-square cursor-pointer"
              :class="{ 'btn-disabled': chatting }"
            >
              <Icon icon="mingcute:mic-fill" class="h-6 w-6" />
            </div>
            <input
              id="my-upload"
              type="file"
              accept="audio/*"
              @change.prevent="handleUpload"
              :disabled="chatting"
              capture
              hidden
            />
          </label>
        </form>
      </div>

      <SchedulePanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { themeChange } from "theme-change";
import { onMounted, ref, nextTick } from "vue";
import Chat from "./components/Chat.vue";
import NavBar from "./components/NavBar.vue";
import { Icon } from "@iconify/vue";
import Intro from "./components/Intro.vue";
import SchedulePanel from "./components/SchedulePanel.vue";
import { useSession } from "./composables/useSession";
import { useSchedule } from "./composables/useSchedule";
import { useProfile } from "./composables/useProfile";

const scrollTarget = ref<HTMLDivElement | null>(null);
const chatting = ref(false);
const input = ref("");
const history = ref<string[]>([]);
const timer = ref(0);

// sessionId 會隨每則提問送到後端當 thread_id,多輪對話才接得起來
const { sessionId, resetSession } = useSession();
const { refresh: refreshSchedule, resetLocal: resetScheduleLocal } = useSchedule();
const { resetLocal: resetProfileLocal } = useProfile();

/**
 * 清空畫面時一併換掉 session,否則後端仍記得剛剛被清掉的那段對話。
 * 課表與成績單都掛在 session 上,換 id 等同全部重來,本地狀態也要跟著清。
 */
const startNewChat = () => {
  history.value = [];
  resetSession();
  resetScheduleLocal();
  resetProfileLocal();
};

const chat = (e?: Event) => {
  if (e) e.preventDefault();
  if (input.value.replace(" ", "") === "") return;
  history.value.push(input.value);
  input.value = "";
  chatting.value = true;
  if (scrollTarget.value) {
    timer.value = setInterval(() => {
      scrollTarget.value!.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }
};

const handleUpload = (e: Event) => {
  e.preventDefault();
  const formData = new FormData();
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  formData.append("file", files[0]);
  chatting.value = true;
  axios
    .post("/api/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    .then((res) => {
      history.value.push(res.data.text);
      if (scrollTarget.value) {
        timer.value = setInterval(() => {
          scrollTarget.value!.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    });
};

const finishChat = (message: ChatMessage) => {
  console.log(message);
  clearInterval(timer.value);
  chatting.value = false;
  // 助理可能在這輪用 my_schedule_tool 改過課表,拉一次最新狀態回來
  refreshSchedule();
};

const finishErrorChat = () => {
  clearInterval(timer.value);
  chatting.value = false;
};

const handleIntroClick = (content: string) => {
  input.value = content;
  chat();
};

onMounted(() => {
  themeChange(false);
});
</script>
