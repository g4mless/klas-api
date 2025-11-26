export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SuccessResponse<T = any> {
  data: T;
  message?: string;
}

export const ErrorCodes = {
  INVALID_JSON: 'INVALID_JSON',
  MISSING_FIELD: 'MISSING_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  STUDENT_NOT_LINKED: 'STUDENT_NOT_LINKED',
  ATTENDANCE_ALREADY_EXISTS: 'ATTENDANCE_ALREADY_EXISTS',
  INVALID_STATUS: 'INVALID_STATUS',
  TABLE_NOT_ALLOWED: 'TABLE_NOT_ALLOWED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}
