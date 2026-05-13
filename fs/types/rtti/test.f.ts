import { boolean, number, string, bigint, unknown, or, never, type Type } from './module.f.ts'

type Tests = {
    readonly[K in string]: readonly unknown[]
}

const tests: Tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

const variantsOf = (t: Type): readonly Type[] => {
    if (typeof t !== 'function') { throw 'expected an or thunk' }
    const info = t()
    if (info[0] !== 'or') { throw `expected an or thunk, got ${info[0]}` }
    return info.slice(1) as readonly Type[]
}

const assertLen = (expected: number) => (vs: readonly Type[]) => {
    if (vs.length !== expected) { throw `expected ${expected} variant(s), got ${vs.length}` }
}

const assertEq = (a: Type, b: Type) => { if (a !== b) { throw 'variants differ' } }

export default {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a.map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
    or: {
        flatten: {
            shallow: () => {
                const v = variantsOf(or(or(boolean, number), string))
                assertLen(3)(v)
                assertEq(v[0], boolean)
                assertEq(v[1], number)
                assertEq(v[2], string)
            },
            deep: () => {
                assertLen(4)(variantsOf(or(or(or(boolean, number), string), bigint)))
            },
            manualOrThunk: () => {
                // Manually-constructed `() => ['or', ...]` thunks should also flatten.
                const inner = () => ['or', boolean, number] as const
                assertLen(3)(variantsOf(or(inner, string)))
            },
            selfReferential: () => {
                // A self-referential `or` thunk terminates: it is expanded once,
                // then kept as-is on the second encounter (via the visited set).
                const t: Type = (() => ['or', boolean, t]) as Type
                const v = variantsOf(or(t, number))
                // expansion: t -> [boolean, t]; t (second) kept as-is; number kept.
                assertLen(3)(v)
            },
        },
        unknownCollapse: {
            withConst: () => {
                const v = variantsOf(or(unknown, 42 as const))
                assertLen(1)(v)
                assertEq(v[0], unknown)
            },
            withThunk: () => {
                const v = variantsOf(or(number, unknown, string))
                assertLen(1)(v)
                assertEq(v[0], unknown)
            },
            nested: () => {
                // nested `or` whose flattening surfaces an `unknown`
                const v = variantsOf(or(or(boolean, unknown), 42 as const))
                assertLen(1)(v)
                assertEq(v[0], unknown)
            },
        },
        dropPrimitiveSubset: {
            number: () => {
                const v = variantsOf(or(42 as const, number))
                assertLen(1)(v)
                assertEq(v[0], number)
            },
            boolean: () => {
                const v = variantsOf(or(true as const, false as const, boolean))
                assertLen(1)(v)
                assertEq(v[0], boolean)
            },
            string: () => {
                const v = variantsOf(or('hi' as const, 'bye' as const, string))
                assertLen(1)(v)
                assertEq(v[0], string)
            },
            bigint: () => {
                const v = variantsOf(or(7n as const, bigint))
                assertLen(1)(v)
                assertEq(v[0], bigint)
            },
            keepIfThunkAbsent: () => {
                // Without a matching primitive thunk, consts are kept.
                assertLen(2)(variantsOf(or(42 as const, 'hello' as const)))
            },
            mixed: () => {
                // `null`/`undefined` consts have no matching primitive thunk and remain.
                const v = variantsOf(or(null, undefined, 42 as const, number))
                assertLen(3)(v)
            },
        },
        dedup: {
            sameThunkReference: () => {
                assertLen(1)(variantsOf(or(boolean, boolean)))
            },
            samePrimitive: () => {
                assertLen(1)(variantsOf(or(42 as const, 42 as const)))
            },
            nanCollapses: () => {
                // `Object.is(NaN, NaN)` is true, so duplicate `NaN` variants
                // collapse — matching `constPrimitiveValidate` semantics.
                assertLen(1)(variantsOf(or(NaN as number, NaN as number)))
            },
            signedZeroDistinct: () => {
                // `Object.is(+0, -0)` is false, so they remain distinct.
                assertLen(2)(variantsOf(or(0 as number, -0 as number)))
            },
        },
        emptyStillNever: () => {
            assertLen(0)(variantsOf(or()))
            assertLen(0)(variantsOf(never))
        },
    },
}
