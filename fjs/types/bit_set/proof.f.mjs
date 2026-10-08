import { bitSet, bigintOps, numberOps } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

const n = bitSet(numberOps)(8)

const b = bitSet(bigintOps)(200)

export const proof = {
    number: {
        empty: () => {
            assertEq(n.empty, 0)
            assert(!n.has(0)(n.empty), n.empty)
        },
        universe: () => {
            assertEq(n.universe, 0xFF)
            assert(n.has(7)(n.universe), n.universe)
            assert(!n.has(8)(n.universe), n.universe)
            assert(!n.has(31)(n.universe), n.universe)
        },
        one: () => {
            const s = n.one(3)
            assertEq(s, 8)
            assert(n.has(3)(s), s)
            assert(!n.has(2)(s), s)
        },
        range: {
            inner: () => assertEq(n.range([2, 5]), 0b0011_1100),
            single: () => assertEq(n.range([4, 4]), n.one(4)),
            full: () => assertEq(n.range([0, 7]), n.universe),
        },
        union: () => assertEq(n.union(0b0011)(0b0110), 0b0111),
        intersect: () => assertEq(n.intersect(0b0011)(0b0110), 0b0010),
        complement: () => {
            assertEq(n.complement(n.empty), n.universe)
            assertEq(n.complement(n.universe), n.empty)
            assertEq(n.complement(0b1111_0000), 0b0000_1111)
        },
        difference: () => assertEq(n.difference(0b0011)(0b0110), 0b0001),
        set: () => assertEq(n.set(7)(n.one(0)), 0b1000_0001),
        setRange: () => assertEq(n.setRange([1, 2])(n.one(7)), 0b1000_0110),
        unset: () => {
            assertEq(n.unset(1)(0b0011), 0b0001)
            assertEq(n.unset(2)(0b0011), 0b0011)
        },
        largest: () => {
            const s = bitSet(numberOps)(30)
            assertEq(s.universe, 0x3FFF_FFFF)
            assert(s.has(29)(s.universe), s.universe)
            assert(!s.has(30)(s.universe), s.universe)
        },
        throw: {
            size: () => bitSet(numberOps)(31),
            member: () => numberOps.one(31),
            negative: () => n.one(-1),
            negativeZero: () => n.one(-0),
            fraction: () => n.has(1.5)(n.universe),
            outside: () => n.one(8),
        },
    },
    bigint: {
        empty: () => assertEq(b.empty, 0n),
        universe: () => {
            assertEq(b.universe, (1n << 200n) - 1n)
            assert(b.has(199)(b.universe), b.universe)
            assert(!b.has(200)(b.universe), b.universe)
        },
        one: () => {
            const s = b.one(150)
            assertEq(s, 1n << 150n)
            assert(b.has(150)(s), s)
            assert(!b.has(149)(s), s)
        },
        range: {
            inner: () => assertEq(b.range([100, 103]), 0xFn << 100n),
            full: () => assertEq(b.range([0, 199]), b.universe),
        },
        union: () => assertEq(b.union(b.one(0))(b.one(199)), (1n << 199n) | 1n),
        intersect: () => assertEq(b.intersect(b.range([0, 100]))(b.range([100, 199])), b.one(100)),
        complement: () => assertEq(b.complement(b.range([1, 199])), b.one(0)),
        difference: () => assertEq(b.difference(b.range([0, 100]))(b.range([1, 199])), b.one(0)),
        set: () => assertEq(b.set(199)(b.empty), b.one(199)),
        setRange: () => assertEq(b.setRange([64, 65])(b.one(0)), (3n << 64n) | 1n),
        unset: () => assertEq(b.unset(199)(b.universe), b.range([0, 198])),
        throw: {
            size: () => bitSet(bigintOps)(-1),
            // A carrier that checks nothing: the factory refuses the size itself.
            uncheckedSize: () => bitSet({ ...bigintOps, mask: len => (1n << BigInt(len)) - 1n })(-1),
            negative: () => b.one(-1),
            negativeZero: () => b.one(-0),
            fraction: () => b.has(1.5)(b.universe),
            one: () => b.one(200),
            set: () => b.set(200)(b.empty),
            unset: () => b.unset(200)(b.universe),
            rangeEnd: () => b.range([0, 200]),
            reversed: () => b.range([5, 4]),
        },
    },
}
