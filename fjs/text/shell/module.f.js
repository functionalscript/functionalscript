/**
 * Strings as literal POSIX shell words.
 *
 * @module
 */

/**
 * A literal POSIX shell argument, or `null` for NUL, which shell arguments
 * cannot contain. Nothing inside single quotes is special to the shell but the
 * quote itself, so `'` is written as the quote closed, the character escaped,
 * and the quote reopened. NUL is a permanent shell limitation; the caller must
 * explain the refusal.
 *
 * @type {(text: string) => string | null}
 */
export const tryShellQuote = text => text.includes('\u0000') ? null : `'${text.replaceAll("'", "'\\''")}'`
