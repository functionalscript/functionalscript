/**
 * A loose object as it sits on disk, `.git/objects/xx/yyyy…`: one zlib
 * stream holding the envelope and the payload. Inflating it is the host's,
 * behind the `inflate` effect, and reading the inflated bytes is the pure
 * envelope reader's; this module is the boundary between the two, and
 * nothing more — the one place a real repository meets the decoder.
 *
 * The bytes come back as a `Vec`, the bound every host effect here has,
 * 128 KiB, and the file goes in as one too, so a loose object is refused on
 * either side of its stream, through the channel and never cut short: a
 * file over the bound before it is inflated, `readFile`'s refusal, and a
 * stream that inflates past it, `inflate`'s. The first binds an object the
 * second would take — an incompressible blob near the bound is larger
 * compressed than plain. A FunctionalScript inflater over a byte list,
 * fed a window at a time, lifts both; it is its own issue,
 * [`todo/inflate.md`](../../../todo/inflate.md).
 *
 * @module
 *
 * @import { Inflate, IoChannel, ReadFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Envelope } from '../object/types.ts'
 */

import { mapStep, step } from '../../effects/module.f.mjs'
import { inflate, readFile } from '../../effects/node/module.f.mjs'
import { msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { tryRead as readEnvelope } from '../object/module.f.mjs'

const toBytes = u8List(msb)

/**
 * Reads the loose object at `path`: the file, inflated, past its envelope.
 * `null` where the inflated bytes are no object — no envelope, or a
 * payload not as long as the envelope claims; a file that cannot be read,
 * or is no zlib stream, or holds bytes after its stream, or inflates past
 * the bound, is the channel's.
 *
 * @type {(path: string) => Effect<ReadFile | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = path => {
    const compressed = readFile(path)
    const inflated = step(compressed, inflate)
    return mapStep(inflated, v => readEnvelope(toBytes(v)))
}
