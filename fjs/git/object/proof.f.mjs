/**
 * @import { Envelope } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { fromArrayLike, toArray } from '../../types/list/module.f.mjs'
import { commitPayload, latin1 } from '../testlib.f.mjs'
import { objectTypes, tryRead, write } from './module.f.mjs'

/** @type {(input: readonly number[]) => Envelope} */
const read = input => {
    const e = tryRead(input)
    assert(e !== null)
    return e
}

export const proof = {
    // A real commit: its envelope names the type and the payload's length,
    // and reading the written object gives the payload back untouched.
    commit: () => {
        const object = toArray(write('commit', commitPayload))
        assertStructurallySame(object.slice(0, 12), latin1('commit 3285\0'))
        assertEq(object.length, 12 + 3285)
        const e = read(object)
        assertEq(e.type, 'commit')
        assertStructurallySame(toArray(e.payload), commitPayload)
    },
    // The four types, with an empty payload: the envelope alone.
    types: () => {
        for (const type of objectTypes) {
            const object = toArray(write(type, []))
            assertStructurallySame(object, latin1(`${type} 0\0`))
            const e = read(object)
            assertEq(e.type, type)
            assertStructurallySame(toArray(e.payload), [])
        }
    },
    // The payload is sliced, not read: any byte may follow the NUL.
    binary: () => {
        const e = read([...latin1('blob 3\0'), 0xFF, 0, 0x80])
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), [0xFF, 0, 0x80])
    },
    // A lazy input, as a boundary hands one over.
    lazy: () => {
        const e = read(toArray(fromArrayLike(new Uint8Array(latin1('tree 2\0ab')))))
        assertStructurallySame(toArray(e.payload), latin1('ab'))
    },
    // Each refusal, one per condition the reader checks.
    refused: () => {
        assertEq(tryRead([]), null)
        assertEq(tryRead(latin1('blob 5\0hell')), null)     // shorter than claimed
        assertEq(tryRead(latin1('blob 3\0hell')), null)     // longer than claimed
        assertEq(tryRead(latin1('blobs 0\0')), null)        // no such type
        assertEq(tryRead(latin1('Blob 0\0')), null)         // the four are lower-case
        assertEq(tryRead(latin1('blob \0')), null)          // no digits
        assertEq(tryRead(latin1('blob 00\0')), null)        // not canonical decimal
        assertEq(tryRead(latin1('blob 01\0x')), null)       // not canonical decimal
        assertStructurallySame(toArray(read(latin1('blob 10\0abcdefghij')).payload), latin1('abcdefghij'))
        assertEq(tryRead(latin1('blob x\0')), null)         // not digits
        assertEq(tryRead(latin1('blob 0')), null)           // no NUL
        assertEq(tryRead(latin1('blob 99999999999999999\0')), null)  // not a safe integer
        assertEq(tryRead(latin1('blob 0000000000000000000000000000\0')), null)  // past the prefix
    },
    // A number that is no byte is refused wherever it sits — after the
    // prefix the parser reads, or in a payload to write — rather than read
    // or written as a plausible object.
    throw: {
        readNonByte: () => tryRead([...latin1('blob 2\0'), 0, 0x100]),
        readNonByteBeyondPrefix: () => tryRead([...latin1('blob 30\0'), ...latin1('x'.repeat(29)), 0x100]),
        writeNonByte: () => write('blob', [0x100]),
        writeFraction: () => write('blob', [0.5]),
    },
}
