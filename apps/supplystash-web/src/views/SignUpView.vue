<script setup lang="ts">
import { EyeIcon, EyeSlashIcon, XCircleIcon } from "@heroicons/vue/24/outline";
import { ref, watch } from "vue";

// TODO: Create a zod schema for this form
const email = ref("");
const username = ref("");
const password = ref("");
const passwordConfirm = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const usernameError = ref("");
const passwordMatchError = ref("");
const showPassword = ref(false);

// TODO: Revisit this and see if we want to keep the immedate reactivity or only have this run on submit
// Might move this to zod instead
watch([password, passwordConfirm], () => {
  if (
    password.value &&
    passwordConfirm.value &&
    password.value !== passwordConfirm.value
  ) {
    passwordMatchError.value = "Passwords don't match";
  } else {
    passwordMatchError.value = "";
  }
});

const handleSubmit = () => {
  errorMessage.value = "";
  usernameError.value = "";
  passwordMatchError.value = "";

  if (password.value !== passwordConfirm.value) {
    passwordMatchError.value = "Passwords don't match";
    return;
  }

  isLoading.value = true;

  setTimeout(() => {
    isLoading.value = false;

    if (username.value.toLowerCase() === "supplyuser123") {
      usernameError.value = "Username unavailable";
      return;
    }

    errorMessage.value = "Invalid credentials";
  }, 1500);
};

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};
</script>

<template>
  <div
    class="h-full overflow-y-scroll max-w-screen px-4 py-2 flex flex-col items-center justify-center"
  >
    <div
      class="card w-full max-w-md bg-base-100 shadow-xl border-solid border-1 border-base-300"
    >
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">Sign up</h2>

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

          <div class="form-control w-full mb-4">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="SupplyUser123"
              class="input input-bordered w-full"
              :class="{ 'input-error': usernameError }"
              required
            />
            <div
              v-if="usernameError"
              class="label"
            >
              <span class="label-text text-error">{{ usernameError }}</span>
            </div>
          </div>

          <div class="form-control w-full mb-4">
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

          <div class="form-control w-full mb-6">
            <label class="label">
              <span class="label-text">Confirm password</span>
            </label>
            <div class="relative">
              <input
                v-model="passwordConfirm"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="input input-bordered w-full pr-10"
                :class="{ 'input-error': passwordMatchError }"
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
            <div
              v-if="passwordMatchError"
              class="label"
            >
              <span class="label-text text-error">{{
                passwordMatchError
              }}</span>
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
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
    <p class="text-sm mt-8 text-center">
      Already have an account?
      <br />
      <RouterLink
        to="/sign-in"
        class="link link-secondary"
        >Sign in instead</RouterLink
      >
    </p>
  </div>
</template>
