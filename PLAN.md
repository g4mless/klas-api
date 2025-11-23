# Student Android App Plan

This document outlines the implementation plan for the Student Android Application for the Klas API. The app will allow students to log in, view their profile, and record their daily attendance.

## 1. App Overview
*   **Target Audience**: Students.
*   **Platform**: Android (Kotlin).
*   **Core Features**: Authentication (Email OTP), Daily Attendance Check-in, Profile View.

## 2. Features & User Flow

### 2.1. Authentication
*   **Login Screen**:
    *   Input: Email Address.
    *   Action: "Send OTP" button triggers `POST /auth/signin`.
*   **OTP Verification Screen**:
    *   Input: 6-digit OTP.
    *   Action: "Verify" button triggers `POST /auth/verify`.
    *   **On Success**: Save `access_token`, `refresh_token`, and `user` object securely (e.g., EncryptedSharedPreferences). Navigate to Home.
*   **Link Student (First Time/Registration)**:
    *   *Note*: If the user is not linked to a student record, they might need to link their account.
    *   Screen: Input Full Name.
    *   Action: `POST /auth/link-student` with `{ "name": "..." }`.

### 2.2. Home / Dashboard
*   **Header**: Welcome message with Student Name.
*   **Current Status Card**:
    *   Shows today's date.
    *   Shows current attendance status (e.g., "Not Checked In", "Hadir", "Sakit").
    *   Derived from Student Data (`last_status`, `last_date`).
*   **Attendance Action**:
    *   Buttons/Selector: "Hadir", "Izin", "Sakit".
    *   Action: `POST /absen` with `{ "status": "..." }`.
    *   **Feedback**: Toast message ("Attendance recorded") or Error alert.

### 2.3. Profile
*   **Display Info**:
    *   NISN
    *   Name
    *   Class (Kelas)
    *   Date of Birth (TTL)
    *   Address
*   **Data Source**: Fetched from student record.

## 3. API Integration Strategy

### 3.1. Endpoints
| Feature | Method | Endpoint | Body/Params | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **Sign In** | `POST` | `/auth/signin` | `{ "email": "..." }` | No |
| **Verify OTP** | `POST` | `/auth/verify` | `{ "email": "...", "token": "..." }` | No |
| **Refresh Token**| `POST` | `/auth/refresh`| `{ "refresh_token": "..." }` | No |
| **Get User** | `GET` | `/auth/user` | - | Yes (Bearer) |
| **Link Student** | `POST` | `/auth/link-student`| `{ "name": "..." }` | Yes (Bearer) |
| **Attendance** | `POST` | `/absen` | `{ "status": "HADIR" }` | Yes (Bearer) |
| **Fetch Data** | `GET` | `/students` | - | No (Public)* |

*> **Note on Data Fetching**: Currently, the API only provides `GET /students` which lists **all** students. The app will need to fetch this list and filter locally by the logged-in `user_id` to find the current student's details (like `last_status`, `kelas`, etc.). Future API optimization recommended: `GET /students/me`.*

### 3.2. Data Models (Kotlin)

**User**
```kotlin
data class User(
    val id: String,
    val email: String,
    // ... other supabase user fields
)
```

**Student**
```kotlin
data class Student(
    val id: Long,
    val nisn: String,
    val nama: String,
    val kelas: Long?, // ID of class
    val user_id: String?,
    val last_status: String?, // 'HADIR', 'IZIN', 'SAKIT', 'ALFA'
    val last_date: String? // 'YYYY-MM-DD'
)
```

**AttendanceResponse**
```kotlin
data class AttendanceResponse(
    val message: String,
    val attendance: Attendance?
)
```

## 4. Technical Stack Recommendation
*   **Language**: Kotlin
*   **UI Framework**: Jetpack Compose (Material3)
*   **Network**: Retrofit + OkHttp (for API calls) or Ktor Client.
*   **JSON Parsing**: Kotlin Serialization or Gson/Moshi.
*   **Async**: Coroutines + Flow.
*   **DI**: Hilt or Koin.
*   **Local Storage**: DataStore (Preferences) for tokens.

## 5. Implementation Steps
1.  **Setup Project**: Configure Android project with dependencies.
2.  **Network Layer**: Create Retrofit service interface matching the endpoints above. Implement AuthInterceptor to inject Bearer token.
3.  **Auth Flow**: Implement Login and Verify screens. Handle token storage.
4.  **Student Context**: After login, fetch `GET /students` and find the matching student by `user_id`. Store `student_id` and details in session state (ViewModel).
    *   *If no student found*: Prompt user to "Link Account" (Enter Name -> `POST /auth/link-student`).
5.  **Home Screen**: Build UI to display status. Wire up `POST /absen`.
6.  **Error Handling**: Handle 401 (Logout/Refresh), 409 (Already Checked In), 400 (Bad Request).

## 6. Future Improvements (Backend)
*   Add `GET /students/me` endpoint to avoid fetching the entire student database on the client.
*   Add `GET /attendances/history` to allow students to see their past records.
