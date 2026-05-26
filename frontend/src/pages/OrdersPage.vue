<template>
  <div class="p-6 space-y-6">
    <!-- MASTER LIST VIEW -->
    <div v-if="!selectedOrderId" class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Orders Workflow</h1>
          <p class="text-dark-400 text-sm mt-1">SIMRS radiology orders tracking and execution command center</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Search Bar -->
          <div class="relative min-w-[240px]">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-dark-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              v-model="searchQuery"
              @input="debouncedSearch"
              type="text"
              class="input-field pl-9 py-2 text-sm"
              placeholder="Search Name or MRN..."
            />
          </div>

          <!-- Status Filter -->
          <select v-model="statusFilter" @change="loadOrders" class="input-field w-auto py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="WAITING_UPLOAD">Waiting Upload</option>
            <option value="DICOM_RECEIVED">DICOM Received</option>
            <option value="IMAGING_CREATED">Imaging Created</option>
            <option value="REPORT_CREATED">Report Created</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <!-- Orders Data Table -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden">
        <table class="data-table">
          <thead>
            <tr>
              <th>Accession</th>
              <th>MRN</th>
              <th>Patient Name</th>
              <th>Service Type</th>
              <th>Status</th>
              <th>Ordered At</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in orders"
              :key="order.id"
              @click="selectOrder(order.id)"
              class="cursor-pointer hover:bg-dark-750/30 transition-colors"
            >
              <td class="font-mono text-primary-400 text-sm font-semibold">{{ order.accessionNumber }}</td>
              <td class="text-dark-300 font-mono text-sm">{{ order.mrn || '—' }}</td>
              <td class="text-white font-medium">
                {{ order.patientNameSimrs || order.patientName || '—' }}
              </td>
              <td class="text-dark-300">
                <span class="bg-dark-700/40 text-dark-300 text-[10px] font-semibold px-2 py-0.5 rounded font-mono mr-1.5 uppercase">
                  {{ order.exam?.modalityCode || '—' }}
                </span>
                {{ order.exam?.examName || '—' }}
              </td>
              <td>
                <span :class="statusClass(order.status)">
                  {{ formatStatus(order.status) }}
                </span>
              </td>
              <td class="text-dark-400 text-xs font-mono">{{ formatDate(order.timeOrdered || order.createdAt) }}</td>
              <td class="text-right">
                <button class="text-primary-400 hover:text-primary-300 text-xs font-semibold">
                  Open Details →
                </button>
              </td>
            </tr>
            <tr v-if="!orders.length">
              <td colspan="7" class="text-center text-dark-500 py-16 italic">
                {{ loading ? 'Loading orders...' : 'No radiology orders found matching current criteria.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- DETAIL VIEW -->
    <div v-else-if="selectedOrder" class="space-y-6">
      <!-- Breadcrumb / Navigation -->
      <div class="flex items-center justify-between border-b border-dark-800 pb-4">
        <div class="flex items-center gap-3">
          <button @click="backToList" class="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span>Back to List</span>
          </button>
          <div class="h-4 w-px bg-dark-700"></div>
          <div>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="font-mono text-primary-400">{{ selectedOrder.accessionNumber }}</span>
              <span :class="statusClass(selectedOrder.status)">{{ formatStatus(selectedOrder.status) }}</span>
            </h1>
          </div>
        </div>
        <button @click="loadOrderDetail(selectedOrderId)" class="btn-secondary text-xs p-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" /></svg>
        </button>
      </div>

      <!-- Master Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- LEFT: Patient & Order Info (1 col) -->
        <div class="space-y-6 lg:col-span-1">
          <!-- Information Card -->
          <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
            <h3 class="text-xs font-semibold text-dark-400 tracking-wider uppercase">Order Details</h3>
            <div class="space-y-3 text-sm">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-dark-500 text-xs">Patient Name (SIMRS)</p>
                  <p class="text-white font-medium">{{ selectedOrder.patientNameSimrs || '—' }}</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">Patient Name (SATUSEHAT)</p>
                  <p class="text-white font-medium">{{ selectedOrder.patientName || '—' }}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-dark-500 text-xs">Medical Record (MRN)</p>
                  <p class="text-dark-200 font-mono">{{ selectedOrder.mrn || '—' }}</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">Patient ID (SATUSEHAT)</p>
                  <p class="text-dark-300 truncate font-mono text-xs" :title="selectedOrder.patientId">{{ selectedOrder.patientId || '—' }}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-dark-500 text-xs">Ordered At</p>
                  <p class="text-white font-medium font-mono text-xs mt-0.5">{{ formatDate(selectedOrder.timeOrdered || selectedOrder.createdAt) }}</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">Procedure Code</p>
                  <p class="text-dark-200 font-mono text-xs mt-0.5">{{ selectedOrder.examCode }}</p>
                </div>
              </div>
              <div>
                <p class="text-dark-500 text-xs">Exam Description</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="inline-block bg-primary-950 text-primary-400 border border-primary-900 text-xs font-bold font-mono px-2 py-0.5 rounded">
                    {{ selectedOrder.exam?.modalityCode || '—' }}
                  </span>
                  <p class="text-dark-200 text-sm font-medium">{{ selectedOrder.exam?.examName || '—' }}</p>
                </div>
              </div>
              <div class="border-t border-dark-700/50 pt-3 space-y-2">
                <div>
                  <p class="text-dark-500 text-[10px] uppercase font-semibold">SATUSEHAT Resource IDs</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">Encounter ID</p>
                  <p class="text-dark-300 font-mono text-xs truncate" :title="selectedOrder.encounterId">{{ selectedOrder.encounterId || '—' }}</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">ServiceRequest ID</p>
                  <p class="text-dark-300 font-mono text-xs truncate" :title="selectedOrder.serviceRequestId || '—'">{{ selectedOrder.serviceRequestId || 'Pending/Failed' }}</p>
                </div>
                <div>
                  <p class="text-dark-500 text-xs">ImagingStudy ID</p>
                  <p class="text-dark-300 font-mono text-xs truncate" :title="selectedOrder.imagingstudyId || '—'">{{ selectedOrder.imagingstudyId || 'Pending Callback' }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Upload & Diagnostic Report (2 cols) -->
        <div class="space-y-6 lg:col-span-2">
          <!-- 1. DICOM Upload Zone (Only show if not complete / pending upload) -->
          <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
            <h3 class="text-xs font-semibold text-dark-400 tracking-wider uppercase">DICOM Uploader</h3>

            <!-- Drop Zone -->
            <div
              v-if="selectedOrder.status !== 'REPORT_CREATED'"
              class="upload-zone"
              :class="{ active: isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input ref="fileInput" type="file" accept=".dcm" class="hidden" @change="handleFileSelect" />

              <div v-if="!selectedFile">
                <svg class="w-12 h-12 mx-auto text-dark-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p class="text-dark-300 text-sm font-medium">Drop DICOM (.dcm) file here or click to browse</p>
                <p class="text-dark-500 text-xs mt-1">Upload DICOM file for accession number {{ selectedOrder.accessionNumber }}</p>
              </div>
              <div v-else class="space-y-1">
                <svg class="w-10 h-10 mx-auto text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-primary-400 text-sm font-medium">{{ selectedFile.name }}</p>
                <p class="text-dark-500 text-xs">{{ formatSize(selectedFile.size) }}</p>
              </div>
            </div>

            <!-- Upload controls -->
            <div v-if="selectedFile && selectedOrder.status !== 'REPORT_CREATED'" class="flex items-center gap-3">
              <button
                @click="uploadFile"
                class="btn-primary text-xs py-2 px-4 flex items-center gap-2"
                :disabled="uploading"
              >
                <svg v-if="uploading" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                {{ uploading ? 'Uploading File...' : 'Upload DICOM' }}
              </button>
              <button @click="clearFile" class="btn-secondary text-xs py-2 px-4" :disabled="uploading">Clear</button>
            </div>

            <div v-if="uploadResult" class="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
              ✓ DICOM file uploaded successfully! Enqueued for metadata processing.
            </div>

            <div v-if="uploadError" class="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-xs text-rose-400">
              ✗ {{ uploadError }}
            </div>

            <!-- Uploaded Files List -->
            <div class="border-t border-dark-700/50 pt-4 space-y-2">
              <p class="text-[11px] font-semibold text-dark-400 uppercase">Uploaded DICOM Files</p>
              <div v-if="selectedOrder.dicomFiles?.length" class="overflow-x-auto max-h-40 border border-dark-700/30 rounded-lg">
                <table class="w-full text-left text-xs bg-dark-900/30">
                  <thead class="bg-dark-800 text-dark-400 font-medium">
                    <tr>
                      <th class="p-2">Filename</th>
                      <th class="p-2">Size</th>
                      <th class="p-2 text-center">Injected</th>
                      <th class="p-2 text-center">Sent to Router</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-dark-800/40 text-dark-300">
                    <tr v-for="file in selectedOrder.dicomFiles" :key="file.id">
                      <td class="p-2 truncate max-w-[200px]" :title="file.fileName">{{ file.fileName }}</td>
                      <td class="p-2">{{ formatSize(Number(file.fileSize)) }}</td>
                      <td class="p-2 text-center">
                        <span :class="file.processed ? 'text-emerald-400' : 'text-amber-400'">{{ file.processed ? '✓ Yes' : 'No' }}</span>
                      </td>
                      <td class="p-2 text-center">
                        <span :class="file.sentToRouter ? 'text-emerald-400' : 'text-amber-400'">{{ file.sentToRouter ? '✓ Sent' : 'Queued' }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="text-xs text-dark-500 italic">No DICOM files have been uploaded yet for this order.</p>
            </div>
          </div>

          <!-- 2. Diagnostic Report Form or Display -->
          <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl p-5 space-y-4">
            <h3 class="text-xs font-semibold text-dark-400 tracking-wider uppercase">Radiology Diagnostic Report</h3>

            <!-- State A: Report Created -->
            <div v-if="selectedOrder.status === 'REPORT_CREATED'" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-dark-900/40 p-3 rounded-lg border border-dark-700/30">
                  <p class="text-dark-500 text-xs">Diagnostic Report ID (SATUSEHAT)</p>
                  <p class="text-primary-400 font-mono text-sm font-semibold select-all mt-0.5 truncate" :title="selectedOrder.diagnosticreportId">
                    {{ selectedOrder.diagnosticreportId || '—' }}
                  </p>
                </div>
                <div class="bg-dark-900/40 p-3 rounded-lg border border-dark-700/30 flex items-center justify-between">
                  <div>
                    <p class="text-dark-500 text-xs">SATUSEHAT Status</p>
                    <p class="text-emerald-400 font-medium mt-0.5">Synced successfully</p>
                  </div>
                  <span class="badge badge-success text-[10px] uppercase tracking-wider">final</span>
                </div>
              </div>

              <div class="space-y-2">
                <label class="block text-xs font-semibold text-dark-400 uppercase">Findings (Observation)</label>
                <div class="bg-dark-900/60 p-4 rounded-lg border border-dark-750 text-dark-200 text-sm whitespace-pre-wrap leading-relaxed">
                  {{ selectedOrder.observation || 'No findings recorded.' }}
                </div>
              </div>

              <div class="space-y-2">
                <label class="block text-xs font-semibold text-dark-400 uppercase">Conclusion (Diagnostic Report)</label>
                <div class="bg-dark-900/60 p-4 rounded-lg border border-dark-750 text-white font-medium text-sm whitespace-pre-wrap leading-relaxed">
                  {{ selectedOrder.diagnosticReport || 'No conclusion recorded.' }}
                </div>
              </div>
            </div>

            <!-- State B: Eligible for Report creation -->
            <div v-else-if="selectedOrder.status === 'IMAGING_CREATED'" class="space-y-4">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-dark-300">Findings (Observation)</label>
                <textarea
                  v-model="observationInput"
                  rows="5"
                  class="input-field"
                  placeholder="Describe detailed radiological findings here..."
                ></textarea>
              </div>

              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-dark-300">Conclusion (Diagnostic Report)</label>
                <textarea
                  v-model="diagnosticReportInput"
                  rows="3"
                  class="input-field"
                  placeholder="Draft final diagnostic conclusion / impression here..."
                ></textarea>
              </div>

              <div class="flex justify-end">
                <button
                  @click="submitReport"
                  class="btn-primary text-xs py-2.5 px-6 flex items-center gap-2"
                  :disabled="!observationInput || !diagnosticReportInput || reportSubmitting"
                >
                  <svg v-if="reportSubmitting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Submit Diagnostic Report
                </button>
              </div>

              <div v-if="reportError" class="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-xs text-rose-400">
                ✗ {{ reportError }}
              </div>
            </div>

            <!-- State C: Not ready for report creation -->
            <div v-else class="p-4 bg-dark-900/30 rounded-lg border border-dark-750 text-center py-8 text-dark-500 text-sm">
              <svg class="w-10 h-10 mx-auto text-dark-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>Diagnostic report drafting will become available once the DICOM study has been received and registered as an ImagingStudy resource in SATUSEHAT.</span>
            </div>

            <!-- Observation & Diagnostic Report from API (read-only, visible from any state if data exists) -->
            <div v-if="selectedOrder.observation || selectedOrder.diagnosticReport" class="border-t border-dark-700/50 pt-4 space-y-3">
              <p class="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">Submitted Clinical Texts</p>
              <div v-if="selectedOrder.observation" class="space-y-1">
                <p class="text-[10px] font-semibold text-dark-500 uppercase">Findings / Observation</p>
                <div class="bg-dark-900/60 p-3 rounded-lg border border-dark-750 text-dark-200 text-xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {{ selectedOrder.observation }}
                </div>
              </div>
              <div v-if="selectedOrder.diagnosticReport" class="space-y-1">
                <p class="text-[10px] font-semibold text-dark-500 uppercase">Conclusion / Diagnostic Report</p>
                <div class="bg-dark-900/60 p-3 rounded-lg border border-dark-750 text-white text-xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {{ selectedOrder.diagnosticReport }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SATUSEHAT Integration Logs -->
      <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-dark-700/50 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-cyan-400"></div>
            <h3 class="text-xs font-semibold text-dark-300 tracking-wider uppercase">SATUSEHAT Integration Logs</h3>
          </div>
          <span class="text-xs text-dark-500">{{ selectedOrder.satusehatLogs?.length || 0 }} entries</span>
        </div>

        <div v-if="!selectedOrder.satusehatLogs?.length" class="py-10 text-center text-dark-500 text-sm italic">
          No SATUSEHAT integration logs yet for this order.
        </div>

        <div v-else class="divide-y divide-dark-700/40">
          <div
            v-for="log in selectedOrder.satusehatLogs"
            :key="log.id"
            class="p-4 space-y-3"
          >
            <!-- Log header -->
            <div class="flex items-center gap-3 flex-wrap">
              <span :class="logResourceClass(log.resourceType)" class="text-[10px] font-bold px-2.5 py-1 rounded font-mono uppercase tracking-wider">
                {{ log.resourceType }}
              </span>
              <span :class="log.status === 'SUCCESS' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'" class="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1">
                <span>{{ log.status === 'SUCCESS' ? '✓' : '✗' }}</span>
                {{ log.status }}
              </span>
              <span class="text-dark-500 text-xs ml-auto">{{ formatDateTime(log.createdAt) }}</span>
            </div>

            <!-- Toggle payload -->
            <div class="space-y-2">
              <button
                @click="toggleLog(log.id)"
                class="flex items-center gap-1.5 text-xs text-dark-400 hover:text-dark-200 transition-colors"
              >
                <svg :class="expandedLogs.has(log.id) ? 'rotate-90' : ''" class="w-3.5 h-3.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                {{ expandedLogs.has(log.id) ? 'Hide' : 'Show' }} payload
              </button>

              <div v-if="expandedLogs.has(log.id)" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div class="space-y-1">
                  <p class="text-[10px] font-semibold text-dark-500 uppercase">Request Body</p>
                  <pre class="bg-dark-900/80 border border-dark-700/40 rounded-lg p-3 text-xs text-dark-300 overflow-auto max-h-64 font-mono leading-relaxed">{{ formatJson(log.requestBody) }}</pre>
                </div>
                <div class="space-y-1">
                  <p class="text-[10px] font-semibold text-dark-500 uppercase">Response Body</p>
                  <pre class="bg-dark-900/80 border border-dark-700/40 rounded-lg p-3 text-xs text-dark-300 overflow-auto max-h-64 font-mono leading-relaxed">{{ formatJson(log.responseBody) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { apiClient } from '@/api/client';

// Search & filter
const loading = ref(false);
const orders = ref<any[]>([]);
const searchQuery = ref('');
const statusFilter = ref('');
let searchTimeout: any = null;

// Selected order details
const selectedOrderId = ref<string | null>(null);
const selectedOrder = ref<any>(null);

// Upload zone states
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const uploading = ref(false);
const uploadResult = ref<any>(null);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement>();

// Report form inputs
const observationInput = ref('');
const diagnosticReportInput = ref('');
const reportSubmitting = ref(false);
const reportError = ref('');

// SATUSEHAT log expansion state
const expandedLogs = reactive(new Set<string>());
function toggleLog(id: string) {
  if (expandedLogs.has(id)) expandedLogs.delete(id);
  else expandedLogs.add(id);
}

onMounted(() => loadOrders());

async function loadOrders() {
  loading.value = true;
  try {
    const params: any = {};
    if (statusFilter.value) params.status = statusFilter.value;
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim();
    const { data } = await apiClient.get('/api/orders', { params });
    orders.value = data.data;
  } catch (err) {
    console.error('Failed to load orders:', err);
  } finally {
    loading.value = false;
  }
}

function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadOrders();
  }, 350);
}

async function selectOrder(id: string) {
  selectedOrderId.value = id;
  await loadOrderDetail(id);
}

async function loadOrderDetail(id: string) {
  try {
    const { data } = await apiClient.get(`/api/orders/${id}`);
    selectedOrder.value = data.data;
    // Reset file uploads
    selectedFile.value = null;
    uploadResult.value = null;
    uploadError.value = '';
    // Reset report forms
    observationInput.value = data.data.observation || '';
    diagnosticReportInput.value = data.data.diagnosticReport || '';
    reportError.value = '';
  } catch (err) {
    console.error('Failed to load order detail:', err);
  }
}

function backToList() {
  selectedOrderId.value = null;
  selectedOrder.value = null;
  loadOrders();
}

// Upload zone logic
function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) selectedFile.value = input.files[0];
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) selectedFile.value = file;
}

function clearFile() {
  selectedFile.value = null;
  uploadResult.value = null;
  uploadError.value = '';
}

async function uploadFile() {
  if (!selectedOrder.value || !selectedFile.value) return;

  uploading.value = true;
  uploadResult.value = null;
  uploadError.value = '';

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    const { data } = await apiClient.post(
      `/api/upload/${selectedOrder.value.accessionNumber}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    uploadResult.value = data.data;
    selectedFile.value = null;
    // Reload order detail after 2 seconds
    setTimeout(() => {
      if (selectedOrderId.value) loadOrderDetail(selectedOrderId.value);
    }, 2000);
  } catch (err: any) {
    uploadError.value = err.response?.data?.error?.message || 'Upload failed';
  } finally {
    uploading.value = false;
  }
}

// Report submission
async function submitReport() {
  if (!selectedOrder.value || reportSubmitting.value) return;

  reportSubmitting.value = true;
  reportError.value = '';

  try {
    await apiClient.post('/api/reports', {
      orderId: selectedOrder.value.id,
      observation: observationInput.value,
      diagnosticReport: diagnosticReportInput.value,
    });
    // Reload order detail
    await loadOrderDetail(selectedOrder.value.id);
  } catch (err: any) {
    reportError.value = err.response?.data?.error?.message || 'Report submission failed';
  } finally {
    reportSubmitting.value = false;
  }
}

// Helper formatting functions
function statusClass(status: string) {
  const map: Record<string, string> = {
    WAITING_UPLOAD: 'badge badge-warning',
    DICOM_RECEIVED: 'badge badge-info',
    IMAGING_CREATED: 'badge badge-info',
    REPORT_CREATED: 'badge badge-success',
    FAILED: 'badge badge-danger',
  };
  return map[status] || 'badge';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    WAITING_UPLOAD: 'Waiting Upload',
    DICOM_RECEIVED: 'DICOM Received',
    IMAGING_CREATED: 'Imaging Created',
    REPORT_CREATED: 'Report Created',
    FAILED: 'Failed',
  };
  return map[status] || status;
}

function formatDateTime(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(raw: string | null | undefined) {
  if (!raw) return '—';
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

function logResourceClass(type: string) {
  const map: Record<string, string> = {
    ServiceRequest: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
    Observation: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    DiagnosticReport: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  };
  return map[type] || 'bg-dark-700/40 text-dark-300 border border-dark-600/40';
}

function formatDate(d: string | Date) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';

  const year = date.getFullYear();
  const month = date.toLocaleDateString('id-ID', { month: 'short' }).replace(/\./g, '');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year} ${month} ${day} ${hours}:${minutes}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
</script>
