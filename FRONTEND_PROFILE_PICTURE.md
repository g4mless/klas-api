# Student Profile Picture Feature – Frontend Notes

## Overview
This backend now exposes dedicated endpoints for students to upload and retrieve their profile pictures. All requests require a valid Supabase access token in the `Authorization: Bearer <token>` header.

## Upload Flow (`POST /students/profile-picture`)
- **Request body**: `multipart/form-data` with an `avatar` (or `file`) field containing the image file.
- **Accepted types**: defaults to `image/png,image/jpeg,image/jpg,image/webp`; enforce client-side validation to avoid unnecessary uploads.
- **Size limit**: ~2 MB (`STUDENT_AVATAR_MAX_SIZE`). Check file size before submitting.
- **Response**:
  ```json
  {
    "message": "Profile picture updated",
    "avatar_path": "<bucket path>",
    "avatar_url": "<signed url or null>"
  }
  ```
  Use `avatar_url` immediately for preview; it expires after `STUDENT_AVATAR_SIGNED_URL_TTL` seconds (default 3600).

## Fetching Current Avatar (`GET /students/profile-picture`)
- Returns `{ avatar_path, avatar_url, expires_in }` if an image exists; 404 otherwise.
- Re‑fetch when the signed URL nears expiration or after an upload succeeds.

## Student Directory (`GET /students`)
- Each student object now includes `avatar_url` (signed) when an avatar is set.
- URLs are short-lived; cache cautiously and refresh as needed.

## Implementation Tips
1. **Upload widget**: use `FormData` and `fetch`/XHR; ensure `Content-Type` is left for the browser to set.
2. **Optimistic UI**: show local preview while waiting; replace with returned `avatar_url` on success.
3. **Error handling**: surface backend codes for invalid type, size, or auth failures.
4. **Token sourcing**: reuse the access token already obtained from the Supabase auth flow.
5. **Bucket name**: defaults to `student-avatars`; align with backend env overrides if they change.
