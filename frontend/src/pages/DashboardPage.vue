<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-white">Dashboard</h1>
      <p class="text-dark-400 text-sm mt-1">Radiology Command Center</p>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <p class="text-dark-400 text-sm">Total Orders</p>
          <div class="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-3">{{ stats.totalOrders }}</p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <p class="text-dark-400 text-sm">Pending Upload</p>
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-3">{{ stats.pendingOrders }}</p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <p class="text-dark-400 text-sm">Completed</p>
          <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-3">{{ stats.completedOrders }}</p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <p class="text-dark-400 text-sm">Success Rate</p>
          <div class="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-3">{{ stats.successRate }}%</p>
      </div>
    </div>

    <!-- Recent Orders Table -->
    <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden">
      <div class="px-5 py-4 border-b border-dark-700/50 flex items-center justify-between">
        <h2 class="font-semibold text-white">Recent Orders</h2>
        <router-link to="/orders" class="text-sm text-primary-400 hover:text-primary-300 transition-colors">View all →</router-link>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Accession</th>
            <th>Exam</th>
            <th>Patient</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in stats.recentOrders" :key="order.id">
            <td class="font-mono text-primary-400 text-sm">{{ order.accessionNumber }}</td>
            <td>{{ order.exam?.examName }}</td>
            <td>{{ order.patientName || order.mrn || '—' }}</td>
            <td>
              <span :class="statusBadgeClass(order.status)">{{ order.status }}</span>
            </td>
            <td class="text-dark-400 text-sm">{{ formatDate(order.createdAt) }}</td>
          </tr>
          <tr v-if="!stats.recentOrders?.length">
            <td colspan="5" class="text-center text-dark-500 py-8">No orders yet</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/api/client';

const stats = ref<any>({
  totalOrders: 0,
  pendingOrders: 0,
  completedOrders: 0,
  failedOrders: 0,
  successRate: 0,
  totalReports: 0,
  recentOrders: [],
});

onMounted(async () => {
  try {
    const { data } = await apiClient.get('/api/monitoring/dashboard');
    stats.value = data.data;
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
});

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    WAITING_UPLOAD: 'badge badge-warning',
    DICOM_RECEIVED: 'badge badge-info',
    IMAGING_CREATED: 'badge badge-info',
    REPORT_CREATED: 'badge badge-success',
    FAILED: 'badge badge-danger',
  };
  return map[status] || 'badge badge-info';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>
