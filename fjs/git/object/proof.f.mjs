/**
 * @import { Bytes } from '../types.ts'
 * @import { Envelope } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { fromArrayLike } from '../../types/list/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { commitPayload, latin1, undefinedByte } from '../testlib.f.js'
import { objectTypes, tryLength, tryRead, tryType, write } from './module.f.mjs'

/** @type {(input: Bytes) => Envelope} */
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
        assertStructurallySame(object.slice(0, 12), latin1('commit 3285\u0000'))
        assertEq(object.length, 12 + 3_285)
        const e = read(object)
        assertEq(e.type, 'commit')
        assertStructurallySame(toArray(e.payload), commitPayload)
    },
    // The four types, with an empty payload: the envelope alone.
    types: () => {
        for (const type of objectTypes) {
            const object = toArray(write(type, []))
            assertStructurallySame(object, latin1(`${type} 0\u0000`))
            const e = read(object)
            assertEq(e.type, type)
            assertStructurallySame(toArray(e.payload), [])
        }
    },
    // Each of the four names reads as its type; bytes that spell none of
    // them, or that are not bytes at all, read as `null`. An item above
    // `0xFF` is compared, not truncated, so it cannot pass for the byte it
    // would truncate to.
    tryType: () => {
        for (const type of objectTypes) {
            assertEq(tryType(latin1(type)), type)
        }
        assertEq(tryType([]), null)
        assertEq(tryType(latin1('blobs')), null)
        assertEq(tryType(latin1('blo')), null)
        assertEq(tryType(latin1('Blob')), null)
        assertEq(tryType([0x11_0062, 0x11_006c, 0x11_006f, 0x11_0062]), null)
        assertEq(tryType([0x162, 0x16c, 0x16f, 0x162]), null)
    },
    // The payload is sliced, not read: any byte may follow the NUL.
    binary: () => {
        const e = read([...latin1('blob 3\u0000'), 0xFF, 0, 0x80])
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), [0xFF, 0, 0x80])
    },
    // A lazy input, as a boundary hands one over: read as the list it is,
    // and the payload handed back is a list over it, read again as often
    // as a consumer reads it.
    lazy: () => {
        const e = read(fromArrayLike(new Uint8Array(latin1('tree 2\u0000ab'))))
        assert(!(e.payload instanceof Array))
        assertStructurallySame(toArray(e.payload), latin1('ab'))
        assertStructurallySame(toArray(e.payload), latin1('ab'))
        assertStructurallySame(toArray(write('tree', e.payload)), latin1('tree 2\u0000ab'))
    },
    // The length an envelope claims, which is all of the object, and none where
    // there is no envelope; the payload is not looked at.
    length: () => {
        assertEq(tryLength(latin1('blob 5\u0000hello')), 12)
        assertEq(tryLength(latin1('tree 0\u0000')), 7)
        assertEq(tryLength(latin1('blob 5\u0000')), 12)
        assertEq(tryLength(latin1('blob 05\u0000')), null)
        assertEq(tryLength(latin1('foo 1\u0000')), null)
        assertEq(tryLength([]), null)
    },
    // Each refusal, one per condition the reader checks.
    refused: () => {
        assertEq(tryRead([]), null)
        assertEq(tryRead(latin1('blob 5\u0000hell')), null)     // shorter than claimed
        assertEq(tryRead(latin1('blob 3\u0000hell')), null)     // longer than claimed
        assertEq(tryRead(latin1('blobs 0\u0000')), null)        // no such type
        assertEq(tryRead(latin1('Blob 0\u0000')), null)         // the four are lower-case
        assertEq(tryRead(latin1('blob \u0000')), null)          // no digits
        assertEq(tryRead(latin1('blob 00\u0000')), null)        // not canonical decimal
        assertEq(tryRead(latin1('blob 01\u0000x')), null)       // not canonical decimal
        assertStructurallySame(toArray(read(latin1('blob 10\u0000abcdefghij')).payload), latin1('abcdefghij'))
        assertEq(tryRead(latin1('blob x\u0000')), null)         // not digits
        assertEq(tryRead(latin1('blob 0')), null)           // no NUL
        assertEq(tryRead(latin1('blob 99999999999999999\u0000')), null)  // not a safe integer
        assertEq(tryRead(latin1('blob 0000000000000000000000000000\u0000')), null)  // past the prefix
    },
    // A number that is no byte is refused wherever it sits — after the
    // prefix the parser reads, or in a payload to write — rather than read
    // or written as a plausible object.
    throw: {
        readNonByte: () => tryRead([...latin1('blob 2\u0000'), 0, 0x100]),
        readNonByteBeyondPrefix: () => tryRead([...latin1('blob 30\u0000'), ...latin1('x'.repeat(29)), 0x100]),
        writeNonByte: () => write('blob', [0x100]),
        writeFraction: () => write('blob', [0.5]),
        // An undefined value is no byte, in the prefix the parser reads or
        // in the payload the fold counts.
        readUndefinedByteInPrefix: () => tryRead(undefinedByte),
        readUndefinedByteInPayload: () => tryRead([...latin1('blob 2\u0000'), ...toArray(undefinedByte)]),
        writeUndefinedByte: () => write('blob', undefinedByte),
    },
}
