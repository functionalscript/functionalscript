/**
 * Type-level API of a tree: its entries.
 *
 * @module
 */

import type { Bytes, Oid } from '../types.ts'

/**
 * One entry of a tree, byte for byte: the mode as the octal digits it was
 * spelled with — `0100644` and `100644` are one number and two spellings,
 * Git writes the unpadded one and `git fsck` only warns about the other,
 * so both exist and a writer owes the spelling it read — the name as the
 * bytes the file system gave, and the id as the raw bytes the format fixes
 * the width of. `mode` in `./module.f.mjs` reads the number off the digits.
 */
export type TreeEntry = {
    readonly mode: Bytes
    readonly name: Bytes
    readonly oid: Oid
}
