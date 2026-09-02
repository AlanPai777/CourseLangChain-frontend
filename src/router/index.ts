import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "landing",
      component: () => import("../pages/Landing.vue"),
    },
    {
      path: "/schedule",
      name: "schedule",
      component: () => import("../pages/ScheduleApp.vue"),
    },
    {
      path: "/assistant",
      name: "assistant",
      component: () => import("../pages/AssistantApp.vue"),
    },
  ],
});

export default router;
