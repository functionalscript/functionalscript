import { assert, assertEq } from '../../asserts/module.f.js'
import {
    ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED,
    asArray, asBigInt, asBoolean, asFunction, asNumber, asObject, asString,
    concat, find, fromUnit, item, key, kind, length, same, substring, text, unit,
} from './module.f.js'

/** A function of two parameters. @type {(a: unknown, b: unknown) => unknown} */
const f2 = (a, b) => [a, b]

/** One value of each kind, in tag order. */
const values = [undefined, null, true, 1.5, 'ab', 7n, [1], { a: 1 }, f2]

/** A cast to each kind, in tag order, where the kind has one. */
const casts = [undefined, undefined, asBoolean, asNumber, asString, asBigInt, asArray, asObject, asFunction]

/**
 * Each cast throws on every value of another kind, an array cast to an
 * object too: one proof per pair, named by the two tags.
 */
const castThrows = Object.fromEntries(casts.flatMap((cast, c) => cast === undefined
    ? []
    : values.flatMap((v, i) => i === c ? [] : [[`cast${c}of${i}`, () => { cast(v) }]])))

export const proof = {
    // The tags are the ABI's, 0 to 8 in this order.
    tags: () => {
        assertEq(JSON.stringify([UNDEFINED, NULL, BOOLEAN, NUMBER, STRING, BIGINT, ARRAY, OBJECT, FUNCTION]), '[0,1,2,3,4,5,6,7,8]')
    },
    // `kind` answers each value's tag; `false`, `NaN`, `''`, `[]` and `{}`
    // are no different.
    kind: () => {
        values.forEach((v, i) => assertEq(kind(v), i))
        assertEq(kind(false), BOOLEAN)
        assertEq(kind(NaN), NUMBER)
        assertEq(kind(''), STRING)
        assertEq(kind(0n), BIGINT)
        assertEq(kind([]), ARRAY)
        assertEq(kind({}), OBJECT)
    },
    // Each cast answers a value of its kind as it is.
    casts: () => {
        casts.forEach((cast, i) => {
            if (cast !== undefined) { assert(cast(values[i]) === values[i]) }
        })
    },
    // `length` per kind: units, `u64` words, items, properties, declared
    // parameters.
    length: () => {
        assertEq(length(''), 0)
        assertEq(length('\u{1F600}'), 2)
        assertEq(length(0n), 0)
        assertEq(length(1n), 1)
        assertEq(length(-1n), 1)
        assertEq(length(0xffff_ffff_ffff_ffffn), 1)
        assertEq(length(0x1_0000_0000_0000_0000n), 2)
        assertEq(length(-0x1_0000_0000_0000_0000n), 2)
        assertEq(length([]), 0)
        assertEq(length([1, 2, 3]), 3)
        assertEq(length({}), 0)
        assertEq(length({ a: 1, b: 2 }), 2)
        assertEq(length(f2), 2)
        assertEq(length(() => 0), 0)
    },
    // `item` reads an array by index and an object by property position.
    item: () => {
        assertEq(item(['a', 'b'], 1), 'b')
        assertEq(item(['a', 'b'], -0), 'a')
        assertEq(item({ x: 'a', y: 'b' }, 1), 'b')
    },
    // `key` reads an object's keys in order, and `find` is its inverse.
    key: () => {
        const o = { y: 1, x: 2, '': 3 }
        assertEq(key(o, 0), 'y')
        assertEq(key(o, 1), 'x')
        assertEq(key(o, 2), '')
        assertEq(find(o, 'y'), 0)
        assertEq(find(o, 'x'), 1)
        assertEq(find(o, ''), 2)
        assertEq(find(o, 'z'), -1)
        assertEq(find({}, 'z'), -1)
    },
    // `same` is identity on arrays, objects and functions.
    same: () => {
        const a = [1]
        const o = { a }
        assert(same(a, a))
        assert(same(o, o))
        assert(same(f2, f2))
        assert(!same(a, [1]))
        assert(!same(o, { a }))
        assert(!same(a, o))
        assert(!same(f2, () => 0))
    },
    // `text` is the source text of a function.
    text: () => {
        assertEq(text(f2), '(a, b) => [a, b]')
    },
    // The four string functions, a surrogate pair as two units.
    strings: () => {
        assertEq(unit('abc', 1), 0x62)
        assertEq(unit('\u{1F600}', 0), 0xd83d)
        assertEq(unit('\u{1F600}', 1), 0xde00)
        assertEq(fromUnit(0x61), 'a')
        assertEq(fromUnit(0), '\u0000')
        assertEq(fromUnit(0xffff), '￿')
        assertEq(fromUnit(0xd83d) + fromUnit(0xde00), '\u{1F600}')
        assertEq(concat('ab', 'cd'), 'abcd')
        assertEq(concat('', ''), '')
        assertEq(substring('abcdef', 1, 3), 'bc')
        assertEq(substring('abcdef', 0, 6), 'abcdef')
        assertEq(substring('abcdef', 6, 6), '')
        assertEq(substring('', 0, 0), '')
    },
    // Every misuse that traps in WASM throws here.
    throw: {
        ...castThrows,
        kind: () => { kind(Symbol()) },
        lengthUndefined: () => { length(undefined) },
        lengthNull: () => { length(null) },
        lengthBoolean: () => { length(true) },
        lengthNumber: () => { length(0) },
        itemString: () => { item('ab', 0) },
        itemFunction: () => { item(f2, 0) },
        itemPast: () => { item([1], 1) },
        itemNegative: () => { item([1], -1) },
        itemFraction: () => { item([1, 2], 0.5) },
        itemNotNumber: () => { item([1], '0') },
        itemObjectPast: () => { item({ a: 1 }, 1) },
        keyArray: () => { key(['a'], 0) },
        keyPast: () => { key({ a: 1 }, 1) },
        findArray: () => { find(['a'], 'a') },
        findKey: () => { find({ 1: 1 }, 1) },
        sameNumber: () => { same(1, 1) },
        sameString: () => { same([], 'a') },
        text: () => { text({}) },
        unitNotString: () => { unit(['a'], 0) },
        unitPast: () => { unit('a', 1) },
        fromUnitLarge: () => { fromUnit(0x1_0000) },
        fromUnitNegative: () => { fromUnit(-1) },
        fromUnitString: () => { fromUnit('a') },
        concatFirst: () => { concat(1, 'a') },
        concatSecond: () => { concat('a', 1) },
        substringNotString: () => { substring(['a'], 0, 1) },
        substringEndPast: () => { substring('ab', 0, 3) },
        substringBackwards: () => { substring('ab', 2, 1) },
        substringNegative: () => { substring('ab', -1, 1) },
    },
}
