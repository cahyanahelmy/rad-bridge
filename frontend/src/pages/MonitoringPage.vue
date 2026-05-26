<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Monitoring & Infrastructure</h1>
        <p class="text-dark-400 text-sm mt-1">Real-time system connectivity, container orchestration, queues, and webhook callback logs</p>
      </div>
      <button @click="refreshAll" class="btn-secondary text-sm flex items-center gap-2" :disabled="loading">
        <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" /></svg>
        <span>Refresh All</span>
      </button>
    </div>

    <!-- Status Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Connectivity Card -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
        <h2 class="font-semibold text-white text-sm tracking-wide uppercase text-dark-400">System Connectivity</h2>
        <div class="space-y-3">
          <div v-for="(check, name) in connectivity" :key="name" class="flex items-center justify-between p-3 bg-dark-900/30 rounded-lg border border-dark-700/30">
            <div>
              <p class="text-sm font-medium text-dark-200 capitalize">{{ name }}</p>
              <p v-if="check.latency" class="text-dark-500 text-xs mt-0.5">{{ check.latency }}ms latency</p>
            </div>
            <div class="flex items-center gap-2">
              <span :class="check.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'" class="text-xs font-semibold px-2 py-0.5 rounded-full border">
                {{ check.status === 'connected' ? 'Connected' : 'Disconnected' }}
              </span>
              <div class="pulse-dot">
                <span :class="check.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'"></span>
                <span :class="check.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Container Management Card -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
        <h2 class="font-semibold text-white text-sm tracking-wide uppercase text-dark-400">Container Management</h2>
        <div class="p-3 bg-dark-900/30 rounded-lg border border-dark-700/30 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-dark-200">DICOM Router</p>
              <p class="text-dark-500 text-xs mt-0.5">Container: <span class="font-mono text-dark-300">{{ routerInfo.router?.container || '—' }}</span></p>
            </div>
            <span :class="routerInfo.router?.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'" class="text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider">
              {{ routerInfo.router?.status || 'unknown' }}
            </span>
          </div>

          <div class="flex gap-2 pt-2">
            <button @click="execAction('start')" class="btn-primary text-xs flex-1 py-2" :disabled="actionLoading || routerInfo.router?.status === 'running'">Start</button>
            <button @click="execAction('stop')" class="btn-danger text-xs flex-1 py-2" :disabled="actionLoading || routerInfo.router?.status !== 'running'">Stop</button>
            <button @click="execAction('restart')" class="btn-secondary text-xs flex-1 py-2" :disabled="actionLoading">Restart</button>
          </div>

          <p class="text-dark-500 text-[10px] pt-1">
            Container Engine: <span class="font-semibold text-dark-300 capitalize">{{ routerInfo.runtime?.runtime || '—' }}</span>
            <span v-if="routerInfo.runtime?.version" class="text-dark-400"> ({{ routerInfo.runtime?.version }})</span>
          </p>
        </div>

        <div v-if="actionResult" class="p-3 rounded-lg border text-xs" :class="actionResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'">
          <span class="font-semibold">{{ actionResult.success ? '✓' : '✗' }} {{ actionResult.action }}</span>
          {{ actionResult.success ? 'completed successfully.' : 'failed.' }}
          <p v-if="actionResult.error" class="mt-1 text-dark-400 font-mono break-all">{{ actionResult.error }}</p>
        </div>
      </div>

      <!-- Queue Status Card -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
        <h2 class="font-semibold text-white text-sm tracking-wide uppercase text-dark-400">Queue Workers (BullMQ)</h2>
        <div class="grid grid-cols-1 gap-3">
          <div v-for="queue in queueStats" :key="queue.name" class="p-3 bg-dark-900/30 rounded-lg border border-dark-700/30">
            <p class="text-xs font-semibold text-dark-200 font-mono">{{ queue.name }}</p>
            <div class="grid grid-cols-4 gap-2 mt-2 text-[10px] text-center text-dark-400">
              <div class="bg-dark-950/40 p-1 rounded"><span class="block text-amber-400 font-semibold">{{ queue.waiting || 0 }}</span> wait</div>
              <div class="bg-dark-950/40 p-1 rounded"><span class="block text-primary-400 font-semibold">{{ queue.active || 0 }}</span> actv</div>
              <div class="bg-dark-950/40 p-1 rounded"><span class="block text-emerald-400 font-semibold">{{ queue.completed || 0 }}</span> comp</div>
              <div class="bg-dark-950/40 p-1 rounded"><span class="block text-rose-400 font-semibold">{{ queue.failed || 0 }}</span> fail</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Storage & Retention Section -->
    <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-6 shadow-xl">
      <div class="flex items-center justify-between border-b border-dark-700 pb-3">
        <div>
          <h2 class="font-semibold text-white text-base">Storage & Retention Policy</h2>
          <p class="text-xs text-dark-400 mt-0.5">RIS Bridge operates as a temporary interoperability buffer with bounded FIFO cleanup (Limit: {{ storageStats.limitGb }} GB)</p>
        </div>
        <span class="badge badge-info">Appliance Mode</span>
      </div>

      <!-- Storage Metrics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Card 1: Used Storage -->
        <div class="bg-dark-900/40 p-4 rounded-xl border border-dark-700/30">
          <p class="text-xs text-dark-400 uppercase font-semibold">Total Storage Used</p>
          <p class="text-2xl font-bold text-white mt-1">{{ storageStats.totalUsedGb }} GB</p>
          <div class="w-full bg-dark-700 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              class="bg-primary-500 h-1.5 rounded-full transition-all duration-500" 
              :style="{ width: `${Math.min(100, (storageStats.totalUsedGb / (storageStats.limitGb || 1)) * 100)}%` }"
            ></div>
          </div>
          <p class="text-[10px] text-dark-500 mt-1.5">{{ ((storageStats.totalUsedGb / (storageStats.limitGb || 1)) * 100).toFixed(1) }}% of {{ storageStats.limitGb }} GB limit</p>
        </div>

        <!-- Card 2: Available Storage -->
        <div class="bg-dark-900/40 p-4 rounded-xl border border-dark-700/30">
          <p class="text-xs text-dark-400 uppercase font-semibold">Available Buffer</p>
          <p class="text-2xl font-bold text-emerald-400 mt-1">{{ storageStats.availableGb }} GB</p>
          <div class="mt-4 flex items-center gap-1.5 text-[10px] text-emerald-400/80">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Storage is self-maintaining</span>
          </div>
        </div>

        <!-- Card 3: Completed / Failed Split -->
        <div class="bg-dark-900/40 p-4 rounded-xl border border-dark-700/30 space-y-2.5">
          <div>
            <div class="flex justify-between text-xs">
              <span class="text-dark-400 font-medium">Completed Studies</span>
              <span class="text-white font-semibold">{{ storageStats.completedUsedMb }} MB</span>
            </div>
            <div class="w-full bg-dark-700 h-1 rounded-full mt-1.5 overflow-hidden">
              <div 
                class="bg-emerald-500 h-1 rounded-full" 
                :style="{ width: `${storageStats.totalUsedBytes && BigInt(storageStats.totalUsedBytes) > 0 ? (Number(storageStats.completedUsedBytes) / Number(storageStats.totalUsedBytes)) * 100 : 0}%` }"
              ></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-xs">
              <span class="text-dark-400 font-medium">Failed Uploads</span>
              <span class="text-rose-400 font-semibold">{{ storageStats.failedUsedMb }} MB</span>
            </div>
            <div class="w-full bg-dark-700 h-1 rounded-full mt-1.5 overflow-hidden">
              <div 
                class="bg-rose-500 h-1 rounded-full" 
                :style="{ width: `${storageStats.totalUsedBytes && BigInt(storageStats.totalUsedBytes) > 0 ? (Number(storageStats.failedUsedBytes) / Number(storageStats.totalUsedBytes)) * 100 : 0}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Card 4: Cleaned Stats -->
        <div class="bg-dark-900/40 p-4 rounded-xl border border-dark-700/30">
          <p class="text-xs text-dark-400 uppercase font-semibold">FIFO Cleanup Executions</p>
          <p class="text-2xl font-bold text-amber-400 mt-1">{{ storageStats.cleanupCount }} Studies</p>
          <div class="mt-4 flex items-center justify-between text-[10px] text-dark-500">
            <span>Deleted Study Count</span>
            <span class="font-mono text-dark-300 font-semibold">{{ storageStats.deletedStudyCount }}</span>
          </div>
        </div>
      </div>

      <!-- Detail tables -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
        <!-- Candidates / Top sizes -->
        <div class="bg-dark-900/30 rounded-xl border border-dark-700/30 overflow-hidden">
          <div class="px-4 py-3 bg-dark-800/40 border-b border-dark-700/30 flex items-center justify-between">
            <h3 class="font-semibold text-white text-xs uppercase tracking-wider">Pemeriksaan Terbesar & Tertua (Aktif)</h3>
            <span class="badge badge-info text-[9px]">Retention Candidates</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead>
                <tr class="bg-dark-950/20 text-dark-400 text-[10px] uppercase border-b border-dark-800">
                  <th class="px-4 py-2.5">Accession</th>
                  <th class="px-4 py-2.5">Pasien</th>
                  <th class="px-4 py-2.5">Pemeriksaan</th>
                  <th class="px-4 py-2.5">Ukuran</th>
                  <th class="px-4 py-2.5">Tanggal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-dark-850">
                <tr v-for="study in storageStats.largestStudies" :key="study.id" class="hover:bg-dark-800/20">
                  <td class="px-4 py-2.5 font-mono text-primary-400 font-semibold">{{ study.accessionNumber }}</td>
                  <td class="px-4 py-2.5 text-white">{{ study.patientName || '—' }}</td>
                  <td class="px-4 py-2.5 text-dark-400">{{ study.examName || '—' }}</td>
                  <td class="px-4 py-2.5 text-white font-medium">{{ study.totalStorageMb }} MB</td>
                  <td class="px-4 py-2.5 text-dark-500">{{ formatDateShort(study.createdAt) }}</td>
                </tr>
                <tr v-if="!storageStats.largestStudies?.length">
                  <td colspan="5" class="text-center text-dark-600 py-6 italic">No active study storage usage.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Retention History -->
        <div class="bg-dark-900/30 rounded-xl border border-dark-700/30 overflow-hidden">
          <div class="px-4 py-3 bg-dark-800/40 border-b border-dark-700/30 flex items-center justify-between">
            <h3 class="font-semibold text-white text-xs uppercase tracking-wider">Riwayat Pembersihan FIFO</h3>
            <span class="badge badge-warning text-[9px]">Reclaimed Storage</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead>
                <tr class="bg-dark-950/20 text-dark-400 text-[10px] uppercase border-b border-dark-800">
                  <th class="px-4 py-2.5">Accession</th>
                  <th class="px-4 py-2.5">Pasien</th>
                  <th class="px-4 py-2.5">Alasan</th>
                  <th class="px-4 py-2.5">Ukuran Reclaimed</th>
                  <th class="px-4 py-2.5">Tanggal Hapus</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-dark-850">
                <tr v-for="hist in storageStats.retentionHistory" :key="hist.id" class="hover:bg-dark-800/20">
                  <td class="px-4 py-2.5 font-mono text-dark-400 font-semibold">{{ hist.accessionNumber }}</td>
                  <td class="px-4 py-2.5 text-dark-300">{{ hist.patientName || '—' }}</td>
                  <td class="px-4 py-2.5">
                    <span :class="hist.deletionReason === 'RETENTION_POLICY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'" class="px-2 py-0.5 rounded text-[10px] font-medium font-mono uppercase">
                      {{ hist.deletionReason }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-dark-300">{{ hist.totalStorageMb }} MB</td>
                  <td class="px-4 py-2.5 text-dark-500">{{ formatDateShort(hist.filesDeletedAt) }}</td>
                </tr>
                <tr v-if="!storageStats.retentionHistory?.length">
                  <td colspan="5" class="text-center text-dark-600 py-6 italic">No storage cleanups executed yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Webhooks & Logs Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Webhook Callback Logs -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden flex flex-col h-[480px]">
        <div class="px-5 py-4 border-b border-dark-700/50 flex items-center justify-between shrink-0">
          <h2 class="font-semibold text-white">Recent Webhook Callbacks</h2>
          <span class="text-xs text-dark-500 font-mono">POST /api/dicom-router/callback</span>
        </div>
        <div class="flex-1 overflow-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Accession</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in webhookLogs" :key="log.id">
                <td class="font-mono text-primary-400 text-sm font-semibold">{{ log.accessionNumber || '—' }}</td>
                <td>
                  <span :class="log.status === 'paired' ? 'badge badge-success' : 'badge badge-warning'">
                    {{ log.status }}
                  </span>
                </td>
                <td class="text-dark-400 text-xs">{{ formatDate(log.createdAt) }}</td>
              </tr>
              <tr v-if="!webhookLogs.length">
                <td colspan="3" class="text-center text-dark-500 py-12">No webhooks received yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Container Logs -->
      <div class="bg-dark-950 border border-dark-700/50 rounded-xl overflow-hidden flex flex-col h-[480px]">
        <div class="px-5 py-3 border-b border-dark-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-dark-300 text-sm">Container Output Logs</h2>
            <span class="bg-dark-850 px-2 py-0.5 rounded text-[10px] text-dark-400 font-mono">Tail: 200 lines</span>
          </div>
          <button @click="refreshLogs" class="text-primary-400 hover:text-primary-300 text-xs font-semibold">
            Refresh Logs
          </button>
        </div>
        <div class="flex-1 p-4 overflow-auto font-mono text-xs text-dark-300 bg-dark-950 whitespace-pre-wrap select-all">
          <pre v-if="containerLogs">{{ containerLogs }}</pre>
          <p v-else class="text-dark-500 text-center py-20 italic">No log entries available or loading...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/api/client';

const loading = ref(false);
const connectivity = ref<any>({});
const queueStats = ref<any[]>([]);
const routerInfo = ref<any>({});
const webhookLogs = ref<any[]>([]);
const containerLogs = ref('');
const storageStats = ref<any>({
  limitGb: 0,
  totalUsedGb: 0,
  availableGb: 0,
  completedUsedMb: 0,
  failedUsedMb: 0,
  cleanupCount: 0,
  deletedStudyCount: 0,
  largestStudies: [],
  oldestStudies: [],
  retentionHistory: [],
});

const actionLoading = ref(false);
const actionResult = ref<any>(null);

onMounted(refreshAll);

async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([
      loadConnectivity(),
      loadQueues(),
      loadStatus(),
      loadWebhooks(),
      loadStorageStats(),
      refreshLogs(),
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadConnectivity() {
  try {
    const { data } = await apiClient.get('/api/monitoring/connectivity');
    connectivity.value = data.data;
  } catch (err) { console.error(err); }
}

async function loadQueues() {
  try {
    const { data } = await apiClient.get('/api/monitoring/queues');
    queueStats.value = data.data;
  } catch (err) { console.error(err); }
}

async function loadStatus() {
  try {
    const { data } = await apiClient.get('/api/infrastructure/status');
    routerInfo.value = data.data;
  } catch (err) { console.error(err); }
}

async function loadWebhooks() {
  try {
    const { data } = await apiClient.get('/api/monitoring/webhooks');
    webhookLogs.value = data.data;
  } catch (err) { console.error(err); }
}

async function loadStorageStats() {
  try {
    const { data } = await apiClient.get('/api/monitoring/storage');
    storageStats.value = data.data;
  } catch (err) { console.error(err); }
}

function formatDateShort(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function refreshLogs() {
  try {
    const { data } = await apiClient.get('/api/infrastructure/logs?tail=200');
    containerLogs.value = data.data.logs;
  } catch (err) {
    containerLogs.value = 'Failed to load container logs';
  }
}

async function execAction(action: string) {
  actionLoading.value = true;
  actionResult.value = null;
  try {
    const { data } = await apiClient.post(`/api/infrastructure/${action}`);
    actionResult.value = data.data;
    // Wait 2s and refresh container status and logs
    setTimeout(async () => {
      await Promise.all([loadStatus(), refreshLogs()]);
    }, 2000);
  } catch (err: any) {
    actionResult.value = {
      success: false,
      action,
      error: err.response?.data?.error?.message || err.message,
    };
  } finally {
    actionLoading.value = false;
  }
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
</script>
