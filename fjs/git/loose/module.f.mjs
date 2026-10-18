/**
 * A loose object as it sits on disk, `.git/objects/xx/yyyy…`: one zlib
 * stream holding the envelope and the payload. The file is read whole, in the
 * chunks one open takes, and inflated by
 * [`fjs/zlib/inflate`](../../zlib/inflate/module.f.mjs), a pure inflater; the
 * inflated bytes are read by the pure envelope reader. This module is the
 * boundary between the three, and nothing more. One of the two places a real
 * repository meets the decoder — [`fjs/git/packstore`](../packstore/module.f.mjs)
 * is the other, and is the one a clone takes for most of its objects.
 *
 * Nothing here is bounded by a `Vec`. The file is as many chunks as it takes
 * and the object as many as it inflates to, and the payload is a list over them,
 * as long as the object is. The host's `inflate` effect, which this used,
 * answered one `Vec` of 128 KiB at most for one of the same, so a blob over that
 * was refused; roughly one in a hundred in this repository.
 *
 * `readWhole` and not `readFile`, which answers one `Vec`, and not a run of
 * windows, which can straddle a rename: one open is one snapshot of the file.
 *
 * @module
 *
 * @import { IoChannel, ReadWhole } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Envelope } from '../object/types.ts'
 */

import { pureOk, refuse, step } from '../../effects/module.f.mjs'
import { readWhole } from '../../effects/node/module.f.mjs'
import { bytesOf, inflateAll } from '../inflater/module.f.mjs'
import { tryRead as readEnvelope } from '../object/module.f.mjs'

/**
 * Reads the loose object at `path`: the file, inflated, past its envelope.
 * `null` where the inflated bytes are no object — no envelope, or a
 * payload not as long as the envelope claims; a file that cannot be read,
 * or is no zlib stream, or holds bytes after its stream, is the channel's.
 *
 * @type {(path: string) => Effect<ReadWhole, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = path => step(readWhole(path), chunks => {
    const inflated = inflateAll(chunks)
    return inflated[0] === 'error'
        ? refuse(inflated[1].code)(inflated[1].message)
        : pureOk(readEnvelope(bytesOf(inflated[1])))
})
