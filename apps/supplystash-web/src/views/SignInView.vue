<script setup lang="ts">
import router from "@/router";
import { EyeIcon, EyeSlashIcon, XCircleIcon } from "@heroicons/vue/24/outline";
import { ref } from "vue";

import DefaultLayout from "@/components/layouts/DefaultLayout.vue";

import { useAuthStore } from "@/stores/auth.store";

// TODO: Create a zod schema for this form
const email = ref("");
const password = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const showPassword = ref(false);

const authStore = useAuthStore();

const handleSubmit = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = "";

    await authStore.login({
      email: email.value,
      password: password.value,
    });

    router.push({ name: "list" });
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message;
    }
  } finally {
    isLoading.value = false;
  }
};

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};
</script>

<template>
  <DefaultLayout class="flex flex-col items-center justify-center">
    <div
      class="card w-full max-w-md bg-base-200 shadow-xl border-solid border-1 border-base-300"
    >
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">Sign in</h2>

        <div
          v-if="errorMessage"
          class="alert alert-error mb-4"
        >
          <XCircleIcon class="stroke-current shrink-0 h-6 w-6" />
          <span>{{ errorMessage }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="form-control w-full mb-4">
            <label class="label">
              <span class="label-text">Email</span>
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="input input-bordered w-full"
              required
            />
          </div>

          <div class="form-control w-full mb-6">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="input input-bordered w-full pr-10"
                required
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 px-3 flex items-center z-10"
                @click="togglePasswordVisibility"
              >
                <EyeIcon
                  v-if="showPassword"
                  class="h-5 w-5 text-gray-400"
                />
                <EyeSlashIcon
                  v-else
                  class="h-5 w-5 text-gray-400"
                />
              </button>
            </div>
          </div>

          <div class="form-control mt-6 text-right">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isLoading"
            >
              <span
                v-if="isLoading"
                class="loading loading-spinner"
              ></span>
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
    <p class="text-sm mt-8 text-center">
      Need to make an account?<br /><RouterLink
        to="/sign-up"
        class="link link-secondary"
        >Sign up instead</RouterLink
      >
    </p>
  </DefaultLayout>
</template>
