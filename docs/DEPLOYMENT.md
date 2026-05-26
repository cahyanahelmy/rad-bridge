# RIS Bridge — Deployment & Configuration Guide

This document is a step-by-step deployment and operations guide for hospital IT teams. It is written to be copy-paste friendly and suitable for systems engineers who install RIS Bridge on local hospital servers.

---

## Daftar Isi (Table of Contents)
1. [Kebutuhan Prasyarat Sistem](#1-kebutuhan-prasyarat-sistem)
2. [Panduan Instalasi dependensi OS](#2-panduan-instalasi-dependensi-os)
   * [Instalasi di Windows Server](#instalasi-di-windows-server)
   * [Instalasi di Linux (Ubuntu Server)](#instalasi-di-linux-ubuntu-server)
3. [Konfigurasi Environment (.env)](#3-konfigurasi-environment-env)
4. [Menyala & Inisialisasi Kontainer](#4-menyala--inisialisasi-kontainer)
5. [Inisialisasi Database & Seeding](#5-inisialisasi-database--seeding)
6. [Deployment Produksi Menggunakan PM2](#6-deployment-produksi-menggunakan-pm2)
7. [Panduan Pemecahan Masalah (Troubleshooting)](#7-panduan-pemecahan-masalah-troubleshooting)

---

## 1. Kebutuhan Prasyarat Sistem

Sebelum melakukan instalasi, pastikan server memenuhi spesifikasi minimum berikut:
* **Operating System**: Windows Server 2019+ atau Linux (Ubuntu 22.04 LTS recommended).
* **Hardware**: Min 4 Core CPU, 8 GB RAM, 100 GB HDD/SSD (Storage untuk penampung gambar DICOM).
* **Software**:
  * Node.js v22 (LTS)
  * PostgreSQL v16
  * Redis v7
  * Podman (v5+) atau Docker
  * DCMTK Tools (`dcmodify` & `storescu`)

---

## 2. Panduan Instalasi dependensi OS

### Instalasi di Windows Server

#### 1. Node.js, PostgreSQL, & Redis:
* Unduh installer Node.js v22 LTS dari [nodejs.org](https://nodejs.org/) dan jalankan instalasi.
* Unduh PostgreSQL v16 dari [enterprisedb.com](https://www.postgresql.org/download/windows/) dan jalankan instalasi. Catat port (`5432`) dan password admin.
* Unduh Redis untuk Windows dari [github.com/tporadowski/redis](https://github.com/tporadowski/redis/releases) dan daftarkan sebagai Windows Service.

#### 2. DCMTK (dcmodify & storescu):
* Unduh binaries DCMTK untuk Windows dari [dicom.offis.de/dcmtk](https://dicom.offis.de/dcmtk.php.en).
* Ekstrak file zip ke direktori, contoh: `C:\dcmtk`.
* Tambahkan folder `C:\dcmtk\bin` ke **System Environment PATH** Windows agar command `dcmodify` dan `storescu` dapat dipanggil secara langsung oleh Node.js.

#### 3. Podman:
* Unduh installer MSI Podman dari [podman.io](https://podman.io/) dan lakukan instalasi.
* Buka terminal PowerShell dan jalankan inisialisasi mesin podman:
  ```powershell
  podman machine init
  podman machine start
  ```

---

### Instalasi di Linux (Ubuntu Server)

#### 1. Instalasi Node.js v22:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Instalasi PostgreSQL & Redis:
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server

# Nyalakan & Aktifkan service
sudo systemctl enable --now postgresql
sudo systemctl enable --now redis-server
```

#### 3. Instalasi DCMTK & Podman:
```bash
sudo apt install -y dcmtk podman
```

---

## 3. Konfigurasi Environment (.env)

RIS Bridge memusatkan seluruh konfigurasi sistem pada file `.env` di direktori root.
Salin file template `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Buka `.env` dan konfigurasikan variabel penting berikut:

```env
# Mode Aplikasi & Port Server
NODE_ENV=production
APP_PORT=3000
APP_HOST=0.0.0.0

# Database PostgreSQL
DATABASE_URL="postgresql://postgres:password_anda@localhost:5432/mini_ris"

# Antrean Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kredensial SATUSEHAT (Dapatkan dari DTO Kemenkes)
SATUSEHAT_BASE_URL=https://api-satusehat.kemkes.go.id
SATUSEHAT_AUTH_URL=https://api-satusehat.kemkes.go.id/oauth2/v1
SATUSEHAT_ORG_ID=100028123
SATUSEHAT_CLIENT_KEY=kunci_client_satusehat_anda
SATUSEHAT_SECRET_KEY=kunci_secret_satusehat_anda

# Konfigurasi DICOM Router
CONTAINER_RUNTIME=podman   # Isi 'docker' atau 'podman'
DICOM_ROUTER_CONTAINER=dicom-router-mini
DICOM_ROUTER_PORT=11112

# Webhook Callback pairing
WEBHOOK_USERNAME=risbridge
WEBHOOK_PASSWORD=password_webhook_rahasia_anda
WEBHOOK_CALLBACK_URL=http://host.docker.internal:3000/api/dicom-router/callback

# ============================================================
# DICOM Storage & Retention Policy
# ============================================================
# Path folder penyimpanan DICOM sementara
STORAGE_PATH=./storage

# Batas maksimum penyimpanan dalam GB
# Sesuaikan dengan kapasitas disk server rumah sakit
STORAGE_MAX_GB=40

# Strategi cleanup: FIFO (studi tertua COMPLETED dihapus duluan)
STORAGE_CLEANUP_STRATEGY=FIFO

# Hanya hapus studi berstatus COMPLETED — jangan ubah nilai ini
STORAGE_CLEANUP_ONLY_COMPLETED=true

# Aktifkan auto-cleanup saat limit terlampaui (true/false)
STORAGE_AUTO_CLEANUP=true

# Maksimum percobaan pengiriman DICOM ke router sebelum file dihapus
STORAGE_MAX_RETRY_COUNT=3

# Hapus file DICOM fisik setelah retry melebihi batas
STORAGE_DELETE_FAILED_DICOM_AFTER_RETRY=true
```

> **Catatan Penting**: RIS Bridge **bukan** PACS arsip permanen. Folder `storage/` bersifat sementara — file DICOM akan otomatis dibersihkan saat kapasitas mencapai `STORAGE_MAX_GB`. Data metadata di database **tidak akan dihapus** dan tetap dapat diaudit selamanya.

---

## 4. Menyala & Inisialisasi Kontainer

RIS Bridge menggunakan kontainer DICOM Router untuk melacak dan mengirim data `ImagingStudy` ke SATUSEHAT.

Jalankan perintah ini di direktori root untuk mengunduh image kontainer dan menyalakan kontainer awal:

```bash
# Mengunduh image & menyalakan container
podman compose up -d

# Memastikan container postgres, redis, dan dicom-router berjalan
podman compose ps
```

---

## 5. Inisialisasi Database & Seeding

Setelah database menyala, jalankan pembuatan skema database relasional lokal:

```bash
cd backend

# Instalasi packages NPM backend
npm install

# Generasi prisma client local
npm run db:generate

# Menjalankan migrasi database
npm run db:migrate

# Memasukkan data awal (Seeding admin user & exam master)
npm run seed
```

---

## 6. Deployment Produksi Menggunakan PM2

Untuk memastikan server backend RIS Bridge tetap hidup di latar belakang dan otomatis menyala kembali jika server reboot (*auto-restart*), gunakan orchestrator PM2:

#### 1. Instalasi PM2 secara global:
```bash
npm install -g pm2
```

#### 2. Menyalakan Aplikasi menggunakan `ecosystem.config.js`:
RIS Bridge menyediakan file integrasi PM2 terpusat di root direktori yang secara otomatis memuat variabel lingkungan `.env`:

```bash
cd ..
pm2 start ecosystem.config.js
```

#### 3. Menyimpan Sesi PM2 untuk Booting OS:
```bash
# Menyimpan list aplikasi berjalan saat ini
pm2 save

# Mendaftarkan pm2 ke system startup daemon
pm2 startup
```

---

## 7. Panduan Pemecahan Masalah (Troubleshooting)

### A. Database Connection Failed
* **Gejala**: Log backend menampilkan pesan `PostgreSQL connection failed`.
* **Solusi**:
  1. Pastikan PostgreSQL Server berjalan: `sudo systemctl status postgresql` (Linux) atau cek Windows Services `postgresql-x64-16`.
  2. Buka berkas `.env` dan verifikasi format `DATABASE_URL` (Pastikan password, username, dan nama database sudah sesuai).

### B. Redis Worker Delay / BullMQ Job Terhambat
* **Gejala**: DICOM diunggah di frontend, tetapi status terus-menerus `QUEUED` dan tidak berlanjut ke `DICOM_RECEIVED`.
* **Solusi**:
  1. Periksa status Redis: `redis-cli ping` (pastikan mengembalikan `PONG`).
  2. Periksa apakah antrean Redis kelebihan memori: restart Redis server.
  3. Cek log BullMQ di Dashboard Monitoring UI pada menu "Monitoring".

### C. Status SATUSEHAT Disconnected
* **Gejala**: Panel indikator SATUSEHAT berwarna merah ("Disconnected") di Dashboard.
* **Solusi**:
  1. Pastikan kredensial `SATUSEHAT_CLIENT_KEY` dan `SATUSEHAT_SECRET_KEY` di file `.env` ditulis dengan benar tanpa spasi/tanda kutip tambahan.
  2. Pastikan server memiliki koneksi internet keluar (port HTTPS `443` tidak diblokir firewall ISP). Coba tes koneksi menggunakan cURL:
     ```bash
     curl -I https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken
     ```

### D. Perintah storescu Gagal mengirim DICOM
* **Gejala**: Log backend memunculkan pesan error `storescu failed`.
* **Solusi**:
  1. Jalankan `storescu --version` di command prompt/terminal untuk memastikan DCMTK binaries sudah masuk di System PATH.
  2. Pastikan kontainer DICOM Router berjalan di port `11112`.
  3. Verifikasi konfigurasi firewall lokal tidak memblokir komunikasi port lokal `11112` dan `3000`.

### E. Webhook Callback Tidak Berfungsi
* **Gejala**: Berkas DICOM terkirim ke kontainer, tetapi order di RIS Bridge tidak pernah berubah status menjadi `IMAGING_CREATED`.
* **Solusi**:
  1. Periksa apakah kontainer `dicom-router-mini` dapat menghubungi host backend RIS Bridge.
  2. Jika menggunakan Windows, pastikan `WEBHOOK_CALLBACK_URL` mengarah ke `http://host.docker.internal:3000/...` karena localhost kontainer berbeda dengan localhost komputer host.
  3. Jika menggunakan Linux, ganti URL callback menggunakan alamat IP LAN lokal server Anda (contoh: `http://192.168.1.50:3000/...`).

### F. Storage Penuh / FIFO Cleanup Tidak Berjalan
* **Gejala**: Folder `storage/` terus membengkak, atau log backend tidak menampilkan pesan `Executing FIFO cleanup`.
* **Solusi**:
  1. Pastikan `STORAGE_AUTO_CLEANUP=true` di file `.env`.
  2. Periksa nilai `STORAGE_MAX_GB` — pastikan sudah disesuaikan dengan kapasitas disk server.
  3. Cleanup hanya menyasar studi berstatus `COMPLETED`. Jika semua studi masih `PROCESSING` atau `RETRYING`, cleanup tidak akan berjalan. Periksa log BullMQ di dashboard Monitoring.
  4. Untuk memaksa pembersihan manual, akses endpoint `GET /api/monitoring/storage` untuk melihat statistik aktual terlebih dahulu, lalu pastikan ada studi dengan status `COMPLETED`.

