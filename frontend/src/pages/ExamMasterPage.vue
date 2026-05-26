<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">Exam Master</h1>
        <p class="text-dark-400 text-sm mt-1">Kelola data master pemeriksaan radiologi — sumber acuan interoperabilitas</p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <!-- Search Bar -->
        <div class="relative min-w-[240px]">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-dark-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            v-model="searchQuery"
            type="text"
            class="input-field pl-9 py-2 text-sm"
            placeholder="Cari Kode atau Nama..."
          />
        </div>

        <!-- Modality Filter -->
        <select v-model="selectedModalityFilter" class="input-field w-auto py-2 text-sm">
          <option value="">Semua Modality</option>
          <option v-for="m in modalities" :key="m.code" :value="m.code">
            {{ m.code }} - {{ m.name }}
          </option>
        </select>

        <button 
          v-if="isAdmin" 
          @click="openAddModal" 
          class="btn-primary text-sm flex items-center gap-2 whitespace-nowrap"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Tambah Pemeriksaan</span>
        </button>
      </div>
    </div>

    <!-- Alert for Non-Admin -->
    <div v-if="!isAdmin" class="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm flex items-center gap-3">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>Anda berada dalam mode <strong>View-Only</strong>. Perubahan data master pemeriksaan hanya dapat dilakukan oleh akun Administrator.</span>
    </div>

    <!-- Table -->
    <div class="bg-dark-800/50 border border-dark-700/50 rounded-xl overflow-hidden shadow-xl">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Pemeriksaan</th>
            <th>Modality</th>
            <th>LOINC</th>

            <th>Body Part</th>
            <th>Status</th>
            <th v-if="isAdmin" class="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exam in filteredExams" :key="exam.id" class="hover:bg-dark-750/30 transition-colors">
            <td class="font-mono text-primary-400 text-sm font-semibold">{{ exam.examCode }}</td>
            <td class="text-white font-medium">{{ exam.examName }}</td>
            <td><span class="badge badge-info">{{ exam.modalityCode }}</span></td>
            <td class="text-dark-300">
              <div class="font-mono text-xs">{{ exam.loincCode }}</div>
              <div class="text-dark-400 text-[11px] truncate max-w-[150px]">{{ exam.loincDisplay }}</div>
            </td>

            <td class="text-dark-300">{{ exam.bodyPart }}</td>
            <td>
              <span :class="exam.active ? 'badge badge-success' : 'badge badge-danger'">
                {{ exam.active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td v-if="isAdmin" class="text-right">
              <div class="flex justify-end gap-2">
                <button 
                  @click="openEditModal(exam)" 
                  class="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded transition-colors"
                  title="Ubah Pemeriksaan"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  @click="deleteExam(exam)" 
                  class="p-1.5 text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  title="Hapus Pemeriksaan"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredExams.length">
            <td colspan="9" class="text-center text-dark-500 py-16 italic">
              {{ loading ? 'Memuat data...' : 'Tidak ada master pemeriksaan radiologi ditemukan.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Form (Tambah / Edit) -->
    <div 
      v-if="showModal" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      @click.self="closeModal"
    >
      <div class="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-dark-700 flex justify-between items-center">
          <h3 class="text-lg font-bold text-white">
            {{ isEditMode ? 'Ubah Pemeriksaan Radiologi' : 'Tambah Pemeriksaan Radiologi' }}
          </h3>
          <button @click="closeModal" class="text-dark-400 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="saveExam" class="flex-1 overflow-y-auto p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Kode Pemeriksaan -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">Kode Pemeriksaan <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.examCode" 
                class="input-field font-mono" 
                placeholder="Contoh: XR_CHEST" 
                required 
                :disabled="isEditMode" 
              />
              <p class="text-[10px] text-dark-500 mt-0.5">Kode unik pembeda (misalnya local HIS code). Tidak dapat diubah setelah disimpan.</p>
            </div>

            <!-- Nama Pemeriksaan -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">Nama Pemeriksaan <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.examName" 
                class="input-field" 
                placeholder="Contoh: Thorax AP/PA" 
                required 
              />
            </div>

            <!-- Modality -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">Modality Code <span class="text-rose-500">*</span></label>
              <select 
                v-model="form.modalityCode" 
                class="input-field" 
                required
              >
                <option value="" disabled>Pilih Modality</option>
                <option v-for="m in modalities" :key="m.code" :value="m.code">
                  {{ m.code }} — {{ m.name }}
                </option>
              </select>
            </div>


            <!-- LOINC Code -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">LOINC Code <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.loincCode" 
                class="input-field font-mono" 
                placeholder="Contoh: 11522-0" 
                required 
              />
            </div>

            <!-- LOINC Display -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">LOINC Display <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.loincDisplay" 
                class="input-field" 
                placeholder="Contoh: Suboptimum Chest study" 
                required 
              />
            </div>



            <!-- Body Part -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">Body Part <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.bodyPart" 
                class="input-field" 
                placeholder="Contoh: CHEST, ABDOMEN" 
                required 
              />
            </div>

            <!-- Study Description -->
            <div>
              <label class="block text-xs font-semibold text-dark-300 uppercase mb-1">Study Description <span class="text-rose-500">*</span></label>
              <input 
                v-model="form.studyDescription" 
                class="input-field" 
                placeholder="Contoh: Thorax AP/PA" 
                required 
              />
            </div>
          </div>

          <!-- Active checkbox -->
          <div class="flex items-center gap-2 pt-2">
            <input 
              v-model="form.active" 
              type="checkbox" 
              id="active-checkbox" 
              class="w-4 h-4 rounded bg-dark-750 border-dark-600 text-primary-500 focus:ring-primary-500/50" 
            />
            <label for="active-checkbox" class="text-sm text-dark-200 cursor-pointer">Pemeriksaan Aktif (dapat dipilih di order baru)</label>
          </div>

          <!-- Footer Actions -->
          <div class="flex gap-3 justify-end pt-4 border-t border-dark-700">
            <button type="button" @click="closeModal" class="btn-secondary">Batal</button>
            <button type="submit" class="btn-primary flex items-center gap-1.5" :disabled="submitting">
              <svg v-if="submitting" class="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isEditMode ? 'Simpan Perubahan' : 'Tambah Pemeriksaan' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

const modalities = [
  { code: 'CR', name: 'Computed Radiography' },
  { code: 'DX', name: 'Digital Radiography' },
  { code: 'CT', name: 'Computed Tomography' },
  { code: 'MR', name: 'Magnetic Resonance' },
  { code: 'US', name: 'Ultrasound' },
  { code: 'XA', name: 'X-Ray Angiography' },
  { code: 'RF', name: 'Radiofluoroscopy' },
  { code: 'NM', name: 'Nuclear Medicine' },
  { code: 'PT', name: 'Positron Emission Tomography' },
  { code: 'MG', name: 'Mammography' },
  { code: 'PX', name: 'Panoramic X-Ray' },
  { code: 'ES', name: 'Endoscopy' },
  { code: 'OT', name: 'Other' }
];

const exams = ref<any[]>([]);
const loading = ref(false);
const submitting = ref(false);
const searchQuery = ref('');
const selectedModalityFilter = ref('');

// Modal States
const showModal = ref(false);
const isEditMode = ref(false);

const defaultForm = {
  examCode: '',
  examName: '',
  modalityCode: '',
  loincCode: '',
  loincDisplay: '',
  kptlCode: '',
  kptlDisplay: '',
  studyDescription: '',
  bodyPart: '',
  accessionPrefix: '',
  active: true,
};

const form = ref({ ...defaultForm });

// Computed filter list based on search query and modality type
const filteredExams = computed(() => {
  let result = exams.value;

  if (selectedModalityFilter.value) {
    result = result.filter(e => e.modalityCode === selectedModalityFilter.value);
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim();
    result = result.filter(
      (e) =>
        e.examCode.toLowerCase().includes(q) ||
        e.examName.toLowerCase().includes(q) ||
        e.modalityCode.toLowerCase().includes(q)
    );
  }

  return result;
});

onMounted(loadExams);

// Auto-set accessionPrefix dari modalityCode yang dipilih
watch(() => form.value.modalityCode, (newCode) => {
  if (newCode) {
    form.value.accessionPrefix = newCode;
  }
});


async function loadExams() {
  loading.value = true;
  try {
    const { data } = await apiClient.get('/api/exams?all=true');
    exams.value = data.data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function openAddModal() {
  isEditMode.value = false;
  form.value = { ...defaultForm };
  showModal.value = true;
}

function openEditModal(exam: any) {
  isEditMode.value = true;
  form.value = {
    examCode: exam.examCode,
    examName: exam.examName,
    modalityCode: exam.modalityCode,
    loincCode: exam.loincCode,
    loincDisplay: exam.loincDisplay,
    kptlCode: exam.kptlCode,
    kptlDisplay: exam.kptlDisplay,
    studyDescription: exam.studyDescription,
    bodyPart: exam.bodyPart,
    accessionPrefix: exam.accessionPrefix,
    active: exam.active,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function saveExam() {
  submitting.value = true;
  try {
    // Upper case code fields automatically
    const payload = {
      ...form.value,
      examCode: form.value.examCode.toUpperCase().trim(),
      modalityCode: form.value.modalityCode.toUpperCase().trim(),
      accessionPrefix: form.value.accessionPrefix.toUpperCase().trim(),
    };

    if (isEditMode.value) {
      await apiClient.put(`/api/exams/${payload.examCode}`, payload);
    } else {
      await apiClient.post('/api/exams', payload);
    }
    
    showModal.value = false;
    await loadExams();
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || 'Gagal menyimpan data pemeriksaan.';
    alert(msg);
  } finally {
    submitting.value = false;
  }
}

async function deleteExam(exam: any) {
  const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data master pemeriksaan '${exam.examCode} — ${exam.examName}'?`);
  if (!confirmDelete) return;

  try {
    await apiClient.delete(`/api/exams/${exam.examCode}`);
    await loadExams();
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || 'Gagal menghapus data pemeriksaan.';
    alert(msg);
  }
}
</script>
