# Frontend Integration Guide: Mark ALFA (Teacher)

Dokumen ini menjelaskan integrasi frontend untuk fitur guru yang menandai siswa menjadi `ALFA` ketika sebelumnya `IZIN`/`SAKIT` atau belum absen.

## Endpoint

`POST /teacher/attendances/mark-alfa`

## Authentication

Gunakan `Authorization: Bearer <access_token>` dari login guru.

## Request Body

```json
{
  "class_id": 1,
  "student_ids": [10, 12, 15],
  "date": "2025-12-09"
}
```

Keterangan:
- `class_id`: wajib.
- `student_ids`: wajib, daftar siswa yang dipilih guru.
- `date`: opsional, format `YYYY-MM-DD`. Default hari ini (zona waktu Asia/Jakarta).

## Response (Success)

```json
{
  "message": "Status ALFA berhasil diterapkan",
  "updated_count": 2,
  "inserted_count": 1,
  "updated_student_ids": [10, 12],
  "inserted_student_ids": [15],
  "skipped_student_ids": [],
  "date": "2025-12-09"
}
```

Keterangan:
- `updated_student_ids`: siswa yang sebelumnya `IZIN`/`SAKIT` lalu diubah jadi `ALFA`.
- `inserted_student_ids`: siswa yang sebelumnya belum punya absensi pada tanggal tersebut.
- `skipped_student_ids`: siswa yang sudah `HADIR`/`ALFA` sehingga tidak diubah.

## UI Flow yang Disarankan

1. Di halaman kelas (`/teacher/class/:classId`), tampilkan daftar siswa dengan status hari ini.
2. Izinkan guru memilih satu atau banyak siswa.
3. Tombol aksi: "Tandai ALFA".
4. Tampilkan dialog konfirmasi (karena ini override).
5. Setelah sukses, refresh daftar siswa atau update state lokal berdasarkan `updated_student_ids` dan `inserted_student_ids`.

## Error Handling

Tampilkan pesan error dari backend jika:
- `class_id` atau `student_ids` kosong.
- `student_ids` tidak berada dalam kelas tersebut.
