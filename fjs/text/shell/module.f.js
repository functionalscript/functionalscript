/**
 * Strings as literal POSIX shell words.
 *
 * @module
 */

import { assertNotNullish } from '../../asserts/module.f.js'

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

/**
 * {@link tryShellQuote} for text that cannot hold NUL — a path, an argv entry,
 * source text a JSON escaper wrote. A NUL there is a broken caller, so it
 * fails the assertion rather than reaching the shell.
 *
 * @type {(text: string) => string}
 */
export const shellQuote = text => assertNotNullish(tryShellQuote(text), 'a shell word cannot hold NUL')
