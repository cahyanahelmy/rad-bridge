<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">User Management</h1>
        <p class="text-dark-400 text-sm mt-1">Manage system users and roles</p>
      </div>
      <button @click="showCreateModal = true" class="btn-primary text-sm">+ Add User</button>
    </div>

    <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="font-medium text-dark-200">{{ user.username }}</td>
            <td>{{ user.fullName }}</td>
            <td><span class="badge badge-info">{{ user.role }}</span></td>
            <td><span :class="user.active ? 'badge badge-success' : 'badge badge-danger'">{{ user.active ? 'Active' : 'Inactive' }}</span></td>
            <td class="text-dark-400 text-sm">{{ formatDate(user.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal (simplified) -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="text-lg font-bold text-white mb-4">Create User</h3>
        <form @submit.prevent="createUser" class="space-y-4">
          <div>
            <label class="block text-sm text-dark-300 mb-1">Username</label>
            <input v-model="newUser.username" class="input-field" required />
          </div>
          <div>
            <label class="block text-sm text-dark-300 mb-1">Full Name</label>
            <input v-model="newUser.fullName" class="input-field" required />
          </div>
          <div>
            <label class="block text-sm text-dark-300 mb-1">Password</label>
            <input v-model="newUser.password" type="password" class="input-field" required />
          </div>
          <div>
            <label class="block text-sm text-dark-300 mb-1">Role</label>
            <select v-model="newUser.role" class="input-field">
              <option value="ADMIN">Admin</option>
              <option value="RADIOGRAPHER">Radiographer</option>
              <option value="RADIOLOGIST">Radiologist</option>
            </select>
          </div>
          <div class="flex gap-3 justify-end pt-2">
            <button type="button" @click="showCreateModal = false" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/api/client';

const users = ref<any[]>([]);
const showCreateModal = ref(false);
const newUser = ref({ username: '', fullName: '', password: '', role: 'RADIOGRAPHER' });

onMounted(loadUsers);

async function loadUsers() {
  try {
    const { data } = await apiClient.get('/api/users');
    users.value = data.data;
  } catch (err) { console.error(err); }
}

async function createUser() {
  try {
    await apiClient.post('/api/users', newUser.value);
    showCreateModal.value = false;
    newUser.value = { username: '', fullName: '', password: '', role: 'RADIOGRAPHER' };
    await loadUsers();
  } catch (err: any) {
    alert(err.response?.data?.error?.message || 'Failed to create user');
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
</script>
