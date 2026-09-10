/**
 * The host half: the Node runner's `inflate` over the real zlib, on the
 * bytes Git wrote. `proof.f.mjs` proves the module against a host stood in
 * for; this proves the one operation the module adds to the host, on the
 * host it was written for.
 *
 * **Nothing here touches the filesystem.** The Deno test task runs with
 * `--allow-read` and no `--allow-write`, and no proof in the repository
 * writes to disk, so a round trip through a temporary file is a permission
 * the suite does not grant rather than a proof. `readFile` is the runner's
 * own, proven operation; the chain that reads a file and inflates it is
 * proven against the mock host, and this is the inflater alone.
 *
 * @import { NodeProgram } from '../../effects/node/types.ts'
 */

import zlib from 'node:zlib'

import { assertEq } from '../../asserts/module.f.mjs'
import { mapStep, resultMapStep } from '../../effects/module.f.mjs'
import { inflate } from '../../effects/node/module.f.mjs'
import { runEffect } from '../../effects/node/module.mjs'
import { maxLengthBytes, msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { tryRead as readEnvelope } from '../object/module.f.mjs'
import { tagLoose, tagPayload } from '../testlib.f.mjs'

/** @type {(program: NodeProgram) => Promise<number>} */
const exitCode = runEffect

export const proof = {
    // The signed tag's loose file, as Git wrote it, through the real
    // inflater and past its envelope: the tag's payload, byte for byte.
    tag: async () => {
        const inflated = inflate(u8ListToVec(msb)(tagLoose))
        const envelope = mapStep(inflated, v => readEnvelope(u8List(msb)(v)))
        /** @type {NodeProgram} */
        const program = () => resultMapStep(envelope, r => {
            if (r[0] === 'error') { return error(1) }
            const e = r[1]
            if (e === null || e.type !== 'tag') { return error(2) }
            const payload = toArray(e.payload)
            return payload.length === tagPayload.length && payload.every((b, i) => b === tagPayload[i]) ? ok(0) : error(3)
        })
        assertEq(await exitCode(program), 0)
    },
    // Bytes that are no zlib stream are the channel's: Node's own code, kept.
    notZlib: async () => {
        /** @type {NodeProgram} */
        const program = () => resultMapStep(inflate(u8ListToVec(msb)([0x6A, 0x75, 0x6E, 0x6B])), r =>
            r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'Z_DATA_ERROR' ? ok(0) : error(1))
        assertEq(await exitCode(program), 0)
    },
    // A stream that inflates past the bound is refused, not cut short:
    // one byte over `maxLengthBytes` is `ERR_BUFFER_TOO_LARGE`, and the
    // bound itself inflates.
    bound: async () => {
        const most = Number(maxLengthBytes)
        const over = toVec(zlib.deflateSync(new Uint8Array(most + 1)))
        const most_ = toVec(zlib.deflateSync(new Uint8Array(most)))
        /** @type {NodeProgram} */
        const program = () => resultMapStep(inflate(over), r =>
            r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'ERR_BUFFER_TOO_LARGE' ? ok(0) : error(1))
        assertEq(await exitCode(program), 0)
        /** @type {NodeProgram} */
        const fits = () => resultMapStep(inflate(most_), r => r[0] === 'ok' ? ok(0) : error(1))
        assertEq(await exitCode(fits), 0)
    },
}
