/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * @param unsafe - String that may contain HTML special characters
 * @returns Escaped string safe for HTML insertion
 */
export function escapeHtml(unsafe: unknown): string {
  const str = String(unsafe ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
