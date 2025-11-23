1) admin
Purpose: Stores admin records linked to auth.users.
Rows: 1
Columns:
id (bigint, identity) — primary key
user_id (uuid) — references auth.users.id
Primary key: id
Foreign keys:
admin_user_id_fkey: public.admin.user_id → auth.users.id
RLS: enabled

2) students
Purpose: Student profiles (personal data, school class, optional link to auth user).
Rows: 8
Columns:
id (bigint, identity) — primary key
nisn (text)
nama (text)
jenis_kelamin (text)
tanggal_lahir (date)
tempat_lahir (text)
alamat (text)
user_id (uuid) — optional link to auth.users.id
kelas (bigint) — references public.class.id
Primary key: id
Foreign keys:
students_user_id_fkey: public.students.user_id → auth.users.id
students_kelas_fkey: public.students.kelas → public.class.id
Note: attendances.student_id also references this table (see attendances FK)
RLS: enabled

3) attendances
Purpose: Attendance records for students.
Rows: 0
Columns:
id (bigint, identity) — primary key
student_id (bigint) — references public.students.id
date (date)
status (text)
Primary key: id
Foreign keys:
attendances_student_id_fkey: public.attendances.student_id → public.students.id
RLS: enabled

4) class
Purpose: School classes.
Rows: 3
Columns:
id (bigint, identity) — primary key
class_name (text)
Primary key: id
Foreign keys:
students_kelas_fkey: public.class.id ← referenced by public.students.kelas
RLS: enabled