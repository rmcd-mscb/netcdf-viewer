/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * @param unsafe - String that may contain HTML special characters
 * @returns Escaped string safe for HTML insertion
 */
export function escapeHtml(unsafe: unknown): string {
  let str: string;
  if (unsafe === null) {
    str = 'null';
  } else if (unsafe === undefined) {
    str = 'undefined';
  } else if (typeof unsafe === 'object') {
    // Handle arrays and objects; JSON.stringify may throw on circular or non-serializable values
    try {
      str = JSON.stringify(unsafe);
    } catch {
      str = '[Object]';
    }
  } else {
    str = String(unsafe);
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
