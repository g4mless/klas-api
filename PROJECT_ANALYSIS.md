# MyKelas Project Analysis & Documentation

## 1. Project Overview
**MyKelas** is a web application designed for student management, specifically focusing on attendance tracking and profile management. It allows users (likely parents or students) to log in, link their account to a specific student record, view daily attendance status, and manage their profile.

## 2. Technology Stack
The project uses a modern frontend stack:
- **Framework**: [React Router v7](https://reactrouter.com/) (formerly Remix features integrated into React Router)
- **UI Library**: React v19
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Backend/Auth**: Supabase
- **Language**: TypeScript

## 3. Project Structure
The project follows the standard React Router v7 (Remix-like) directory structure:

```
d:\Documents\mykelas
├── app/
│   ├── components/       # Reusable UI components (e.g., Avatar)
│   ├── lib/              # Utilities and API clients
│   │   ├── env.ts        # Environment variable handling
│   │   ├── klas-api.ts   # API wrapper for backend communication
│   │   └── supabase-client.ts # Supabase client initialization
│   ├── providers/        # React Context Providers (Auth, Student)
│   ├── routes/           # Route definitions (Pages)
│   ├── root.tsx          # Root layout and global styles
│   └── routes.ts         # Route configuration
├── public/               # Static assets
├── .env                  # Environment variables
├── package.json          # Dependencies and scripts
└── vite.config.ts        # Vite configuration
```

## 4. Key Features & Routes

### Authentication
- **Login** (`/login`): Entry point for users to authenticate.
- **Verify OTP** (`/verify`): Handles One-Time Password verification for secure login.
- **Auth Provider**: `app/providers/auth-provider` manages the session state using Supabase.

### Student Management
- **Link Student** (`/link-student`): A critical step where an authenticated user links their account to a specific student record.
- **Student Provider**: `app/providers/student-provider` manages the student state throughout the app.

### Dashboard & Protected Area
- **Protected Layout** (`app/routes/protected.tsx`):
    - Acts as a layout wrapper for authenticated routes.
    - Checks for valid session and student linkage.
    - Redirects to `/login` or `/link-student` if requirements aren't met.
    - Displays the header with student name and avatar.
- **Dashboard** (`/`): The main view showing daily status and attendance options.
- **Profile** (`/profile`): Allows viewing and updating student profile information, including profile picture upload.

## 5. API Integration (`app/lib/klas-api.ts`)
The application communicates with a backend API (`KLAS_API_URL`) for data operations. Key API functions include:
- `fetchStudents`: Retrieves a list of students.
- `linkStudent`: Links a user account to a student.
- `submitAttendance`: Posts attendance status.
- `fetchTodayStatus`: Gets the current day's attendance status.
- `fetchProfilePicture` / `uploadProfilePicture`: Manages student avatars.

## 6. Development Scripts
- `npm run dev`: Starts the development server (`react-router dev`).
- `npm run build`: Builds the application for production (`react-router build`).
- `npm start`: Serves the built application (`react-router-serve`).
