// Maximum file size for session file uploads: 50 MB (must match backend MAX_FILE_SIZE_BYTES)
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx', '.doc', '.rtf', '.odt',
  '.xlsx', '.xls', '.ods',
  '.pptx', '.ppt', '.odp',
  '.txt', '.md', '.csv'
];

export function isAllowedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
}

/** Returns an error message string if invalid, or null if valid. */
export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

/** Returns an error message string if invalid, or null if valid. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}
