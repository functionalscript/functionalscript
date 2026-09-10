/**
 * @import { Inflate, ReadFile } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { msb, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { latin1, tagLoose, tagPayload } from '../testlib.f.mjs'
import { tryRead } from './module.f.mjs'

const toVec = u8ListToVec(msb)

const compressed = toVec(tagLoose)

/** What the host inflates {@link compressed} to: the envelope and the payload. */
const inflated = toVec(toArray(writeEnvelope('tag', tagPayload)))

/** A stream the host inflates to bytes that are no object. */
const junk = toVec(latin1('junk'))

const notZlib = ioError({ code: 'Z_DATA_ERROR', message: 'incorrect header check' })

/**
 * A host that holds two files and inflates two streams, and logs every
 * command it answers, so a proof can see which ran and in what order.
 *
 * @type {MemOperationMap<ReadFile | Inflate, readonly string[]>}
 */
const host = {
    readFile: path => log => [
        [...log, `readFile ${path}`],
        path === 'tag' ? ok(compressed)
            : path === 'junk' ? ok(junk)
            : path === 'text' ? ok(inflated)
            : error(ioError({ code: 'ENOENT', message: `no such file: ${path}` })),
    ],
    inflate: data => log => [
        [...log, 'inflate'],
        uint(data) === uint(compressed) ? ok(inflated)
            : uint(data) === uint(junk) ? ok(junk)
            : error(notZlib),
    ],
}

const runHost = run(host)([])

export const proof = {
    // The signed tag's loose file: read, inflated, and past its envelope,
    // the payload Git wrote, byte for byte; the two commands in order.
    tag: () => {
        const [log, r] = runHost(tryRead('tag'))
        assertStructurallySame(log, ['readFile tag', 'inflate'])
        assert(r[0] === 'ok')
        const e = r[1]
        assert(e !== null)
        assertEq(e.type, 'tag')
        assertStructurallySame(toArray(e.payload), tagPayload)
    },
    // Bytes that inflate to no object are `null`, not an error: the host
    // did its part.
    notAnObject: () => {
        const [log, r] = runHost(tryRead('junk'))
        assertStructurallySame(log, ['readFile junk', 'inflate'])
        assertStructurallySame(r, ['ok', null])
    },
    // A file that cannot be read is the channel's, and nothing is inflated.
    missing: () => {
        const [log, r] = runHost(tryRead('missing'))
        assertStructurallySame(log, ['readFile missing'])
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
    },
    // A file that is no zlib stream is the channel's too, as the host says.
    notZlib: () => {
        const [log, r] = runHost(tryRead('text'))
        assertStructurallySame(log, ['readFile text', 'inflate'])
        assertStructurallySame(r, ['error', notZlib])
    },
}
