/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Ast, Meta } from '../ast/types.ts'
 * @import { Mappings, Parser } from '../ll1/types.ts'
 * @import { Set } from '../types.ts'
 * @import { Byte } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { fromArrayLike } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { eof, range, rangeEncode, repeatFrom0, repeatFrom1, set, times, unicodeMax } from '../module.f.mjs'
import { mapping } from '../ll1/module.f.mjs'
import { ascii as asciiBytes, byte, byteArray, byteLength, byteParser, bytes, isByte, meta, not, symbols, symbolsOf } from './module.f.mjs'

/** @type {(s: string) => readonly number[]} */
const ascii = s => [...s].map(c => c.charCodeAt(0))

/**
 * A sparse array, as it arrives from outside the type system, narrowed
 * only at the call that must refuse it.
 *
 * @type {unknown}
 */
const hole = [, 0x61]

/**
 * A word of bytes folded to one symbol carrying the bytes: the mapping a
 * byte grammar's consumer writes, over the layer's metadata types.
 *
 * @type {Mappings<Byte, { readonly id: 'word', readonly bytes: readonly number[] }>}
 */
const word = mapping

export const proof = {
    // The universe is every byte, spelled as the range it is; `./types.ts`
    // pins the spelling, where an alias is resolved on sight.
    byte: () => {
        assertStructurallySame(byte(), ['set', 0, 0x100])
    },
    // `not` complements within the byte universe, not the Unicode one.
    not: () => {
        assertStructurallySame(not(set('\0'))(), ['set', 1, 0x100])
        assertStructurallySame(not(set(' \n'))(), ['set', 0, 0x0A, 0x0B, 0x20, 0x21, 0x100])
        assertStructurallySame(not(byte)(), ['set'])
    },
    // The membership every check here rests on: the integers `0..255`, and
    // no other number.
    isByte: () => {
        assert([0, 1, 0x7F, 0x80, 0xFF].every(isByte))
        assert([-1, 0x100, 0.5, -0, NaN, Infinity].every(b => !isByte(b)))
    },
    bytes: {
        // One run per byte, merged where they touch, and the spelling kept
        // in the type.
        set: () => {
            const e = bytes(0xE9)
            // The return carries the byte it was given, not merely that it was
            // one. Stated before the assertions rather than after them: a
            // typedef binds to the statement that follows it, so one at the end
            // of a block checks nothing (`../../AGENTS.md` §1.4).
            /** @typedef {Assert<Equal<typeof e, Set<readonly ['bytes', 0xE9]>>>} _Spelling */
            assertStructurallySame(e(), ['set', 0xE9, 0xEA])
            assertStructurallySame(bytes(0xFF, 0, 1)(), ['set', 0, 2, 0xFF, 0x100])
        },
        throw: {
            none: () => bytes(),
            above: () => bytes(0x100),
            below: () => bytes(-1),
            negativeZero: () => bytes(-0),
            fraction: () => bytes(0.5),
        },
    },
    symbols: {
        // One symbol per byte, in order, and every leaf carries the one
        // shared record, which names the alphabet.
        list: () => {
            const s = symbols([0x61, 0xFF, 0])
            assertStructurallySame(s.map(({ symbol }) => symbol), [0x61, 0xFF, 0])
            assert(s.every(x => x.meta === meta))
            assertEq(meta.id, 'byte')
        },
        // The two inputs a caller holds at a boundary: a `Vec`, and a
        // `Uint8Array`.
        vec: () => {
            const v = u8ListToVec(msb)([0x67, 0x69, 0x74])
            assertStructurallySame(symbols(u8List(msb)(v)).map(({ symbol }) => symbol), [0x67, 0x69, 0x74])
        },
        uint8Array: () => {
            const s = symbols(fromArrayLike(new Uint8Array([0xC3, 0xA9])))
            assertStructurallySame(s.map(({ symbol }) => symbol), [0xC3, 0xA9])
        },
        empty: () => assertStructurallySame(symbols([]), []),
        throw: {
            above: () => symbols([0x100]),
            below: () => symbols([-1]),
            fraction: () => symbols([0.5]),
            // A hole is met as `undefined`, not skipped.
            hole: () => symbols(/** @type {List<number>} */ (hole)),
        },
    },
    // The dense array `symbols` is built on: every position visited, a
    // lazy list read through, and a hole or a non-byte refused.
    byteArray: {
        dense: () => {
            assertStructurallySame(byteArray([0, 0xFF]), [0, 0xFF])
            assertStructurallySame(byteArray(fromArrayLike(new Uint8Array([1, 2]))), [1, 2])
            assertStructurallySame(byteArray([]), [])
        },
        throw: {
            hole: () => byteArray(/** @type {List<number>} */ (hole)),
            nonByte: () => byteArray([0x100]),
        },
    },
    // The bytes under a tree's leaves: the inverse of `symbols`.
    symbolsOf: () => {
        assertStructurallySame(symbolsOf(symbols([0, 0x7F, 0xFF])), [0, 0x7F, 0xFF])
        assertStructurallySame(symbolsOf([]), [])
    },
    // ASCII text as bytes, and nothing above it.
    ascii: {
        text: () => {
            assertStructurallySame(asciiBytes('tree '), [0x74, 0x72, 0x65, 0x65, 0x20])
            assertStructurallySame(asciiBytes(''), [])
        },
        throw: {
            latin1: () => asciiBytes('é'),
            astral: () => asciiBytes('😀'),
        },
    },
    // A count that walks once and holds nothing, `null` at the first item
    // that is no byte.
    byteLength: () => {
        assertEq(byteLength([]), 0)
        assertEq(byteLength([0, 0xFF]), 2)
        assertEq(byteLength(fromArrayLike(new Uint8Array(1000))), 1000)
        assertEq(byteLength([0, 0x100, 0]), null)
        assertEq(byteLength([0.5]), null)
        assertEq(byteLength(/** @type {List<number>} */ (hole)), null)
    },
    byteParser: {
        // A grammar over every rule form — a string, a number, `not`,
        // `bytes`, a repeat, a `const` thunk, a tuple, a variant, EOF — that
        // reads a header line and takes the rest as bytes, with the two
        // bytes of `é` spelled through `bytes`, where a string would have
        // spelled one.
        parse: () => {
            const key = repeatFrom1(not(set(' \n')))
            const accent = /** @type {const} */ ([bytes(0xC3), bytes(0xA9)])
            const value = /** @type {const} */ ({ accent, plain: ['caf', 0x65] })
            const line = () => /** @type {const} */ (['const', [key, ' ', value, '\n']])
            const rest = repeatFrom0(byte)
            const parse = byteParser([line, rest, eof])
            const r = unwrap(parse(symbols([...ascii('k '), 0xC3, 0xA9, ...ascii('\n'), 0xFF, 0])))
            assertEq(r[1], 7)
            const [[k, , [tag, v], nl], tail] = r[0]
            assertStructurallySame(k.map(({ symbol }) => symbol), [0x6B])
            assertEq(tag, 'accent')
            assert(v instanceof Array)
            assertStructurallySame(v.map(x => !(x instanceof Array) && x.symbol), [0xC3, 0xA9])
            // A string's node is its symbols, one leaf for `'\n'`.
            assertEq(nl[0].symbol, 0x0A)
            assertStructurallySame(tail.map(({ symbol }) => symbol), [0xFF, 0])
            // The other branch: a string's node is its symbols, and a
            // number's the one symbol, so the tuple holds a list and a leaf.
            assertStructurallySame(
                unwrap(parse(symbols(ascii('k cafe\n'))))[0][0][2],
                ['plain', [symbols(ascii('caf')), symbols([0x65])[0]]])
        },
        // A rewrite set is folded as `parser` folds it: the word's bytes
        // become one symbol of the next alphabet.
        mapped: () => {
            const w = repeatFrom1(not(set(' ')))
            const parse = byteParser([w, ' ', w, eof], [
                word(w, bs => ({ symbol: 0, meta: { id: 'word', bytes: bs.map(({ symbol }) => symbol) } })),
            ])
            const [ast] = unwrap(parse(symbols(ascii('tree 42'))))
            // The entry is unmapped, so its node is the tuple the machine
            // built; the two words under it are mapped, so each is a symbol.
            assert(ast instanceof Array)
            const [a, , b] = ast
            assert(!(a instanceof Array) && !(b instanceof Array))
            assertStructurallySame([a.meta, b.meta], [
                { id: 'word', bytes: ascii('tree') },
                { id: 'word', bytes: ascii('42') },
            ])
        },
        // The input's metadata may carry more than the alphabet's `id` — an
        // offset here — and a rewrite set written against that record is
        // one over this alphabet still.
        extended: () => {
            /** @type {Mappings<{ readonly id: 'byte', readonly offset: number }, { readonly id: 'at', readonly offset: number }>} */
            const at = mapping
            const w = repeatFrom1(range('az'))
            const parse = byteParser([w, eof], [
                at(w, bs => ({ symbol: 0, meta: { id: 'at', offset: bs[0].meta.offset } })),
            ])
            const [ast] = unwrap(parse(ascii('git').map((symbol, offset) => ({ symbol, meta: { id: 'byte', offset } }))))
            assert(ast instanceof Array)
            const [word] = ast
            assert(!(word instanceof Array))
            assertStructurallySame(word.meta, { id: 'at', offset: 0 })
        },
        // A grammar that stops where its rule does reports the index it
        // left, so a reader can slice the rest.
        prefix: () => {
            const d = repeatFrom1(range('09'))
            const parse = byteParser([d, '\0'])
            // `byteParser`'s `const R` keeps the argument a tuple of literals,
            // where a dropped modifier would widen it to an array and `tsc`
            // would still pass; this is what makes the modifier load-bearing.
            // Before the assertion rather than after it, so that it binds to a
            // statement and is checked (`../../AGENTS.md` §1.4).
            /** @typedef {Assert<Equal<typeof parse, Parser<Ast<readonly [typeof d, '\0'], Byte>, Byte>>>} _ConstParameter */
            assertEq(unwrap(parse(symbols([0x31, 0x32, 0, 0xFF, 0xFF])))[1], 3)
        },
        // Every rule the lowering met is checked, wherever it sits.
        throw: {
            string: () => byteParser('é'),
            stringUnderRepeat: () => byteParser(times(2)('a€')),
            symbol: () => byteParser(0x100),
            negativeSymbol: () => byteParser(['a', -1]),
            // A `const` thunk's bare payload is never a key of the map,
            // so the check follows the thunk to it.
            constString: () => byteParser(() => ['const', 'é']),
            constSymbol: () => byteParser(() => ['const', 0x100]),
            set: () => byteParser(range(` ${unicodeMax}`)),
            rangeEncode: () => byteParser({ a: 'a', b: rangeEncode(0xFF, 0x100) }),
            // An odd number of boundaries is open above the last one.
            openAboveBytes: () => byteParser(() => ['set', 0x100]),
            openFromZero: () => byteParser(() => ['set', 0]),
            // A negative boundary would be clipped by the lowering.
            negativeBoundary: () => byteParser(() => ['set', -1, 2]),
        },
    },
}
