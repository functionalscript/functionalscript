/**
 * @import { Payload } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { commitPayload, latin1 } from '../testlib.f.mjs'
import { tryRead, write } from './module.f.mjs'

/** @type {(input: readonly number[]) => Payload} */
const read = input => {
    const p = tryRead(input)
    assert(p !== null)
    return p
}

/** @type {(p: Payload) => readonly (readonly [string, string])[]} */
const text = p => p.headers.map(([k, v]) => [codePointListToString(k), codePointListToString(v)])

/** @type {(input: readonly number[]) => void} */
const roundTrip = input => assertStructurallySame(toArray(write(read(input))), input)

export const proof = {
    // A real commit: six headers in order, the signature one header of
    // sixteen lines, the message everything after the empty line — and
    // written back, the same bytes.
    commit: () => {
        const p = read(commitPayload)
        const h = text(p)
        assertEq(h.length, 6)
        assertStructurallySame(h.map(([k]) => k), ['tree', 'parent', 'parent', 'author', 'committer', 'gpgsig'])
        assertEq(h[0][1], 'c5711460da9d5ae7158a951d9d924385419b13ca')
        assertEq(h[2][1], '261b9142dfe024d8e8e009b0e97f6e52ea981c8d')
        assertEq(h[4][1], 'GitHub <noreply@github.com> 1789011254 +0000')
        const sig = h[5][1].split('\n')
        assertEq(sig.length, 17)
        assertEq(sig[0], '-----BEGIN PGP SIGNATURE-----')
        assertEq(sig[1], '')
        assertEq(sig[15], '-----END PGP SIGNATURE-----')
        assertEq(sig[16], '')
        // The message is everything after the first empty line.
        const blank = commitPayload.findIndex((b, i) => b === 0x0A && commitPayload[i + 1] === 0x0A)
        assertStructurallySame(toArray(p.message), commitPayload.slice(blank + 2))
        assertStructurallySame(toArray(p.message).slice(0, 20), latin1('Add design document '))
        roundTrip(commitPayload)
    },
    // The smallest payload: no headers, the empty line, no message.
    empty: () => {
        const p = read(latin1('\n'))
        assertStructurallySame(p.headers, [])
        assertStructurallySame(toArray(p.message), [])
        roundTrip(latin1('\n'))
    },
    // A value may be empty, and a message need not end in LF.
    emptyValue: () => {
        const input = latin1('a x\nb \n\nm')
        assertStructurallySame(text(read(input)), [['a', 'x'], ['b', '']])
        assertStructurallySame(toArray(read(input).message), latin1('m'))
        roundTrip(input)
    },
    // Continuation lines join the value with the LF between them and
    // their leading SP dropped; an empty continuation line is an empty
    // line of the value.
    continuation: () => {
        const input = latin1('a x\n y\n \n z\nb w\n\n')
        assertStructurallySame(text(read(input)), [['a', 'x\ny\n\nz'], ['b', 'w']])
        roundTrip(input)
    },
    // Keys, values and the message are bytes: nothing here is text.
    binary: () => {
        const input = [0xE9, 0x20, 0xFF, 0x0A, 0x0A, 0xC3, 0]
        const p = read(input)
        assertStructurallySame(p.headers, [[[0xE9], [0xFF]]])
        assertStructurallySame(toArray(p.message), [0xC3, 0])
        roundTrip(input)
    },
    // Each refusal: no empty line before the end, a header without SP, a
    // first line beginning with SP, a header without LF.
    refused: () => {
        assertEq(tryRead([]), null)
        assertEq(tryRead(latin1('a x\n')), null)
        assertEq(tryRead(latin1('a\n\n')), null)
        assertEq(tryRead(latin1(' x\n\n')), null)
        assertEq(tryRead(latin1('a x')), null)
    },
    // A value may hold anything, LF at its end and SP after an LF included,
    // and comes back as it went; a key the format cannot spell is refused
    // by the writer, since it would be read as a different header.
    write: {
        value: () => {
            /** @type {(v: string) => void} */
            const same = v => {
                const p = read(toArray(write({ headers: [[latin1('k'), latin1(v)]], message: [] })))
                assertStructurallySame(text(p), [['k', v]])
            }
            same('x\n')
            same('x\n y')
            same('\n\n')
            same('')
        },
        throw: {
            emptyKey: () => toArray(write({ headers: [[[], latin1('x')]], message: [] })),
            spaceInKey: () => toArray(write({ headers: [[latin1('a b'), latin1('x')]], message: [] })),
            lfInKey: () => toArray(write({ headers: [[latin1('a\nb'), latin1('x')]], message: [] })),
        },
    },
}
