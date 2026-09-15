/**
 * Types for the objects a pack directory holds, read over the effects.
 *
 * @module
 */

import type { Envelope } from '../object/types.ts'

/**
 * An object a pack answered for, and the pack that held it.
 *
 * **The path is here because the id check is not.** `tryRead` does not hash
 * what it answers — [`fjs/git/store`](../store/module.f.mjs) does that for
 * whichever file answered, and doing it twice would hash every object read
 * twice — so the caller that finds the bytes hashing to another id is not the
 * one that knows which file they came from. A directory holds any number of
 * packs and an object store any number of directories, so naming the directory
 * in that refusal names a place rather than a file. This carries the file out
 * to where the refusal is written.
 */
export type Held = {
    readonly envelope: Envelope
    readonly path: string
}
