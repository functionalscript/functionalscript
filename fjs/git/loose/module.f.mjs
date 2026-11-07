/**
 * A loose object as it sits on disk, `.git/objects/xx/yyyy…`: one zlib
 * stream holding the envelope and the payload. The file is read whole, in the
 * chunks one open takes, and inflated by
 * [`fjs/zlib/inflate`](../../zlib/inflate/module.f.mjs), a pure inflater; the
 * inflated bytes are read by the pure envelope reader. This module is the
 * boundary between the three, and the writer of the same file:
 * {@link write} stores the envelope as one zlib stream through
 * [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs), under a temporary
 * name renamed into place. One of the two places a real
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
 * @import { IoChannel, Mkdir, RandomInt, ReadWhole, Rename, Rm, WriteExclusive } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { catchStep, compensateStep, history, historyStep, mapStep, pureOk, refuse, step } from '../../effects/module.f.mjs'
import { mkdir, random256, readWhole, rename, rm, writeExclusive } from '../../effects/node/module.f.mjs'
import { join, parent, under } from '../../path/module.f.js'
import { u8ListToMaxVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { stored } from '../../zlib/stored/module.f.mjs'
import { bytesOf, inflateWithin } from '../inflater/module.f.mjs'
import { tryLength, tryRead as readEnvelope, write as writeEnvelope } from '../object/module.f.mjs'
import { hexText, of } from '../oid/module.f.mjs'

/**
 * How much output holds an envelope whole: `commit`, a space, sixteen digits and
 * the NUL are 24 bytes, so by 32 it is there or no envelope is.
 */
const envelopeBytes = 32

/**
 * Reads the loose object at `file`: the file, inflated, past its envelope.
 * `null` where the inflated bytes are no object — no envelope, or a
 * payload not as long as the envelope claims; a file that cannot be read,
 * or is no zlib stream, or holds bytes after its stream, is the channel's.
 *
 * @type {(file: string) => Effect<ReadWhole, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = file => step(readWhole(file), chunks => {
    const inflated = inflateWithin(envelopeBytes, tryLength)(chunks)
    return inflated[0] === 'error'
        ? refuse(inflated[1].code)(inflated[1].message)
        : pureOk(inflated[1] === null ? null : readEnvelope(bytesOf(inflated[1])))
})

/**
 * Where a loose object lives below the object directory `od`: a directory
 * named by the first two hex digits of the id, a file named by the rest.
 *
 * **The key is the `objects/` directory and not the repository**, because an
 * `objects/info/alternates` names object directories directly — see
 * [`fjs/git/store`](../store/module.f.mjs)'s `objectsDirs`, whose
 * `objectPath` is this one below a repository's `objects/`.
 *
 * @type {(od: string, id: Oid) => string}
 */
export const path = (od, id) => {
    const h = hexText(id)
    return under(od, join(h.slice(0, 2), h.slice(2)))
}

/**
 * Writes an object into the object directory `od`, as the loose file
 * Git stores one in — `<type> SP <size> NUL <payload>`, one zlib stream, at
 * `ab/<rest>` of its id below `od`, {@link path} — and answers the id. An
 * object already
 * there is read as the loose file it is and left as it is where it is the
 * object: the id names its bytes, so nothing is to be written. A file at
 * the path that is not the object — truncated, no zlib stream, another
 * object's bytes — is replaced, since a `stat` alone would have taken it
 * for the object and a later read would refuse what this write had
 * reported stored. The file itself is read, not the store: the store's
 * reader answers from a pack or a borrowed directory too, and the object
 * being there would leave a corrupt loose file in place for Git to refuse
 * later. Otherwise the stream goes to a temporary name
 * in `od`, as Git's own `tmp_obj_*` does, and is renamed into place
 * once whole, so no reader meets a loose file that is not an object; a
 * rename that fails takes the temporary file with it.
 *
 * The payload is held whole: the envelope states the size before the
 * bytes, which is the limit
 * [`fjs/cas/git/todo/streaming-writes.md`](../../cas/git/todo/streaming-writes.md) records.
 *
 * @throws If an item of `payload` is not a byte, as the envelope's writer throws.
 *
 * @type {(od: string, oidBytes: OidBytes) => (type: ObjectType, payload: Bytes) => Effect<ReadWhole | Mkdir | WriteExclusive | Rename | Rm | RandomInt, Oid, IoChannel>}
 */
export const write = (od, oidBytes) => {
    const idOf = of(oidBytes)
    return (type, payload) => {
        const id = idOf(type, payload)
        const at = path(od, id)
        // Anything but the object at the path — no file, a stream that is no
        // zlib stream, no object, bytes hashing to another id — is an object
        // to write.
        const there = catchStep(mapStep(tryRead(at), o => o !== null && idOf(o.type, o.payload) === id), () => pureOk(false))
        return step(there, found => {
            if (found) { return pureOk(id) }
            const named = history(mapStep(random256, rnd => join(od, `tmp_obj_${vecToCBase32(rnd)}`)))
            const made = historyStep(named, () => mkdir(parent(at), { recursive: true }))
            const filled = historyStep(made, (_, tmp) => writeExclusive(tmp, toArray(u8ListToMaxVecChunksMsb(stored(writeEnvelope(type, payload))))))
            return step(filled, ([, , tmp]) => {
                const moved = compensateStep(rename(tmp, at), rm(tmp))
                return mapStep(moved, () => id)
            })
        })
    }
}
