import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

const documentHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty("--doc-height", `${window.innerHeight}px`);
};
window.addEventListener("resize", documentHeight);
documentHeight();

createApp(App).use(router).mount('#app')