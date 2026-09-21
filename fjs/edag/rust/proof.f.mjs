/**
 * Proofs for the shared EDAG→Rust printer.
 *
 * `nodeExpr`/`expExpr` return a `Result` rather than throwing (see the
 * module's own doc comment for why), so every case here reads it through
 * {@link printed}/{@link printedWith}, which `unwrap` back to a throwing
 * convenience — the ordinary FunctionalScript panic `fjs/AGENTS.md` §1.5
 * describes, exactly what the `throw` cases below need.
 *
 * @import { Exp } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { expExpr, nodeExpr, sharedNodesOf, valueExpr } from './module.f.mjs'

/** @type {(e: Exp) => string} */
const printed = e => unwrap(nodeExpr(e))

/** The same, propagating: what a compiled module's body holds. @type {(e: Exp) => string} */
const valued = e => unwrap(valueExpr([])(e))

/** @type {(shared: readonly (readonly [Exp, string])[]) => (e: Exp) => string} */
const printedWith = shared => e => unwrap(expExpr(shared)(e))

/**
 * The refusal reason `nodeExpr` reports for `e`, read straight off the
 * `Result` rather than through {@link printed}'s `unwrap` — the specific
 * reason is exactly what a `throw` leaf's plain throw/no-throw check cannot
 * pin (`fjs/emergent_testing/todo/throw-payload-assertions.md`), but there is
 * no panic to catch here in the first place: `nodeExpr` never throws, so the
 * reason is already a plain value to assert on, not a payload to recover.
 *
 * @type {(e: Exp) => readonly unknown[]}
 */
const refusalReason = e => {
    const result = nodeExpr(e)
    assert(result[0] === 'error', result)
    return result[1]
}

export const proof = {
    /** Every primitive kind, as {@link printed} prints it standalone. */
    primitives: () => {
        assertEq(printed(null), 'Nullish::Null.to_any()')
        assertEq(printed(true), 'true.to_any()')
        assertEq(printed(false), 'false.to_any()')
        assertEq(printed(-0.3), 'f64_any(0xbfd3333333333333)')
        assertEq(printed('a'), 'string_any("a")')
        assertEq(printed(-1n), 'bigint_any(-1)')
        assertEq(printed(['undefined']), 'Nullish::Undefined.to_any()')
    },
    containers: () => {
        assertEq(printed(['[]', []]), 'Array::default().to_any()')
        assertEq(printed(['[]', [null]]), '[Nullish::Null.to_any()].to_array().to_any()')
        assertEq(printed(['{}', []]), 'Object::default().to_any()')
        assertEq(
            printed(['{}', [[':', 'k', null]]]),
            '[(string_key("k"), Nullish::Null.to_any())].to_object().to_any()')
    },
    /** Every operation node this printer knows, straight from the EDAG. */
    operations: () => {
        assertEq(printed(['-', 1]), '-(f64_any(0x3ff0000000000000))')
        assertEq(printed(['+', 1]), 'Any::unary_plus(f64_any(0x3ff0000000000000))')
        assertEq(
            printed(['?:', true, 1, 2]),
            'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), || Ok(f64_any(0x4000000000000000)))')
        assertEq(printed(['=>', ['[]', []], ['undefined']]), 'function_any()')
        assertEq(printed(['*', 1, 2]), 'f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)')
    },
    /**
     * A lazy operation's operands after the first are thunks, in either
     * mode: a value answers `|| Ok(…)`, and an operation answers its own
     * `Result` bare, and either body prints propagating, so a throw
     * anywhere inside it lands in the closure — which is what lets a bare
     * corpus statement hold an operation in a lazy position, nested however
     * it is, where an eager position still cannot (see `nesting`). The
     * first operand prints as the mode prints any operand.
     */
    lazy: () => {
        assertEq(
            printed(['&&', false, 1]),
            'Any::logical_and(false.to_any(), || Ok(f64_any(0x3ff0000000000000)))')
        assertEq(
            printed(['||', true, 1]),
            'Any::logical_or(true.to_any(), || Ok(f64_any(0x3ff0000000000000)))')
        assertEq(
            printed(['??', null, 1]),
            'Any::nullish_coalescing(Nullish::Null.to_any(), || Ok(f64_any(0x3ff0000000000000)))')
        // `false && (1n / 0n)`: the throwing operation is the closure's own
        // answer, whether the statement is bare or propagating.
        assertEq(
            printed(['&&', false, ['/', 1n, 0n]]),
            'Any::logical_and(false.to_any(), || bigint_any(1) / bigint_any(0))')
        assertEq(
            valued(['&&', false, ['/', 1n, 0n]]),
            '(Any::logical_and(false.to_any(), || bigint_any(1) / bigint_any(0)))?')
        // Inside the thunk everything propagates, whatever the statement's
        // mode: the operation's own operands, and an operation inside a
        // container the thunk answers — `false && [1n / 0n]`.
        const nestedThunk = '|| (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))? * f64_any(0x4008000000000000)'
        assertEq(
            printed(['&&', false, ['*', ['*', 1, 2], 3]]),
            `Any::logical_and(false.to_any(), ${nestedThunk})`)
        assertEq(
            valued(['&&', false, ['*', ['*', 1, 2], 3]]),
            `(Any::logical_and(false.to_any(), ${nestedThunk}))?`)
        const arrayThunk = '|| Ok([(bigint_any(1) / bigint_any(0))?].to_array().to_any())'
        assertEq(
            printed(['&&', false, ['[]', [['/', 1n, 0n]]]]),
            `Any::logical_and(false.to_any(), ${arrayThunk})`)
        assertEq(
            valued(['&&', false, ['[]', [['/', 1n, 0n]]]]),
            `(Any::logical_and(false.to_any(), ${arrayThunk}))?`)
        // A `.` read is an operation too, and a container is a value.
        assertEq(
            valued(['||', true, ['.', ['{}', []], 'a']]),
            '(Any::logical_or(true.to_any(), || Any::member_access(Object::default().to_any(), string_any("a"))))?')
        assertEq(
            printed(['||', true, ['[]', [['-', 1]]]]),
            'Any::logical_or(true.to_any(), || Ok([(-(f64_any(0x3ff0000000000000)))?].to_array().to_any()))')
        // Both arms of `?:`, and a nested lazy operation in an arm, which
        // is a thunk inside a thunk; a lazy operation as the eager first
        // operand is composed like any operator there.
        assertEq(
            valued(['?:', true, 1, ['/', 1n, 0n]]),
            '(Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), || bigint_any(1) / bigint_any(0)))?')
        assertEq(
            printed(['?:', ['&&', true, false], ['||', false, 1], 2]),
            'Any::conditional((Any::logical_and(true.to_any(), || Ok(false.to_any()))), || Any::logical_or(false.to_any(), || Ok(f64_any(0x3ff0000000000000))), || Ok(f64_any(0x4000000000000000)))')
        // The first operand is eager, and composed where its rendering
        // would otherwise re-associate — exactly as an eager operator's.
        assertEq(
            printed(['&&', ['*', 1, 2], 3]),
            'Any::logical_and((f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)), || Ok(f64_any(0x4008000000000000)))')
        assertEq(
            valued(['&&', ['*', 1, 2], 3]),
            '(Any::logical_and((f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?, || Ok(f64_any(0x4008000000000000))))?')
    },
    /** A composed operand keeps its parentheses; an atomic one does not. */
    nesting: () => {
        assertEq(
            printed(['*', 1, ['*', 2, 3]]),
            'f64_any(0x3ff0000000000000) * (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))')
        assertEq(printed(['-', ['undefined']]), '-(Nullish::Undefined.to_any())')
    },
    /**
     * Property access — new relative to the operator-test printer, whose
     * corpus has no receivers to index.
     */
    dot: () => {
        assertEq(
            printed(['.', ['{}', [[':', 'a', 1]]], 'a']),
            'Any::member_access([(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any(), string_any("a"))')
        // Atomic as an operand: the call binds tighter than any infix
        // operator, so no parentheses are needed around it.
        assertEq(
            printed(['-', ['.', ['{}', []], 'b']]),
            '-(Any::member_access(Object::default().to_any(), string_any("b")))')
    },
    /**
     * Propagating, every operation is an `Any<A>` with its throw handed to
     * the enclosing function: an operator's text parenthesized before the
     * `?`, a `.` read's call followed by it, and a nested operation atomic
     * as written, so it takes no parentheses of its own.
     */
    value: () => {
        assertEq(valued(['*', 1, 2]), '(f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?')
        assertEq(
            valued(['*', 1, ['*', 2, 3]]),
            '(f64_any(0x3ff0000000000000) * (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))?)?')
        assertEq(valued(['-', ['undefined']]), '(-(Nullish::Undefined.to_any()))?')
        assertEq(
            valued(['.', ['{}', [[':', 'a', 1]]], 'a']),
            'Any::member_access([(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any(), string_any("a"))?')
        assertEq(
            valued(['.', ['.', ['{}', [[':', 'a', ['{}', []]]]], 'a'], 'b']),
            'Any::member_access(Any::member_access([(string_key("a"), Object::default().to_any())].to_object().to_any(), string_any("a"))?, string_any("b"))?')
        assertEq(valued(['[]', [['-', 1]]]), '[(-(f64_any(0x3ff0000000000000)))?].to_array().to_any()')
        assertEq(valued([',', [['-', 1], 2]]), '{ let _: Any<A> = (-(f64_any(0x3ff0000000000000)))?; f64_any(0x4000000000000000) }')
        // A literal is a literal in either mode.
        assertEq(valued(1), printed(1))
    },
    /**
     * `Any::member_access` reads an array, a string, a boolean, a number, and
     * a bigint receiver correctly — unlike `Any::own_property`, which only
     * inspects a plain object — so a base this printer can prove is one of
     * these prints the call rather than refusing it: `[1].length`, `"ab"[0]`,
     * `true.x` (`undefined`, since a boolean has no own properties at all)
     * are accepted DJS, per `fjs/fsc/README.md`.
     */
    dotOnNonObjectLiteral: () => {
        assertEq(
            printed(['.', ['[]', [1]], 'length']),
            'Any::member_access([f64_any(0x3ff0000000000000)].to_array().to_any(), string_any("length"))')
        assertEq(
            printed(['.', 'ab', '0']),
            'Any::member_access(string_any("ab"), string_any("0"))')
        assertEq(
            printed(['.', true, 'x']),
            'Any::member_access(true.to_any(), string_any("x"))')
        assertEq(
            printed(['.', 5, 'x']),
            'Any::member_access(f64_any(0x4014000000000000), string_any("x"))')
        assertEq(
            printed(['.', 5n, 'x']),
            'Any::member_access(bigint_any(5), string_any("x"))')
    },
    /** A literal `number` index prints the same way a numeric primitive does elsewhere in this file. */
    numericIndex: () => {
        assertEq(
            printed(['.', ['{}', []], 0]),
            'Any::member_access(Object::default().to_any(), f64_any(0x0000000000000000))')
    },
    /**
     * A `.` base folds through a literal object chain before `nullishBase`
     * runs, so a nullish result reachable only several property reads away
     * is caught exactly as a direct one is — {@link dotOnNestedMissingKey} in
     * `throw` below pins the refusal this buys. Every case here is the other
     * side of that: the fold resolving to something other than a nullish
     * shape, printed rather than refused, however far down the chain that
     * shape turns up.
     */
    resolvedBase: () => {
        // Resolves to an object two hops away: printed, not refused.
        assertEq(
            printed(['.', ['.', ['{}', [[':', 'a', ['{}', [[':', 'c', 5]]]]]], 'a'], 'c']),
            'Any::member_access(Any::member_access([(string_key("a"), [(string_key("c"), f64_any(0x4014000000000000))].to_object().to_any())].to_object().to_any(), string_any("a")), string_any("c"))')
        // The fold can just as well resolve to a non-object literal (an
        // array, here) two hops away. `nullishBase` treats that the same as
        // if the fold had left it opaque — neither is a literal `null` nor
        // the tagged `['undefined']` node — so this prints either way; the
        // assertion is that resolving this far changes nothing and breaks
        // nothing, not that some refusal is being dodged.
        assertEq(
            printed(['.', ['.', ['{}', [[':', 'a', ['[]', [1]]]]], 'a'], 'length']),
            'Any::member_access(Any::member_access([(string_key("a"), [f64_any(0x3ff0000000000000)].to_array().to_any())].to_object().to_any(), string_any("a")), string_any("length"))')
        // `resolvedBase` folds through a `.` node only as far as an actual
        // literal object — a chain whose middle step resolves to something
        // else (an empty array, here) stops there, unresolved, rather than
        // assuming an object further down: its own tag check (`base[0] !==
        // '{}'`) guards against reading an array's items as if they were
        // `[':', key, value]` properties. Printed correctly all the same —
        // the middle step's own base is checked directly when it is printed
        // — proving the fold neither crashed nor misread the array's shape
        // two hops up.
        //
        // The array is empty rather than, say, `[1]`: with a non-empty item
        // list, dropping just this `base[0] !== '{}'` clause (leaving the
        // rest of that guard and the spread check below it intact) still
        // leaves this node unresolved, because the spread check's
        // `p[0] !== ':'` happens to hold for a bare scalar item too — a
        // mutation this test would then miss. An empty item list has
        // nothing for `.some(...)` to fail on, so it cannot be
        // coincidentally rescued that way: reading past the weakened guard,
        // `props.some(...)` is vacuously `false`, `findLast` finds nothing,
        // and the fold would incorrectly continue to `['undefined']` —
        // wrongly refusing this print as a nullish base — if that clause
        // were the only thing standing in the way.
        assertEq(
            printed(['.', ['.', ['[]', []], 'length'], 'toString']),
            'Any::member_access(Any::member_access(Array::default().to_any(), string_any("length")), string_any("toString"))')
    },
    /**
     * `resolvedBase` also folds a literal array's or string's own canonical
     * index — a number or its canonical decimal string, matching
     * `Array`/`String::member_access` treating the two alike — and a
     * literal object's own numeric key (stringified first), mirroring
     * `Object::member_access`. The fold `throw` below needs
     * (`dotOnArrayOutOfRangeIndex` and its neighbors) is what catches a
     * nullish result several hops down an index, not just a property name.
     * Here, the other side: an in-bounds index resolving to a non-nullish
     * value, printed rather than refused. Every case nests two `.` steps
     * deep — a direct `['.', literal, index]` never reaches this fold at
     * all, since `resolvedBase` only inspects a *resolved* base, one level
     * in from whichever `.` node is being checked.
     */
    resolvedBaseThroughIndex: () => {
        // An array literal's in-bounds index resolves to its element, and
        // the fold continues into that element — an object literal here —
        // exactly as it would one property access away.
        assertEq(
            printed(['.', ['.', ['[]', [['{}', [[':', 'a', 1]]]]], 0], 'a']),
            'Any::member_access(Any::member_access([[(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any()].to_array().to_any(), f64_any(0x0000000000000000)), string_any("a"))')
        // A numeric key into an object literal is stringified first, the
        // same way `{0:'x'}[0]` and `{0:'x'}['0']` read the same property
        // in real JS: the fold matches the string-keyed property `"0"`
        // here and continues into it, rather than leaving the object
        // opaque to a numeric key.
        assertEq(
            printed(['.', ['.', ['{}', [[':', '0', 'x']]], 0], 'length']),
            'Any::member_access(Any::member_access([(string_key("0"), string_any("x"))].to_object().to_any(), f64_any(0x0000000000000000)), string_any("length"))')
        // A string literal's in-bounds index resolves to the single-unit
        // string at that position, the same way `{@link
        // dotOnStringOutOfRangeIndex}` (`throw`, below) resolves an
        // out-of-range one to `undefined` instead.
        assertEq(
            printed(['.', ['.', 'ab', 0], 'length']),
            'Any::member_access(Any::member_access(string_any("ab"), f64_any(0x0000000000000000)), string_any("length"))')
        // `[1]["0"]` reads element `0` exactly as `[1][0]` does: `"0"` is
        // the canonical decimal form of the index `0`, which
        // `Array::member_access` accepts as an alternative spelling of the
        // same key. Resolves to `1`, and `.x` on a number is `undefined`
        // (never nullish), so this prints two hops in.
        assertEq(
            printed(['.', ['.', ['[]', [1]], '0'], 'x']),
            'Any::member_access(Any::member_access([f64_any(0x3ff0000000000000)].to_array().to_any(), string_any("0")), string_any("x"))')
        // `.length` on a string literal is a number, never nullish, so it
        // is left opaque here exactly as an array's `.length` is above —
        // proving the string branch's own `b === 'length'` guard behaves
        // the same way.
        assertEq(
            printed(['.', ['.', 'ab', 'length'], 'toString']),
            'Any::member_access(Any::member_access(string_any("ab"), string_any("length")), string_any("toString"))')
    },
    /**
     * `,` — new relative to the operator-test printer, whose corpus has no
     * anchored, unreached roots. Every operand is established, in the order
     * `fjs/fsc/edag/module.f.mjs`'s `resolve` puts them in (imports, then
     * unreached `const`s, then the export), and the last one's value is the
     * whole node's.
     */
    comma: () => {
        assertEq(printed([',', [1, 2]]), '{ let _: Any<A> = f64_any(0x3ff0000000000000); f64_any(0x4000000000000000) }')
        assertEq(
            printed([',', [1, 2, 3]]),
            '{ let _: Any<A> = f64_any(0x3ff0000000000000); let _: Any<A> = f64_any(0x4000000000000000); f64_any(0x4008000000000000) }')
        // Atomic as an operand, the same as `.`: a brace-delimited block
        // needs no parentheses wherever it stands.
        assertEq(
            printed(['-', [',', [1, 2]]]),
            '-({ let _: Any<A> = f64_any(0x3ff0000000000000); f64_any(0x4000000000000000) })')
    },
    /** A shared node prints once and clones at every later reference. */
    sharing: () => {
        /** @type {Exp} */
        const base = ['[]', []]
        const shared = /** @type {readonly (readonly [Exp, string])[]} */ ([[base, 'x.clone()']])
        assertEq(printedWith(shared)(base), 'x.clone()')
        assertEq(printedWith(shared)(['[]', [base]]), '[x.clone()].to_array().to_any()')
        // In a lazy position too: the binding is established before the
        // root, as a `const` is at its declaration, and the thunk clones it
        // — a shared operation included, which is its binding there, not
        // the operation.
        assertEq(
            printedWith(shared)(['??', null, base]),
            'Any::nullish_coalescing(Nullish::Null.to_any(), || Ok(x.clone()))')
        /** @type {Exp} */
        const op = ['*', 1, 2]
        assertEq(
            printedWith([[op, 'y.clone()']])(['??', null, op]),
            'Any::nullish_coalescing(Nullish::Null.to_any(), || Ok(y.clone()))')
    },
    sharedNodesOf: {
        /** A node reached from only one place is never a binding candidate. */
        none: () => {
            assertEq(sharedNodesOf(['[]', [1, 2]]).length, 0)
        },
        /**
         * Two references to the same node, by identity, is exactly what a
         * `const` referenced twice looks like once lowered to an EDAG — see
         * `fjs/fsc/edag/module.f.mjs`'s `lower`.
         */
        shared: () => {
            /** @type {Exp} */
            const base = ['[]', []]
            /** @type {Exp} */
            const root = ['[]', [base, base]]
            const found = sharedNodesOf(root)
            assertEq(found.length, 1)
            assert(found[0] === base, found)
        },
        /**
         * Dependency order: a shared node nested inside another shared node
         * comes first, since the outer one's `let` initializer needs to clone
         * the inner one's binding.
         */
        order: () => {
            /** @type {Exp} */
            const inner = ['[]', []]
            /** @type {Exp} */
            const outer = ['[]', [inner]]
            /** @type {Exp} */
            const root = ['[]', [outer, outer, inner, inner]]
            const found = sharedNodesOf(root)
            assertEq(found.length, 2)
            assert(found[0] === inner, found)
            assert(found[1] === outer, found)
        },
        /** The root itself is never reported, however the graph is shaped. */
        excludesRoot: () => {
            /** @type {Exp} */
            const root = ['[]', [1]]
            assert(!sharedNodesOf(root).includes(root), sharedNodesOf(root))
        },
    },
    /**
     * A literal the target type cannot hold — a string with a lone
     * surrogate, a bigint outside `i64` — is refused where it is printed,
     * with the reason this printer gives it, wherever a string literal
     * stands: a primitive, an object key, an index.
     */
    literalRefusals: () => {
        assertStructurallySame(
            refusalReason('a\ud800b'),
            ['no Rust string literal for a lone surrogate in', '"a\\ud800b"'])
        assertStructurallySame(
            refusalReason(['{}', [[':', '\udc00', 1]]]),
            ['no Rust string literal for a lone surrogate in', '"\\udc00"'])
        assertStructurallySame(
            refusalReason(['.', ['{}', []], '\ud800']),
            ['no Rust string literal for a lone surrogate in', '"\\ud800"'])
        assertStructurallySame(refusalReason(2n ** 63n), ['no Rust i64 for', 2n ** 63n])
    },
    throw: {
        /** An operation the printer has no `nanvm-lib` spelling for. */
        unknownOperation: () => printed(['is', 1, 2]),
        /** A string no Rust literal can hold, and a bigint no `i64` can. */
        loneSurrogate: () => printed('\ud800'),
        bigintOutOfRange: () => printed(-(2n ** 63n) - 1n),
        /** A lambda other than `() => undefined`. */
        lambdaBodyNotUndefined: () => printed(['=>', ['[]', []], ['args']]),
        /** An object key the printer cannot spell. */
        computedKey: () => printed(['{}', [[':', ['undefined'], 1]]]),
        /**
         * A `Number(...)` cast index: it names a run-time coercion, not a
         * literal key `indexExpr` can spell directly, and this printer has no
         * `Number(...)` cast primitive to route it through.
         */
        numberCastIndex: () => printed(['.', ['{}', []], ['Number', 1]]),
        /** A `.` chain step: out of scope, refused rather than dropped. */
        dotChainStep: () => printed(['.', ['{}', []], 'b', ['|()', ['[]', []]]]),
        /**
         * A property read on a nullish base throws at run time — refused
         * rather than compiled to a Rust panic (`fjs/fsc/README.md`: "a
         * `null` or `undefined` base is the one failure a data module can
         * make").
         */
        dotOnNull: () => printed(['.', null, 'a']),
        dotOnUndefined: () => printed(['.', ['undefined'], 'a']),
        /**
         * The same refusal, met through a base {@link resolvedBase} must fold
         * through a literal object first — a nullish result from a key
         * absent in a fully literal object, a hop further away than the
         * direct cases above.
         */
        dotOnNestedMissingKey: () => printed(['.', ['.', ['{}', []], 'missing'], 'x']),
        /**
         * The same nullish-base refusal, met through a *numeric* index this
         * time: an out-of-range array element, an out-of-range string
         * character, a missing numeric object key, and a literal `null`
         * array element all read `undefined`/`null` at run time — a nullish
         * result `resolvedBase`'s array/string/object-numeric-key fold must
         * see through, the same as its string-keyed object fold already
         * does for {@link dotOnNestedMissingKey} above. Before that fold
         * covered these shapes, `indexExpr` accepting a numeric literal let
         * each of these compile to a call chain that throws at run time
         * instead of refusing — the exact failure this refusal replaces.
         */
        dotOnArrayOutOfRangeIndex: () => printed(['.', ['.', ['[]', []], 0], 'x']),
        dotOnStringOutOfRangeIndex: () => printed(['.', ['.', 'a', 1], 'x']),
        dotOnObjectMissingNumericKey: () => printed(['.', ['.', ['{}', []], 0], 'x']),
        dotOnArrayNullElement: () => printed(['.', ['.', ['[]', [null]], 0], 'x']),
        /**
         * A negative, fractional, or non-finite numeric index is never a
         * valid array/string index in real JS either — `[1][-1]`, `[1][0.5]`,
         * and `[1][NaN]` all read `undefined` — so `resolvedBase` treats
         * every one of them as a miss the same way it treats an in-range
         * check that fails, rather than leaving them opaque just because
         * they are not themselves in-bounds indices.
         */
        dotOnArrayNegativeIndex: () => printed(['.', ['.', ['[]', [1]], -1], 'x']),
        dotOnArrayFractionalIndex: () => printed(['.', ['.', ['[]', [1]], 0.5], 'x']),
        dotOnArrayNanIndex: () => printed(['.', ['.', ['[]', [1]], NaN], 'x']),
        /**
         * The same numeric-index refusal again, this time through a *string*
         * key that names no index at all: `Array::member_access`'s string
         * branch answers `undefined` for any key that is neither `"length"`
         * nor the canonical decimal form of an in-range index — a bare
         * word like `"toString"` and a non-canonical numeral like `"01"`
         * both miss unconditionally, the same as an out-of-range number.
         */
        dotOnArrayNonNumericStringIndex: () => printed(['.', ['.', ['[]', [1]], 'toString'], 'y']),
        /**
         * A two-element array, not one: `arrayIndexOf`'s round-trip check
         * (`String(n) === b`) is the only thing standing between `"01"` and
         * index `1` — drop the check and `Number('01')` still canonicalizes
         * to `1`. With a single-element array that mutation is invisible,
         * since index `1` is out of range either way and the refusal holds
         * for an unrelated reason; a second element makes `1` a real,
         * in-range index, so only the round-trip check still refuses this.
         */
        dotOnArrayNonCanonicalStringIndex: () => printed(['.', ['.', ['[]', [1, 2]], '01'], 'y']),
        /**
         * `Any::member_access` never special-cases a number, a boolean, a
         * bigint, or a function receiver — every key on one answers
         * `undefined` unconditionally (see its own doc comment in
         * `nanvm-lib`), the same as `Any::own_property` did for these
         * before `member_access` existed. `resolvedBase` folds straight to
         * the tagged `['undefined']` node for one of these regardless of
         * the key, the same way it folds a missing property or an
         * out-of-range index — before this, a chain two hops past one of
         * these primitives (or past a lambda a `.` node's own value
         * resolved to) compiled to a call chain that panics.
         */
        dotOnNumberPrimitiveMiss: () => printed(['.', ['.', 1, 'x'], 'y']),
        dotOnBooleanPrimitiveMiss: () => printed(['.', ['.', true, 'x'], 'y']),
        dotOnBigintPrimitiveMiss: () => printed(['.', ['.', 5n, 'x'], 'y']),
        dotOnFunctionMiss: () => printed(
            ['.', ['.', ['.', ['{}', [[':', 'f', ['=>', ['[]', []], ['undefined']]]]], 'f'], 'x'], 'y']),
        /**
         * A `Number(...)` cast key one step into a chain, over an array or a
         * string base this time (the object case is
         * {@link resolvedBaseRefusals}'s `dotOnObjectWithNumberCastKey`):
         * `resolvedBase`'s array and string branches accept only a literal
         * `string` or `number` key, so a `NumberCast` key leaves the base
         * unresolved rather than mistaking it for one. The refusal surfaces
         * one level up regardless, from `indexExpr`'s own refusal of the
         * same key when the inner node is printed — the same one
         * `numberCastIndex` pins directly.
         */
        dotOnArrayWithNumberCastKey: () => printed(['.', ['.', ['[]', []], ['Number', 1]], 'x']),
        dotOnStringWithNumberCastKey: () => printed(['.', ['.', 'ab', ['Number', 1]], 'x']),
        /** `Exps` admits an empty list in the schema; the Rust backend has no value for it. */
        emptyComma: () => printed([',', []]),
    },
    /**
     * `resolvedBase` shapes whose refusal a bare `throw` leaf cannot pin:
     * the leaf only checks *that* `printed` throws, so a change to
     * `resolvedBase` that swaps one refusal reason for another — a real
     * regression — would still pass under `throw`. {@link refusalReason}
     * reads `nodeExpr`'s `Result` directly, so each case here checks the
     * exact reason instead. One shape used to live here —
     * `dotOnNonObjectMiddleStep`, a chain whose middle step resolves to an
     * array — but `Any::member_access` reads an array correctly now, so it
     * is no longer a refusal at all; {@link resolvedBase}'s own proof group
     * above carries it as a print instead, and the mutation-detection
     * reasoning that shape earned here (an empty array, not `[1]`, is
     * load-bearing) carries with it.
     */
    resolvedBaseRefusals: {
        /**
         * `resolvedBase` only folds through a literal object; a `.` node
         * holding a chain-step continuation is exactly the shape it must
         * *not* try to fold through (a continuation is control flow, not a
         * value — see `fjs/edag/README.md`'s Chains section), so it is left
         * unresolved rather than misread as an ordinary property access.
         * That base is still opaque to the nullish-base check, so the
         * refusal here comes from printing the chain step itself, one level
         * down, the same as `dotChainStep` above — proving `resolvedBase`
         * did not crash or silently drop the continuation on the way.
         */
        dotOnChainStepBase: () => {
            /** @type {Exp} */
            const inner = ['.', ['{}', []], 'y', ['|()', ['[]', []]]]
            assertStructurallySame(
                refusalReason(['.', inner, 'z']),
                ['no Rust for a property-access chain step', inner])
        },
        /**
         * A key absent from an object holding a spread cannot be resolved
         * soundly — the spread's own contribution isn't known statically —
         * so `resolvedBase` declines to look inside it at all, the same way
         * it declines a `const` or an import. The refusal surfaces from
         * `propertyExpr`'s own spread check when the object is printed,
         * the same one `objectSpread` (`fjs/nanvm/rust/proof.f.mjs`) pins.
         */
        dotOnObjectWithSpread: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['{}', [['...', 'x']]], 'y'], 'z']),
                ['not a property', ['...', 'x']])
        },
        /**
         * The same declines-to-look-inside choice, for an array holding a
         * spread and a numeric index: a spread's own contribution to the
         * positions after it isn't known statically, so `resolvedBase`
         * leaves the whole array unresolved rather than risk reading the
         * wrong element. Printing the array literal itself then refuses,
         * for the same reason a spread anywhere in an array always does —
         * `f`'s '`[]`' handling has no operator table entry for `'...'` —
         * proving `resolvedBase`'s own bail did not crash or silently
         * assume an index into the array's syntactic items is the same as
         * an index into its run-time elements.
         */
        dotOnArrayWithSpread: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['[]', [['...', 'x'], 1]], 0], 'y']),
                ['no Rust for', '...'])
        },
        /**
         * A `Number(...)` cast key one step into a chain: `resolvedBase`'s
         * object fold accepts only a literal `string` or `number` key
         * ({@link resolvedBaseThroughNumericKey}), so a `NumberCast` key —
         * itself an `Exp`, not a literal — leaves the object base
         * unresolved rather than mistaking it for one or the other. The
         * refusal surfaces one level up regardless, from `indexExpr`'s own
         * refusal of the same key when the inner node is printed — the
         * same one `numberCastIndex` (`throw`, above) pins directly —
         * proving the fold neither crashed nor silently accepted the cast
         * as a literal key on its way past.
         */
        dotOnObjectWithNumberCastKey: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['{}', []], ['Number', 1]], 'x']),
                ['no Rust for a Number(...) cast index', ['Number', 1]])
        },
    },
}
