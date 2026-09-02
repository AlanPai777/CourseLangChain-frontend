<template>
  <div class="h-full flex flex-col overflow-auto">
    <div class="navbar bg-base-200">
      <div class="navbar-start">
        <span class="text-xl font-bold">Course LangChain</span>
      </div>
      <div class="navbar-end">
        <Theme />
      </div>
    </div>

    <div class="hero flex-1">
      <div class="hero-content flex-col text-center max-w-2xl w-full">
        <div>
          <h1 class="text-4xl font-bold mb-4">你想做什麼?</h1>
          <p class="opacity-70 leading-relaxed">
            選一個開始——幫你排課,或直接回答政大生活的任何問題。
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-6">
          <router-link
            to="/schedule"
            class="bg-base-200 hover:bg-base-300 transition-colors rounded-xl p-8 flex flex-col gap-4 text-left"
            style="text-decoration: none; color: inherit;"
          >
            <div class="flex items-center justify-between">
              <div
                class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Icon icon="mingcute:calendar-2-fill" class="h-7 w-7 text-primary" />
              </div>
              <span class="badge badge-primary">立即使用</span>
            </div>
            <div>
              <h3 class="text-xl font-bold">排課系統</h3>
              <p class="text-sm opacity-70 leading-relaxed mt-1">
                管理課表、查詢加簽建議,結合你的成績單推薦選課組合。
              </p>
            </div>
            <div class="flex items-center gap-1 text-sm font-semibold text-primary mt-1">
              前往課表
              <Icon icon="mingcute:right-line" class="h-4 w-4" />
            </div>
          </router-link>

          <router-link
            to="/assistant"
            class="bg-base-200 hover:bg-base-300 transition-colors rounded-xl p-8 flex flex-col gap-4 text-left"
            style="text-decoration: none; color: inherit;"
          >
            <div class="flex items-center justify-between">
              <div
                class="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center"
              >
                <Icon icon="mingcute:chat-3-fill" class="h-7 w-7 text-secondary" />
              </div>
              <span class="badge badge-outline badge-secondary">Beta 測試</span>
            </div>
            <div>
              <h3 class="text-xl font-bold">政大 AI 助手</h3>
              <p class="text-sm opacity-70 leading-relaxed mt-1">
                政大生活與規定問答,講什麼都能直接問,不需要先建課表。
              </p>
            </div>
            <div class="flex items-center gap-1 text-sm font-semibold text-secondary mt-1">
              開始對話
              <Icon icon="mingcute:right-line" class="h-4 w-4" />
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import Theme from "../components/Theme.vue";
</script>
