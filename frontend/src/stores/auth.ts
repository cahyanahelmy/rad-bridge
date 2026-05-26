import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/api/client';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!accessToken.value);

  async function login(username: string, password: string) {
    const { data } = await apiClient.post('/api/auth/login', { username, password });
    const result = data.data;

    accessToken.value = result.accessToken;
    refreshToken.value = result.refreshToken;
    user.value = result.user;

    localStorage.setItem('accessToken', result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    localStorage.setItem('user', JSON.stringify(result.user));
  }

  async function refresh() {
    if (!refreshToken.value) throw new Error('No refresh token');

    const { data } = await apiClient.post('/api/auth/refresh', {
      refreshToken: refreshToken.value,
    });

    accessToken.value = data.data.accessToken;
    localStorage.setItem('accessToken', data.data.accessToken);
  }

  function logout() {
    if (refreshToken.value) {
      apiClient.post('/api/auth/logout', { refreshToken: refreshToken.value }).catch(() => {});
    }

    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  return { accessToken, refreshToken, user, isAuthenticated, login, refresh, logout };
});
