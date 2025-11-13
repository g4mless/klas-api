1.duty_schedule

Primary key: id
Columns: id (integer, identity), day (text), student_name (text), student_id (bigint)
Foreign keys:
    duty_schedule_student_id_fkey: public.duty_schedule.student_id → public.students.id

4.students

Primary key: id
Columns: id (bigint, identity), name (text), user_id (uuid), last_status (text), last_date (date)
Foreign keys:
    students_user_id_fkey: public.students.user_id → auth.users.id

5.attendances

Primary key: id
Columns: id (bigint, identity), student_id (bigint), date (date), status (text)
Foreign keys:
    attendances_student_id_fkey: public.attendances.student_id → public.students.id

6.admin

Primary key: id
Columns: id (bigint, identity), admin (bigint)
Foreign keys:
    admin_admin_fkey: public.admin.admin → public.students.id
