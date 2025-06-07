import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";
import "./assets/main.css";
import router from "./router";

const app = createApp(App);

// TODO: Remove this after we get all the env junk sorted out
console.log("Supabase Check:", import.meta.env.VITE_SUPABASE_URL);

app.use(createPinia());
app.use(router);

app.mount("#app");
