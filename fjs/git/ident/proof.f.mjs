/**
 * @import { Ident } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tryRead as readPayload } from '../header/module.f.mjs'
import { commitPayload, hole, latin1 } from '../testlib.f.mjs'
import { maxTime, tryRead, write } from './module.f.mjs'

const sp = /** @type {const} */ (0x20)

const lt = /** @type {const} */ (0x3C)

const gt = /** @type {const} */ (0x3E)

/** @type {(value: readonly number[]) => Ident} */
const read = value => {
    const i = tryRead(value)
    assert(i !== null)
    return i
}

/** @type {(i: Ident) => readonly [string, string, bigint, string]} */
const text = ({ name, email, time, tz }) =>
    [codePointListToString(name), codePointListToString(email), time, tz]

/** @type {(value: readonly number[]) => void} */
const roundTrip = value => assertStructurallySame(toArray(write(read(value))), value)

export const proof = {
    // The author and the committer of a real commit, read out of its
    // header list — the second pass over what the first one cut out — and
    // written back to the same bytes.
    commit: () => {
        const p = readPayload(commitPayload)
        assert(p !== null)
        const author = toArray(p.headers[3][1])
        const committer = toArray(p.headers[4][1])
        assertStructurallySame(text(read(author)),
            ['Sergey Shandar', 'sergey-shandar@users.noreply.github.com', 1789011254n, '+0000'])
        assertStructurallySame(text(read(committer)), ['GitHub', 'noreply@github.com', 1789011254n, '+0000'])
        roundTrip(author)
        roundTrip(committer)
    },
    // A name may hold spaces, an email `@` and dots; both are bytes, not
    // text; a name may be empty, and a time may be `0`.
    forms: () => {
        assertStructurallySame(text(read(latin1('A B. <x.y@z> 5 -0530'))), ['A B.', 'x.y@z', 5n, '-0530'])
        assertStructurallySame(text(read(latin1(' <> 0 +0000'))), ['', '', 0n, '+0000'])
        const i = read([0xE9, sp, lt, 0xFF, gt, sp, ...latin1('12 +0100')])
        assertStructurallySame([toArray(i.name), toArray(i.email), i.time, i.tz], [[0xE9], [0xFF], 12n, '+0100'])
        for (const v of ['A B. <x.y@z> 5 -0530', ' <> 0 +0000', 'Alice  <a@b> 1 +0000']) {
            roundTrip(latin1(v))
        }
    },
    // A time past the safe integers is a bigint, read and written exactly,
    // up to the latest Git can hold; one second later is refused.
    bigTime: () => {
        const i = read(latin1(`a <b> ${maxTime} +0000`))
        assertEq(i.time, 9223372036854775807n)
        roundTrip(latin1(`a <b> ${maxTime} +0000`))
        assertEq(tryRead(latin1(`a <b> ${maxTime + 1n} +0000`)), null)
        // A time of many digits is refused for its length or its spelling
        // before it is folded into a number: twenty digits, and a zero
        // ahead of a hundred thousand nines.
        assertEq(tryRead(latin1(`a <b> ${'1'.repeat(20)} +0000`)), null)
        assertEq(tryRead(latin1(`a <b> 0${'9'.repeat(100000)} +0000`)), null)
    },
    // Each refusal, one per condition: the SP before `<`, the brackets,
    // the time's spelling, the zone's, trailing bytes, LF anywhere.
    refused: () => {
        for (const v of [
            '',
            'Alice<a@b> 1 +0000',       // no SP before `<`
            'Alice <a@b 1 +0000',       // no `>`
            'Alice a@b> 1 +0000',       // no `<`
            'A> B <a@b> 1 +0000',       // `>` in the name
            'Alice <a<b> 1 +0000',      // `<` in the email
            'Alice <a@b> 01 +0000',     // not canonical decimal
            'Alice <a@b> x +0000',      // not a time
            'Alice <a@b> 1 0000',       // no sign
            'Alice <a@b> 1 +000',       // three digits
            'Alice <a@b> 1 +00000',     // five digits
            'Alice <a@b> 1 +0000 ',     // trailing byte
            'Alice <a@b> 1 +0000junk',
            'Ali\nce <a@b> 1 +0000',
            'Alice <a\n@b> 1 +0000',
            'Alice <a@b>  1 +0000',     // two SP before the time
        ]) {
            assertEq(tryRead(latin1(v)), null)
        }
    },
    // The writer refuses what the format cannot spell.
    write: {
        throw: {
            ltInName: () => write({ name: latin1('a<b'), email: [], time: 0n, tz: '+0000' }),
            gtInName: () => write({ name: latin1('a>b'), email: [], time: 0n, tz: '+0000' }),
            lfInName: () => write({ name: latin1('a\nb'), email: [], time: 0n, tz: '+0000' }),
            ltInEmail: () => write({ name: [], email: latin1('a<b'), time: 0n, tz: '+0000' }),
            gtInEmail: () => write({ name: [], email: latin1('a>b'), time: 0n, tz: '+0000' }),
            lfInEmail: () => write({ name: [], email: latin1('a\nb'), time: 0n, tz: '+0000' }),
            negativeTime: () => write({ name: [], email: [], time: -1n, tz: '+0000' }),
            lateTime: () => write({ name: [], email: [], time: maxTime + 1n, tz: '+0000' }),
            zoneNoSign: () => write({ name: [], email: [], time: 0n, tz: '0000' }),
            zoneShort: () => write({ name: [], email: [], time: 0n, tz: '+000' }),
            zoneLetters: () => write({ name: [], email: [], time: 0n, tz: '+00a0' }),
            nonByteInName: () => write({ name: [0x100], email: [], time: 0n, tz: '+0000' }),
            holeInEmail: () => write({ name: [], email: hole, time: 0n, tz: '+0000' }),
            readHole: () => tryRead(hole),
        },
    },
}
