/**
 * @import { Payload } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { fromArrayLike, toArray } from '../../types/list/module.f.mjs'
import { commitPayload, headerOnlyTagPayload, hole, latin1 } from '../testlib.f.mjs'
import { hasNulHeader, keyIs, tryRead, valueAt, valuesOf, write } from './module.f.mjs'

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
    // A header by position and key: the value where both match, `null`
    // where the key is elsewhere or the position is past the end.
    valueAt: () => {
        const p = read(commitPayload)
        assertStructurallySame(valueAt(p, 0, 'tree'), latin1('c5711460da9d5ae7158a951d9d924385419b13ca'))
        assertStructurallySame(valueAt(p, 2, 'parent'), latin1('261b9142dfe024d8e8e009b0e97f6e52ea981c8d'))
        assertEq(valueAt(p, 1, 'tree'), null)
        assertEq(valueAt(p, 0, 'tre'), null)
        assertEq(valueAt(p, 0, 'trees'), null)
        assertEq(valueAt(p, 6, 'gpgsig'), null)
        assertEq(valueAt(read(latin1('\n')), 0, 'tree'), null)
    },
    // A key as bytes against a name: the same bytes, and nothing shorter,
    // longer or other.
    keyIs: () => {
        assert(keyIs([latin1('tree'), []], 'tree'))
        assert(!keyIs([latin1('tre'), []], 'tree'))
        assert(!keyIs([latin1('trees'), []], 'tree'))
        assert(!keyIs([latin1('tref'), []], 'tree'))
        assert(!keyIs([[0xE9, 0x72, 0x65, 0x65], []], 'tree'))
    },
    // A NUL in a key or a value, wherever the header sits; none in a
    // real commit, and one in the message is not a header's.
    hasNulHeader: () => {
        assert(!hasNulHeader(read(commitPayload)))
        assert(!hasNulHeader(read(latin1('\n\0'))))
        assert(hasNulHeader(read([0x61, 0x20, 0, 0x0A, 0x0A])))
        assert(hasNulHeader(read([0x61, 0, 0x20, 0x78, 0x0A, 0x0A])))
        assert(hasNulHeader(read(latin1('a x\nb y\n \0\n\n'))))
    },
    // Every header of a key, in order, wherever it sits; none is none.
    valuesOf: () => {
        const p = read(commitPayload)
        assertStructurallySame(valuesOf(p, 'parent').map(toArray), [
            latin1('30317689cb0aaba4f927c1980d80e286c69dce85'),
            latin1('261b9142dfe024d8e8e009b0e97f6e52ea981c8d'),
        ])
        assertEq(valuesOf(p, 'gpgsig').length, 1)
        assertStructurallySame(valuesOf(p, 'encoding'), [])
        assertStructurallySame(valuesOf(p, 'paren'), [])
    },
    // Each refusal: no empty line before the end, a header without SP, a
    // first line beginning with SP, a header without LF.
    refused: () => {
        assertEq(tryRead(latin1('a\n\n')), null)
        assertEq(tryRead(latin1(' x\n\n')), null)
        assertEq(tryRead(latin1('a x')), null)
    },
    // A payload that ends at its last header's LF ends the block there and
    // has no message at all. Git ends a header block at a line that is no
    // header, and the input's end is one of those: `git hash-object -t tag`
    // writes such a tag and `<id>^{}` follows it, and a commit spelled the
    // same way gives up its tree.
    //
    // It is not the same payload as the one with an empty line and an empty
    // message. Those are two byte strings and so two object ids, and a
    // reader that gave them one value could write neither back, so the
    // message is `null` for the first and empty for the second, and each
    // goes out as it came in.
    noBlank: () => {
        for (const text of ['a x\n', 'a x\nb y\n', '']) {
            const p = tryRead(latin1(text))
            assert(p !== null)
            assertEq(p.message, null)
            assertStructurallySame(toArray(write(p)), latin1(text))
        }
        for (const text of ['a x\n\n', 'a x\nb y\n\n', '\n']) {
            const p = tryRead(latin1(text))
            assert(p !== null)
            assertStructurallySame(p.message, [])
            assertStructurallySame(toArray(write(p)), latin1(text))
        }
        // And on the real thing: a tag Git wrote that ends at its last
        // header's LF, read and written back byte for byte, which is the
        // whole point of the `null` — its id is over those 115 bytes and a
        // 116th would be another object.
        const tag = tryRead(headerOnlyTagPayload)
        assert(tag !== null)
        assertEq(tag.message, null)
        assertStructurallySame(toArray(write(tag)), headerOnlyTagPayload)
    },
    // A value may hold anything, LF at its end and SP after an LF included,
    // and comes back as it went; a key the format cannot spell is refused
    // by the writer, since it would be read as a different header.
    write: {
        // A value and a message are written as the lists they are, never
        // held as arrays: a lazy list goes in, and the bytes come out.
        lazy: () => {
            const lazy = latin1('x\ny').map(b => b)
            const out = write({
                headers: [[latin1('k'), fromArrayLike(new Uint8Array(lazy))]],
                message: fromArrayLike(new Uint8Array(latin1('m'))),
            })
            assert(!(out instanceof Array))
            assertStructurallySame(toArray(out), latin1('k x\n y\n\nm'))
        },
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
            // A number that is no byte, wherever it sits.
            nonByteInKey: () => toArray(write({ headers: [[[0x100], latin1('x')]], message: [] })),
            nonByteInValue: () => toArray(write({ headers: [[latin1('k'), [0x100]]], message: [] })),
            nonByteInMessage: () => write({ headers: [], message: [-1] }),
            // A hole is met, not skipped.
            holeInKey: () => toArray(write({ headers: [[hole, latin1('x')]], message: [] })),
            holeInMessage: () => write({ headers: [], message: hole }),
        },
    },
}
