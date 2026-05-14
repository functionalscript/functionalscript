import { boolean, number, string, bigint, unknown, or, never, type Type } from './module.f.ts'
import { assertEq } from '../../dev/module.f.ts'

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

export default {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a.map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
    or: {
        flatten: {
            shallow: () => {
                const v = variantsOf(or(or(boolean, number), string))
                assertEq(v.length, 3)
                assertEq(v[0], boolean)
                assertEq(v[1], number)
                assertEq(v[2], string)
            },
            deep: () => {
                assertEq(variantsOf(or(or(or(boolean, number), string), bigint)).length, 4)
            },
            manualOrThunk: () => {
                // Manually-constructed `() => ['or', ...]` thunks should also flatten.
                const inner = () => ['or', boolean, number] as const
                assertEq(variantsOf(or(inner, string)).length, 3)
            },
            selfReferential: () => {
                // A self-referential `or` thunk terminates: it is expanded once,
                // then kept as-is on the second encounter (via the visited set).
                const t: Type = (() => ['or', boolean, t]) as Type
                // expansion: t -> [boolean, t]; t (second) kept as-is; number kept.
                assertEq(variantsOf(or(t, number)).length, 3)
            },
        },
        unknownCollapse: {
            withConst: () => {
                const v = variantsOf(or(unknown, 42 as const))
                assertEq(v.length, 1)
                assertEq(v[0], unknown)
            },
            withThunk: () => {
                const v = variantsOf(or(number, unknown, string))
                assertEq(v.length, 1)
                assertEq(v[0], unknown)
            },
            nested: () => {
                // nested `or` whose flattening surfaces an `unknown`
                const v = variantsOf(or(or(boolean, unknown), 42 as const))
                assertEq(v.length, 1)
                assertEq(v[0], unknown)
            },
        },
        dropPrimitiveSubset: {
            number: () => {
                const v = variantsOf(or(42 as const, number))
                assertEq(v.length, 1)
                assertEq(v[0], number)
            },
            boolean: () => {
                const v = variantsOf(or(true as const, false as const, boolean))
                assertEq(v.length, 1)
                assertEq(v[0], boolean)
            },
            string: () => {
                const v = variantsOf(or('hi' as const, 'bye' as const, string))
                assertEq(v.length, 1)
                assertEq(v[0], string)
            },
            bigint: () => {
                const v = variantsOf(or(7n as const, bigint))
                assertEq(v.length, 1)
                assertEq(v[0], bigint)
            },
            keepIfThunkAbsent: () => {
                // Without a matching primitive thunk, consts are kept.
                assertEq(variantsOf(or(42 as const, 'hello' as const)).length, 2)
            },
            mixed: () => {
                // `null`/`undefined` consts have no matching primitive thunk and remain.
                assertEq(variantsOf(or(null, undefined, 42 as const, number)).length, 3)
            },
        },
        dedup: {
            sameThunkReference: () => {
                assertEq(variantsOf(or(boolean, boolean)).length, 1)
            },
            samePrimitive: () => {
                assertEq(variantsOf(or(42 as const, 42 as const)).length, 1)
            },
            nanCollapses: () => {
                // `Object.is(NaN, NaN)` is true, so duplicate `NaN` variants
                // collapse — matching `constPrimitiveValidate` semantics.
                assertEq(variantsOf(or(NaN as number, NaN as number)).length, 1)
            },
            signedZeroDistinct: () => {
                // `Object.is(+0, -0)` is false, so they remain distinct.
                assertEq(variantsOf(or(0 as number, -0 as number)).length, 2)
            },
        },
        booleanPairCollapse: {
            basic: () => {
                // `{ true, false }` covers all of `boolean` — collapses to `boolean`.
                const v = variantsOf(or(true as const, false as const))
                assertEq(v.length, 1)
                assertEq(v[0], boolean)
            },
            reversed: () => {
                // Order doesn't matter.
                const v = variantsOf(or(false as const, true as const))
                assertEq(v.length, 1)
                assertEq(v[0], boolean)
            },
            repeated: () => {
                // Duplicate `true`/`false` consts still collapse to a single `boolean`.
                const v = variantsOf(or(true as const, true as const, false as const, false as const))
                assertEq(v.length, 1)
                assertEq(v[0], boolean)
            },
            withOtherVariants: () => {
                // Other variants are preserved; const number `42` is dropped by the
                // existing `number` thunk subset rule.
                const v = variantsOf(or(true as const, 42 as const, false as const, number))
                assertEq(v.length, 2)
                assertEq(v[0], boolean)
                assertEq(v[1], number)
            },
            onlyTrueKept: () => {
                // Without a matching `false`, no collapse — the const is kept as-is.
                const v = variantsOf(or(true as const))
                assertEq(v.length, 1)
                assertEq(v[0], true)
            },
            onlyFalseKept: () => {
                // Without a matching `true`, no collapse — the const is kept as-is.
                const v = variantsOf(or(false as const))
                assertEq(v.length, 1)
                assertEq(v[0], false)
            },
            nested: () => {
                // Collapse applies after flattening nested `or`s.
                const v = variantsOf(or(or(true as const, 42 as const), false as const))
                assertEq(v.length, 2)
                assertEq(v[0], boolean)
                assertEq(v[1], 42)
            },
        },
        emptyStillNever: () => {
            assertEq(variantsOf(or()).length, 0)
            assertEq(variantsOf(never).length, 0)
        },
    },
}
