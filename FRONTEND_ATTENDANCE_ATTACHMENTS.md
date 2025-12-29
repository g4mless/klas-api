# Frontend: Attachment Izin/Sakit

Dokumen ini menjelaskan alur upload dan akses attachment untuk absensi status IZIN/SAKIT.

## Ringkasan
- Upload file dilakukan via signed upload URL dari backend.
- Simpan `attachment_path` saat submit absensi IZIN/SAKIT.
- Akses attachment untuk siswa (self) lewat `GET /today-status`.
- Akses attachment untuk guru lewat endpoint `GET /teacher/attendances/today` dan `GET /teacher/attendances/history`.

## Konfigurasi
Backend memakai bucket private Supabase Storage:
- Bucket: `attendance-attachments` (default) atau `ATTENDANCE_ATTACHMENT_BUCKET`
- TTL signed URL: 24 jam (default) atau `ATTENDANCE_ATTACHMENT_SIGNED_URL_TTL` (detik)

## Alur Upload (Siswa)

### 1) Minta signed upload URL
`POST /absen/attachment-upload-url`

Headers:
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

Body:
```json
{
  "filename": "surat-izin.jpg"
}
```

Response:
```json
{
  "path": "123/2025-02-14/uuid-surat-izin.jpg",
  "upload_url": "https://<supabase-storage-signed-upload-url>"
}
```

### 2) Upload file ke Supabase Storage
Upload langsung ke `upload_url` (PUT/POST sesuai signed URL yang diberikan).

Catatan:
- Ikuti method/headers yang dibutuhkan oleh signed URL.
- Pastikan konten file dikirim sebagai body.

### 3) Submit absensi IZIN/SAKIT
`POST /absen`

Headers:
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

Body:
```json
{
  "status": "IZIN",
  "attachment_path": "123/2025-02-14/uuid-surat-izin.jpg"
}
```

Validasi:
- `attachment_path` wajib untuk `IZIN`/`SAKIT`.
- `attachment_path` tidak boleh dikirim untuk status lain.

## Akses Attachment (Siswa)
`GET /today-status`

Response:
```json
{
  "has_attendance": true,
  "attendance": {
    "id": 1,
    "student_id": 123,
    "date": "2025-02-14",
    "status": "IZIN",
    "attachment_path": "123/2025-02-14/uuid-surat-izin.jpg",
    "attachment_url": "https://<signed-url-24h>"
  }
}
```

## Akses Attachment (Guru)

### Rekap hari ini
`GET /teacher/attendances/today?class_id=<id>`

Field tambahan per siswa:
- `attachment_url`: signed URL 24 jam (null jika tidak ada attachment)

### Riwayat absensi
`GET /teacher/attendances/history?class_id=<id>&student_id=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD`

Field tambahan per record:
- `attachment_url`: signed URL 24 jam (null jika tidak ada attachment)

## Catatan Penting
- Signed URL hanya valid 24 jam, frontend perlu re-fetch endpoint jika URL expired.
- File di bucket tidak otomatis terhapus; TTL hanya untuk URL.
