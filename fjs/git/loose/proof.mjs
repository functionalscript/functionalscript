/**
 * The host half: the Node runner's `inflate` over the real zlib, driven
 * through {@link tryRead} on a file written for the purpose and removed
 * after. `proof.f.mjs` proves the module against a host stood in for; this
 * proves the one it was written for.
 *
 * @import { NodeProgram } from '../../effects/node/types.ts'
 */

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import zlib from 'node:zlib'

import { assertEq } from '../../asserts/module.f.mjs'
import { history, historyStep, resultMapStep, step } from '../../effects/module.f.mjs'
import { inflate, rm, writeFile } from '../../effects/node/module.f.mjs'
import { runEffect } from '../../effects/node/module.mjs'
import { maxLengthBytes, msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { tagLoose, tagPayload } from '../testlib.f.mjs'
import { tryRead } from './module.f.mjs'

/** @type {(name: string) => string} */
const tmp = name => `${os.tmpdir()}/fjs-git-loose-${randomUUID()}-${name}`

/** @type {(program: NodeProgram) => Promise<number>} */
const exitCode = runEffect

export const proof = {
    // The signed tag's loose file, written as Git wrote it, read back
    // through the real inflater: the tag's payload, byte for byte.
    tag: async () => {
        const path = tmp('tag')
        const written = writeFile(path, u8ListToVec(msb)(tagLoose))
        const read = history(step(written, () => tryRead(path)))
        const removed = historyStep(read, () => rm(path))
        /** @type {NodeProgram} */
        const program = () => resultMapStep(removed, r => {
            if (r[0] === 'error') { return error(1) }
            const e = r[1][1]
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
        const program = () => resultMapStep(history(inflate(over)), r =>
            r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'ERR_BUFFER_TOO_LARGE' ? ok(0) : error(1))
        assertEq(await exitCode(program), 0)
        /** @type {NodeProgram} */
        const fits = () => resultMapStep(inflate(most_), r => r[0] === 'ok' ? ok(0) : error(1))
        assertEq(await exitCode(fits), 0)
    },
}
