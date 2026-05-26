# RIS Bridge — API Integration & Reference Guide

This document is the primary integration guide for **SIMRS** (Hospital Information System) developers. It describes how to authenticate, submit radiology orders, query master exam lists, upload DICOM files, handle webhook callbacks, and monitor system health.

---

## Daftar Isi (Table of Contents)
1. [Prinsip Integrasi & Prasyarat Kunjungan](#1-prinsip-integrasi--prasyarat-kunjungan)
2. [Alur Autentikasi (JWT Token Flow)](#2-alur-autentikasi-jwt-token-flow)
3. [Daftar Endpoint API Utama](#3-daftar-endpoint-api-utama)
   * [POST /api/auth/login](#post-apiauthlogin)
   * [POST /api/orders](#post-apiorders)
   * [GET /api/orders](#get-apiorders)
   * [GET /api/orders/:id](#get-apiordersid)
   * [GET /api/exams](#get-apiexams)
   * [POST /api/exams](#post-apiexams)
   * [PUT /api/exams/:code](#put-apiexamscode)
   * [DELETE /api/exams/:code](#delete-apiexamscode)
   * [POST /api/upload/:accessionNumber](#post-apiuploadaccessionnumber)
   * [POST /api/dicom-router/callback](#post-apidicom-routercallback)
   * [POST /api/reports](#post-apireports)
4. [Sistem Pemantauan & Kesehatan (Health Checks)](#4-sistem-pemantauan--kesehatan-health-checks)
5. [Skema Penanganan Error & Kode HTTP](#5-skema-penanganan-error--kode-http)

---

## 1. Prinsip Integrasi & Prasyarat Kunjungan

RIS Bridge bertindak sebagai orkestrator interoperabilitas yang menyederhanakan data kompleks medis. SIMRS Anda **hanya mengirimkan data bisnis sederhana** (seperti MRN pasien, kode pemeriksaan lokal, nama radiografer/radiolog, dan berkas freetext hasil pemeriksaan). 

RIS Bridge akan mengurus semua pemrosesan internal:
1. Pembuatan resource **ServiceRequest** FHIR ke SATUSEHAT.
2. Penulisan tag metadata gambar DICOM (`dcmodify`) dan pengiriman file (`storescu`).
3. Penyandingan metadata study dari kontainer DICOM Router.
4. Pembuatan resource **DiagnosticReport** FHIR ke SATUSEHAT.

### Prasyarat Kunjungan (Encounter Prerequisite)
> [!IMPORTANT]
> Sebelum SIMRS memicu pembuatan order di RIS Bridge, SIMRS wajib melakukan registrasi kunjungan pasien di platform SATUSEHAT terlebih dahulu untuk mendapatkan **`encounterId`** (ID Encounter Kemenkes). ID Encounter ini harus disertakan dalam body payload pembuatan order.

---

## 2. Alur Autentikasi (JWT Token Flow)

Seluruh API (kecuali Login, Refresh Token, dan Webhook Callback) dilindungi menggunakan JWT (JSON Web Token).
1. SIMRS/User melakukan login menggunakan username dan password terdaftar.
2. Server mengembalikan `accessToken` (berlaku 1 jam) dan `refreshToken` (berlaku 7 hari).
3. Untuk mengakses endpoint terproteksi, sertakan header berikut:
   ```http
   Authorization: Bearer <accessToken>
   ```

---

## 3. Daftar Endpoint API Utama

### POST /api/auth/login
Mendapatkan token autentikasi.

* **URL**: `/api/auth/login`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "229aec41-e1d9-4633-a436-9c5482952db2",
        "username": "admin",
        "fullName": "System Administrator",
        "role": "ADMIN"
      }
    }
  }
  ```

---

### POST /api/orders
Membuat order pemeriksaan radiologi baru dan mengirimkan ServiceRequest ke SATUSEHAT.

* **URL**: `/api/orders`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `Authorization: Bearer <accessToken>`
* **Request Body**:
  ```json
  {
    "encounterId": "ff616031-805f-490c-a7a3-6440bfe12e7a",
    "mrn": "0141878",
    "name": "Ahmad Mustofa Aji",
    "radLocationId": "bae68116-c1ac-4e55-9790-532b5b2d24cf",
    "requester": {
      "pratictionerId": "1004XXXX",
      "pratictionerName": "dr. Soni Abdullah, Sp.JP",
      "department": "Poli Spesialis Jantung"
    },
    "performer": {
      "pratictionerId": "1004XXXX",
      "pratictionerName": "dr. Sungha Ali, Sp.Rad"
    },
    "examCode": "XR_SKULL_AP_LAT",
    "timeOrdered": "2026-04-17T03:47:32+07:00",
    "reasonCode": {
      "code": "T14",
      "display": "Injury of unspecified body region"
    },
    "observationText": "Calvaria tampak normal, Trabekulasi tulang normal, Tak tampak garis fracture, Bentuk dan ukuran sella, tursica normal,Tak tampak tanda-tanda peningkatan TIK, Tak tampak erosi, destruksi maupun proses osteolitik / steoblastik, Tak tampak soft tissue mass / swelling",
    "diagnosticReportText": "Tak tampak fraktur"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "accessionNumber": "XR-20260526-001",
      "orderId": "3a00a12e-13c5-4309-80fb-b09bb68d3748",
      "status": "WAITING_UPLOAD",
      "serviceRequestId": "81203810-128c-482a-967a-1f8139589a1b",
      "encounterId": "2823b811-fb83-4903-a178-0cb95c808796",
      "examCode": "XR_CHEST",
      "examName": "Thorax AP/PA",
      "createdAt": "2026-05-26T02:15:10.000Z"
    }
  }
  ```

---

### GET /api/orders
Mendapatkan daftar order radiologi dengan filter pencarian dan paging.

* **URL**: `/api/orders`
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <accessToken>`
* **Parameters**:
  * `search` (opsional): Pencarian parsial berdasarkan Nama Pasien, MRN, atau Accession Number.
  * `status` (opsional): `WAITING_UPLOAD`, `DICOM_RECEIVED`, `IMAGING_CREATED`, `REPORT_CREATED`, `FAILED`.
  * `page` (opsional, default: 1): Halaman data.
  * `limit` (opsional, default: 20): Jumlah baris per halaman.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "3a00a12e-13c5-4309-80fb-b09bb68d3748",
        "accessionNumber": "XR-20260526-001",
        "encounterId": "2823b811-fb83-4903-a178-0cb95c808796",
        "patientId": "P022883",
        "patientName": "Budi Santoso",
        "mrn": "102-39-44",
        "status": "WAITING_UPLOAD",
        "createdAt": "2026-05-26T02:15:10.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

---

### GET /api/orders/:id
Mendapatkan rincian lengkap satu order beserta data DICOM terunggah dan riwayat ekspertise.

* **URL**: `/api/orders/:id` *(Bisa berupa database UUID atau Accession Number)*
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <accessToken>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "3a00a12e-13c5-4309-80fb-b09bb68d3748",
      "accessionNumber": "XR-20260526-001",
      "encounterId": "2823b811-fb83-4903-a178-0cb95c808796",
      "patientId": "P022883",
      "patientName": "Budi Santoso",
      "mrn": "102-39-44",
      "status": "IMAGING_CREATED",
      "imagingstudyId": "128c381a-9bc2-4aa8-9273-0b1a039828d1",
      "observation": "Batuk berdahak lebih dari 2 minggu",
      "diagnosticReport": "Suspect tuberculosis",
      "dicomFiles": [
        {
          "id": "6fa81a67-bb78-4ea1-8df1-e3ca15ef2322",
          "fileName": "chest_xray.dcm",
          "fileSize": "1048576",
          "processed": true,
          "sentToRouter": true
        }
      ],
      "reports": []
    }
  }
  ```

---

### GET /api/exams
Mendapatkan daftar master pemeriksaan radiologi beserta prefix accession dan kode penunjang LOINC/KPTL.

* **URL**: `/api/exams`
* **Method**: `GET`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e3ca15ef-bb78-4ea1-8df1-5fa81a672322",
        "examCode": "XR_CHEST",
        "examName": "Thorax AP/PA",
        "modalityCode": "XR",
        "loincCode": "11522-0",
        "loincDisplay": "Suboptimum Chest study",
        "kptlCode": "3.14.01.01.0001",
        "kptlDisplay": "Foto Thorax",
        "studyDescription": "Thorax AP/PA",
        "bodyPart": "CHEST",
        "accessionPrefix": "XR",
        "active": true
      }
    ]
  }
  ```

---

### POST /api/exams
Membuat data master pemeriksaan radiologi baru (Admin Only).

* **URL**: `/api/exams`
* **Method**: `POST`
* **Headers**:
  * `Authorization: Bearer <accessToken>` *(Role ADMIN)*
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "examCode": "CT_BRAIN",
    "examName": "CT Scan Otak Tanpa Kontras",
    "modalityCode": "CT",
    "loincCode": "37585-7",
    "loincDisplay": "CT Head WO Contrast",
    "kptlCode": "3.14.01.02.0002",
    "kptlDisplay": "CT Kepala Tanpa Kontras",
    "studyDescription": "CT Brain WO Contrast",
    "bodyPart": "HEAD",
    "accessionPrefix": "CT",
    "active": true
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "7fa81a67-bb78-4ea1-8df1-e3ca15ef2333",
      "examCode": "CT_BRAIN",
      "examName": "CT Scan Otak Tanpa Kontras",
      "modalityCode": "CT",
      "loincCode": "37585-7",
      "loincDisplay": "CT Head WO Contrast",
      "kptlCode": "3.14.01.02.0002",
      "kptlDisplay": "CT Kepala Tanpa Kontras",
      "studyDescription": "CT Brain WO Contrast",
      "bodyPart": "HEAD",
      "accessionPrefix": "CT",
      "active": true
    }
  }
  ```

---

### PUT /api/exams/:code
Mengubah data master pemeriksaan radiologi yang sudah ada berdasarkan kode pemeriksaan (Admin Only).

* **URL**: `/api/exams/:code`
* **Method**: `PUT`
* **Headers**:
  * `Authorization: Bearer <accessToken>` *(Role ADMIN)*
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "examName": "CT Scan Otak Tanpa Kontras (Update)",
    "loincDisplay": "CT Head Without Contrast",
    "active": false
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "7fa81a67-bb78-4ea1-8df1-e3ca15ef2333",
      "examCode": "CT_BRAIN",
      "examName": "CT Scan Otak Tanpa Kontras (Update)",
      "modalityCode": "CT",
      "loincCode": "37585-7",
      "loincDisplay": "CT Head Without Contrast",
      "kptlCode": "3.14.01.02.0002",
      "kptlDisplay": "CT Kepala Tanpa Kontras",
      "studyDescription": "CT Brain WO Contrast",
      "bodyPart": "HEAD",
      "accessionPrefix": "CT",
      "active": false
    }
  }
  ```

---

### DELETE /api/exams/:code
Menghapus data master pemeriksaan radiologi berdasarkan kode pemeriksaan (Admin Only). Penghapusan hanya diizinkan jika kode pemeriksaan belum dirujuk oleh data order radiologi aktif.

* **URL**: `/api/exams/:code`
* **Method**: `DELETE`
* **Headers**:
  * `Authorization: Bearer <accessToken>` *(Role ADMIN)*
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Pemeriksaan berhasil dihapus.",
    "data": {
      "examCode": "CT_BRAIN"
    }
  }
  ```

---

### POST /api/upload/:accessionNumber
Mengunggah berkas mentah gambar medis (.dcm). File akan ditampung di antrean pemrosesan metadata dan dikirim ke router.

* **URL**: `/api/upload/:accessionNumber`
* **Method**: `POST`
* **Headers**:
  * `Authorization: Bearer <accessToken>`
  * `Content-Type: multipart/form-data`
* **Body Form-Data**:
  * `file`: Berkas DICOM asli rumah sakit (ekstensi `.dcm`).
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "dicomFileId": "6fa81a67-bb78-4ea1-8df1-e3ca15ef2322",
      "accessionNumber": "XR-20260526-001",
      "fileName": "chest_xray.dcm",
      "fileSize": 1048576,
      "status": "QUEUED"
    }
  }
  ```

---

### POST /api/dicom-router/callback
Callback webhook yang dipicu oleh kontainer DICOM Router setelah berkas DICOM berhasil terunggah sebagai `ImagingStudy` di cloud SATUSEHAT.

* **URL**: `/api/dicom-router/callback`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `Authorization: Basic cmlzYnJpZGdlOnJpc2JyaWRnZS13ZWJob29rLXNlY3JldA==` *(Basic credentials)*
* **Request Body (Format FHIR ImagingStudy)**:
  ```json
  {
    "id": "128c381a-9bc2-4aa8-9273-0b1a039828d1",
    "resourceType": "ImagingStudy",
    "status": "available",
    "subject": {
      "reference": "Patient/P022883"
    },
    "identifier": [
      {
        "system": "http://fhir.kemkes.go.id/id/acsn",
        "value": "XR-20260526-001"
      }
    ]
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "received": true,
      "paired": true,
      "accessionNumber": "XR-20260526-001",
      "imagingstudyId": "128c381a-9bc2-4aa8-9273-0b1a039828d1"
    }
  }
  ```

---

### POST /api/reports
Membuat hasil bacaan radiolog lokal dan mempublikasikan data `DiagnosticReport` ke SATUSEHAT. Endpoint ini membutuhkan status order telah terhubung dengan data `ImagingStudy` (`IMAGING_CREATED`).

* **URL**: `/api/reports`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `Authorization: Bearer <accessToken>` *(Harus token user dengan role RADIOLOGIST / ADMIN)*
* **Request Body**:
  ```json
  {
    "orderId": "3a00a12e-13c5-4309-80fb-b09bb68d3748",
    "observation": "Cor tidak membesar. Pulmo: corakan bronkovaskuler normal, tidak tampak infiltrat/kondensasi. Kedua sinus kostofrenikus tajam. Tulang-tulang baik.",
    "diagnosticReport": "Foto Thorax AP/PA: Cor dan Pulmo dalam batas normal."
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "5fa81a67-bb78-4ea1-8df1-e3ca15ef2322",
      "orderId": "3a00a12e-13c5-4309-80fb-b09bb68d3748",
      "radiologistId": "229aec41-e1d9-4633-a436-9c5482952db2",
      "observation": "Cor tidak membesar. Pulmo: corakan bronkovaskuler normal, tidak tampak infiltrat/kondensasi. Kedua sinus kostofrenikus tajam. Tulang-tulang baik.",
      "diagnosticReport": "Foto Thorax AP/PA: Cor dan Pulmo dalam batas normal.",
      "satusehatId": "91238410-fb2c-49aa-9b22-1b10294c3912",
      "sentToSatusehat": true,
      "sentAt": "2026-05-26T02:20:00.000Z",
      "createdAt": "2026-05-26T02:20:00.000Z",
      "updatedAt": "2026-05-26T02:20:00.000Z"
    }
  }
  ```

---

## 4. Sistem Pemantauan & Kesehatan (Health Checks)

Untuk integrasi sistem eksternal atau load balancer, Anda dapat memanggil endpoint berikut tanpa autentikasi JWT:

* **GET `/api/monitoring/connectivity`**: Memeriksa status kesehatan koneksi database PostgreSQL, Redis, dan token SATUSEHAT.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "database": "connected",
        "redis": "connected",
        "satusehat": "connected"
      }
    }
    ```
* **GET `/api/infrastructure/status`**: Memeriksa status kontainer DICOM Router lokal (berjalan/mati) beserta detail runtime kontainer.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "runtime": "podman",
        "containerName": "dicom-router-mini",
        "running": true,
        "details": "Up 12 minutes"
      }
    }
    ```

---

## 5. Skema Penanganan Error & Kode HTTP

RIS Bridge menggunakan format respons error terpadu yang mempermudah debugging pihak SIMRS.

### Skema Tubuh Respons Error (Error JSON Schema)
```json
{
  "success": false,
  "error": {
    "code": "KODE_KLASIFIKASI_ERROR",
    "message": "Pesan deskripsi kesalahan dalam bahasa manusia",
    "details": {}
  }
}
```

### Daftar Kode Error & Kode HTTP
| Kode HTTP | Kode Error | Deskripsi | Solusi |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | Format body JSON tidak sesuai skema (misal: MRN kosong atau data kurang). | Periksa kembali format payload pengiriman sesuai dokumentasi. |
| `401` | `AUTHENTICATION_ERROR` | Token JWT tidak dikirimkan, tidak valid, atau telah kedaluwarsa. | Panggil endpoint `/api/auth/refresh` untuk memperbarui token. |
| `403` | `AUTHORIZATION_ERROR` | User tidak memiliki peran (*role*) yang berhak memanggil API ini. | Pastikan user yang masuk memiliki hak akses yang sesuai (misal: RADIOLOGIST untuk DiagnosticReport). |
| `404` | `NOT_FOUND` | Resource database (misal: order, exam) tidak ditemukan. | Periksa kecocokan ID kueri Anda. |
| `409` | `CONFLICT` | Bentrokan data unik (misal: accession number sudah digunakan). | Periksa data accession sequence database. |
| `500` | `INTERNAL_SERVER_ERROR` | Kesalahan sistem backend yang tidak terduga. | Hubungi IT administrator untuk memeriksa log backend server. |
