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
import { expExpr, nodeExpr, sharedNodesOf } from './module.f.mjs'

/** @type {(e: Exp) => string} */
const printed = e => unwrap(nodeExpr(e))

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
        assertEq(printed(-0.3), '(-0.3f64).to_any()')
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
        assertEq(printed(['-', 1]), '-((1f64).to_any())')
        assertEq(printed(['+', 1]), 'Any::unary_plus((1f64).to_any())')
        assertEq(
            printed(['?:', true, 1, 2]),
            'Any::conditional(true.to_any(), (1f64).to_any(), (2f64).to_any())')
        assertEq(printed(['=>', ['[]', []], ['undefined']]), 'function_any()')
        assertEq(printed(['*', 1, 2]), '(1f64).to_any() * (2f64).to_any()')
    },
    /** A composed operand keeps its parentheses; an atomic one does not. */
    nesting: () => {
        assertEq(
            printed(['*', 1, ['*', 2, 3]]),
            '(1f64).to_any() * ((2f64).to_any() * (3f64).to_any())')
        assertEq(printed(['-', ['undefined']]), '-(Nullish::Undefined.to_any())')
    },
    /**
     * Property access — new relative to the operator-test printer, whose
     * corpus has no receivers to index.
     */
    dot: () => {
        assertEq(
            printed(['.', ['{}', [[':', 'a', 1]]], 'a']),
            'Any::member_access([(string_key("a"), (1f64).to_any())].to_object().to_any(), string_any("a")).unwrap()')
        // Atomic as an operand: the method chain binds tighter than any
        // infix operator, so no parentheses are needed around it.
        assertEq(
            printed(['-', ['.', ['{}', []], 'b']]),
            '-(Any::member_access(Object::default().to_any(), string_any("b")).unwrap())')
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
            'Any::member_access([(1f64).to_any()].to_array().to_any(), string_any("length")).unwrap()')
        assertEq(
            printed(['.', 'ab', '0']),
            'Any::member_access(string_any("ab"), string_any("0")).unwrap()')
        assertEq(
            printed(['.', true, 'x']),
            'Any::member_access(true.to_any(), string_any("x")).unwrap()')
        assertEq(
            printed(['.', 5, 'x']),
            'Any::member_access((5f64).to_any(), string_any("x")).unwrap()')
        assertEq(
            printed(['.', 5n, 'x']),
            'Any::member_access(bigint_any(5), string_any("x")).unwrap()')
    },
    /** A literal `number` index prints the same way a numeric primitive does elsewhere in this file. */
    numericIndex: () => {
        assertEq(
            printed(['.', ['{}', []], 0]),
            'Any::member_access(Object::default().to_any(), (0f64).to_any()).unwrap()')
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
            'Any::member_access(Any::member_access([(string_key("a"), [(string_key("c"), (5f64).to_any())].to_object().to_any())].to_object().to_any(), string_any("a")).unwrap(), string_any("c")).unwrap()')
        // The fold can just as well resolve to a non-object literal (an
        // array, here) two hops away. `nullishBase` treats that the same as
        // if the fold had left it opaque — neither is a literal `null` nor
        // the tagged `['undefined']` node — so this prints either way; the
        // assertion is that resolving this far changes nothing and breaks
        // nothing, not that some refusal is being dodged.
        assertEq(
            printed(['.', ['.', ['{}', [[':', 'a', ['[]', [1]]]]], 'a'], 'length']),
            'Any::member_access(Any::member_access([(string_key("a"), [(1f64).to_any()].to_array().to_any())].to_object().to_any(), string_any("a")).unwrap(), string_any("length")).unwrap()')
        // `resolvedBase` folds through a `.` node only as far as an actual
        // literal object — a chain whose middle step resolves to something
        // else (an array, here) stops there, unresolved, rather than
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
            'Any::member_access(Any::member_access(Array::default().to_any(), string_any("length")).unwrap(), string_any("toString")).unwrap()')
    },
    /**
     * `,` — new relative to the operator-test printer, whose corpus has no
     * anchored, unreached roots. Every operand is established, in the order
     * `fjs/fsc/edag/module.f.mjs`'s `resolve` puts them in (imports, then
     * unreached `const`s, then the export), and the last one's value is the
     * whole node's.
     */
    comma: () => {
        assertEq(printed([',', [1, 2]]), '{ let _: Any<A> = (1f64).to_any(); (2f64).to_any() }')
        assertEq(
            printed([',', [1, 2, 3]]),
            '{ let _: Any<A> = (1f64).to_any(); let _: Any<A> = (2f64).to_any(); (3f64).to_any() }')
        // Atomic as an operand, the same as `.`: a brace-delimited block
        // needs no parentheses wherever it stands.
        assertEq(
            printed(['-', [',', [1, 2]]]),
            '-({ let _: Any<A> = (1f64).to_any(); (2f64).to_any() })')
    },
    /** A shared node prints once and clones at every later reference. */
    sharing: () => {
        /** @type {Exp} */
        const base = ['[]', []]
        const shared = /** @type {readonly (readonly [Exp, string])[]} */ ([[base, 'x.clone()']])
        assertEq(printedWith(shared)(base), 'x.clone()')
        assertEq(printedWith(shared)(['[]', [base]]), '[x.clone()].to_array().to_any()')
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
    throw: {
        /** An operation the printer has no `nanvm-lib` spelling for. */
        unknownOperation: () => printed(['!==', 1, 2]),
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
        /** `Exps` admits an empty list in the schema; the Rust backend has no value for it. */
        emptyComma: () => printed([',', []]),
    },
    /**
     * Two `resolvedBase` shapes whose refusal a bare `throw` leaf cannot
     * pin: the leaf only checks *that* `printed` throws, so a change to
     * `resolvedBase` that swaps one refusal reason for another — a real
     * regression — would still pass under `throw`. {@link refusalReason}
     * reads `nodeExpr`'s `Result` directly, so each case here checks the
     * exact reason instead. A third shape used to live here —
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
    },
}
