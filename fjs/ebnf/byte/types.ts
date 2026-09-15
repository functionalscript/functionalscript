/**
 * Type-level API of the byte alphabet: the metadata of a byte.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Set } from '../types.ts'
import type { byte } from './module.f.mjs'

// The universe is every byte, spelled as the range it is. This was
// `./proof.f.mjs`'s `byte` entry, where it sat after the entry's last
// statement and so bound to nothing, green whatever it claimed
// (`../../AGENTS.md` §1.4). The two claims left there are about what a call
// site infers, which has no module-scope spelling, so they stay and a
// statement now follows each.
type _ByteSpelling = Assert<Equal<typeof byte, Set<readonly ['rangeEncode', 0, 255]>>>

/**
 * The metadata of a byte with nothing the grammar ignored about it — the
 * alphabet's `id` and nothing else. A caller that knows more about a byte,
 * its offset say, hands over a record carrying this `id` beside it, and a
 * parser over this alphabet accepts it as it is.
 */
export type Byte = { readonly id: 'byte' }
