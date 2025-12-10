# Frontend Integration Guide: Teacher Portal & QR Attendance

This document outlines the necessary changes to the Frontend (MyKelas) to support the new Teacher Portal and QR Code Attendance features.

## 1. Authentication Updates

### 1.1 New Login Flow: Teacher (NUPTK)
*   **UI Change**: Add a "Login as Teacher" link/toggle on the main Login page.
*   **Input**: `NUPTK` (Number) instead of Email.
*   **Endpoint**: `POST /auth/login/teacher`
*   **Response Handling**:
    *   Store `access_token` & `refresh_token` (same as student auth).
    *   Store `teacher` object in a new **Teacher Context** or existing Auth Context.
    *   **Redirect**: Go to `/teacher/dashboard`.

### 1.2 Role-Based Routing
*   Create a `<TeacherProtectedLayout>` similar to `ProtectedLayout`.
*   **Logic**:
    *   If `is_teacher` (from auth state) -> Allow access.
    *   If `is_student` -> Redirect to `/` (Student Home).
    *   If unauthenticated -> Redirect to `/login`.

## 2. Teacher Portal (New Section)

### 2.1 Dashboard / Class List
*   **Route**: `/teacher/dashboard`
*   **Data**: Fetch `GET /teacher/classes`.
*   **UI**: Grid or list of classes (e.g., "X IPA 1", "XI IPS 2").
*   **Action**: Clicking a class navigates to the Class Detail view.

### 2.2 Class Attendance View
*   **Route**: `/teacher/class/:classId`
*   **Data**: Fetch `GET /teacher/attendances/today?class_id={classId}`.
*   **UI**:
    *   **Header**: Class Name & "Generate QR" Button.
    *   **List**: List of students with status indicators (Green=Present, Grey=Alpha, etc.).
    *   **Stats**: Summary count (Present: 15, Alpha: 2).

### 2.3 QR Code Generator (Modal/Page)
*   **Trigger**: "Generate QR" button in Class Detail view.
*   **Logic**:
    1.  **Initial Load**: Call `POST /teacher/qr/generate` with `{ class_id }`.
    2.  **Display**: Render the returned `token` as a QR Code image.
    3.  **Auto-Refresh**: Every 55 seconds, call the endpoint again to get a fresh token (tokens expire in 60s).
    4.  **Security**: Ensure the QR is hidden/closed if the teacher leaves the page.

## 3. Student Updates

### 3.1 QR Scanner Feature
*   **UI Change**: Add a prominent "Scan QR" button on the Student Dashboard.
*   **Interaction**:
    1.  Open device camera (using a library like `react-qr-reader` or `html5-qrcode`).
    2.  Scan the teacher's screen.
    3.  **On Scan**: Extract token string.
    4.  **Submit**: Call `POST /absen/qr` with `{ token }`.
*   **Feedback**:
    *   **Success**: Show "Attendance Recorded! ✅" and refresh status.
    *   **Error**: Show specific error (e.g., "Wrong Class", "Expired").

## 4. API Client Updates (`klas-api.ts`)

Add the following methods to the API wrapper:

```typescript
// Teacher Auth
export async function loginTeacher(nuptk: string) { ... }

// Teacher Data
export async function fetchTeacherClasses() { ... }
export async function fetchClassAttendance(classId: string) { ... }
export async function fetchAttendanceHistory(params: HistoryParams) { ... }

// QR Features
export async function generateQrToken(classId: string) { ... }
export async function submitQrAttendance(token: string) { ... }
```

## 5. State Management

*   **TeacherProvider**: New context to hold:
    *   `teacher` profile (id, nuptk, name).
    *   `selectedClass` (optional, for navigation state).
*   **StudentProvider**: Update to handle "Scan QR" actions and refresh status upon successful scan.
