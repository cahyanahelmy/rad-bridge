<template>
  <div class="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
    <!-- Background gradient effects -->
    <div class="absolute inset-0">
      <div class="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary-600/10 rounded-full blur-[120px]"></div>
      <div class="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-primary-800/10 rounded-full blur-[120px]"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 rounded-full blur-[100px]"></div>
    </div>

    <!-- Login Card -->
    <div class="relative w-full max-w-md mx-4">
      <div class="glass-card p-8 shadow-2xl shadow-black/20">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-600/20 rounded-2xl mb-4 border border-primary-500/20">
            <svg class="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-white">
            <span class="text-primary-400">RIS</span> Bridge
          </h1>
          <p class="text-dark-400 mt-2 text-sm">SATUSEHAT Imaging Interoperability</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label for="username" class="block text-sm font-medium text-dark-300 mb-1.5">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              class="input-field"
              placeholder="Enter your username"
              required
              autocomplete="username"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-dark-300 mb-1.5">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              class="input-field"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            />
          </div>

          <!-- Error message -->
          <div v-if="error" class="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-sm text-rose-400">
            {{ error }}
          </div>

          <button
            type="submit"
            class="btn-primary w-full flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <!-- Footer -->
        <div class="mt-8 pt-6 border-t border-white/5 text-center">
          <p class="text-xs text-dark-600">Healthcare Imaging Interoperability Platform</p>
          <p class="text-xs text-dark-700 mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  error.value = '';
  loading.value = true;

  try {
    await authStore.login(username.value, password.value);
    router.push({ name: 'dashboard' });
  } catch (err: any) {
    error.value = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
  } finally {
    loading.value = false;
  }
}
</script>
