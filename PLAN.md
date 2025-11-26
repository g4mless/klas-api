# Student Web App Plan

This document outlines the implementation plan for the Student Web Application for the Klas API. The app will allow students to log in, view their profile, and record their daily attendance.

## 1. App Overview
*   **Target Audience**: Students.
*   **Platform**: Web (React Router v7 with Tailwindcss preinstalled).
*   **Backend**: Hono.js API with Supabase Authentication.
*   **Core Features**: Authentication (Email OTP), Daily Attendance Check-in, Profile View.

## 2. Features & User Flow

### 2.1. Authentication (Supabase)
*   **Login Screen**:
    *   Input: Email Address.
    *   Action: "Send OTP" button triggers `supabase.auth.signInWithOtp()` with email.
*   **OTP Verification Screen**:
    *   Input: 6-digit OTP.
    *   Action: "Verify" button triggers `supabase.auth.verifyOtp()` with token.
    *   **On Success**: Supabase client handles token storage securely. Session is automatically managed. Navigate to Home.
*   **Link Student (First Time/Registration)**:
    *   *Note*: If the user is not linked to a student record, they might need to link their account.
    *   Screen: Input Full Name.
    *   Action: `POST /auth/link-student` with `{ "name": "..." }` (using Bearer token from Supabase session).

### 2.2. Home / Dashboard
*   **Header**: Welcome message with Student Name.
*   **Current Status Card**:
    *   Shows today's date.
    *   Shows current attendance status (e.g., "Not Checked In", "Hadir", "Sakit").
    *   Derived from Student Data (`last_status`, `last_date`).
*   **Attendance Action**:
    *   Buttons/Selector: "Hadir", "Izin", "Sakit".
    *   Action: `POST /absen` with `{ "status": "..." }`.
    *   **Feedback**: Toast notification ("Attendance recorded") or Error alert.

### 2.3. Profile
*   **Display Info**:
    *   NISN
    *   Name
    *   Class (Kelas)
    *   Date of Birth (TTL)
    *   Address
*   **Data Source**: Fetched from student record.

## 3. API Integration Strategy

### 3.1. Authentication (Supabase)
| Feature | Method | Function | Parameters |
| :--- | :--- | :--- | :--- |
| **Send OTP** | Async | `supabase.auth.signInWithOtp()` | `{ email: "..." }` |
| **Verify OTP** | Async | `supabase.auth.verifyOtp()` | `{ email: "...", token: "...", type: "magiclink" }` |
| **Get Session** | Sync | `supabase.auth.getSession()` | - |
| **Sign Out** | Async | `supabase.auth.signOut()` | - |

### 3.2. Klas API Endpoints
| Feature | Method | Endpoint | Body/Params | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **Link Student** | `POST` | `/auth/link-student`| `{ "name": "..." }` | Yes (Bearer) |
| **Attendance** | `POST` | `/absen` | `{ "status": "HADIR" }` | Yes (Bearer) |
| **Fetch Data** | `GET` | `/students` | - | No (Public)* |

*> **Note on Data Fetching**: Currently, the API only provides `GET /students` which lists **all** students. The app will need to fetch this list and filter locally by the logged-in `user_id` to find the current student's details (like `last_status`, `kelas`, etc.). Future API optimization recommended: `GET /students/me`.*

### 3.3. Data Models (TypeScript)

**User**
```typescript
interface User {
  id: string;
  email: string;
  // ... other supabase user fields
}
```

**Student**
```typescript
interface Student {
  id: number;
  nisn: string;
  nama: string;
  jenis_kelamin: string;
  tanggal_lahir: string; // 'YYYY-MM-DD'
  tempat_lahir: string;
  alamat: string;
  kelas: number; // references class.id
  user_id?: string; // optional link to auth user
}
```

**AttendanceResponse**
```typescript
interface AttendanceResponse {
  message: string;
  attendance?: Attendance;
}
```

## 4. Technical Stack Recommendation
*   **Frontend Framework**: React (TypeScript)
*   **UI Framework**: Tailwind CSS or Material-UI
*   **State Management**: React Context + Hooks or Zustand
*   **Authentication**: Supabase Client (@supabase/supabase-js)
*   **Network**: Fetch API or axios
*   **JSON Parsing**: Native JSON
*   **Async**: React hooks + async/await
*   **Form Handling**: React Hook Form
*   **Routing**: React Router v6
*   **Testing**: Vitest / Jest + React Testing Library
*   **Build Tool**: Vite

## 5. Implementation Steps
1.  **Setup Project**: Create React + TypeScript project using Vite or Create React App.
2.  **Initialize Supabase**: Set up Supabase client with project URL and anon key. Create authentication context for managing session state.
3.  **Network Layer**: Create API client module with functions for Klas API endpoints. Use Supabase session token for Bearer authentication.
4.  **Auth Flow**: Build Login and OTP Verification pages using Supabase client methods.
    *   Handle OTP sending: `supabase.auth.signInWithOtp({ email })`
    *   Handle OTP verification: `supabase.auth.verifyOtp({ email, token })`
    *   Persist session with Supabase's built-in session management.
5.  **Student Context**: After successful authentication, fetch `GET /students` and find the matching student by `user_id`. Store student data in React Context/State.
    *   *If no student found*: Prompt user to "Link Account" (Enter Name -> `POST /auth/link-student`).
6.  **Home Screen**: Build dashboard UI to display status. Wire up attendance submission with `POST /absen`.
7.  **Profile Page**: Display student information fetched from context.
8.  **Error Handling**: Handle authentication errors, 409 (Already Checked In), 400 (Bad Request). Implement error boundaries.
9.  **Responsive Design**: Ensure mobile-friendly design for web access on phones/tablets.

## 6. Future Improvements (Backend)
*   Add `GET /students/me` endpoint to avoid fetching the entire student database on the client.
*   Add `GET /attendances/history` to allow students to see their past records.
*   Implement password-less authentication flow optimization.
