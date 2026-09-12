/**
 * Types for the refs a repository holds, read over the effects.
 *
 * @module
 */

import type { Bytes, Oid } from '../types.ts'

/**
 * One ref the repository holds: the name the files spell it under, and the
 * id it effectively names.
 *
 * The name is bytes rather than text, because Git stores and compares a ref
 * name byte for byte and never decodes one. A loose ref's name reaches this
 * module as a path from the host, which node has already decoded as UTF-8,
 * so it is encoded back to bytes to be one name with a `packed-refs` line's.
 *
 * The name carries no meaning beyond telling two refs apart. It comes along
 * because the files hold it, and a consumer that reads a policy into one is
 * outside the design `todo/git-name-resolution.md` fixes.
 */
export type Root = {
    readonly name: Bytes
    readonly id: Oid
}
