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
            'Any::own_property([(string_key("a"), (1f64).to_any())].to_object().to_any(), string_any("a")).unwrap()')
        // Atomic as an operand: the method chain binds tighter than any
        // infix operator, so no parentheses are needed around it. The base
        // is an object literal — the one shape `own_property` reads
        // correctly — so this exercises parenthesization, not a refusal.
        assertEq(
            printed(['-', ['.', ['{}', []], 'b']]),
            '-(Any::own_property(Object::default().to_any(), string_any("b")).unwrap())')
    },
    /**
     * A `.` base folds through a literal object chain before the shape
     * checks run, so a receiver two or more property reads away is checked
     * exactly as a direct one is.
     */
    resolvedBase: () => {
        // Resolves to an object two hops away: printed, not refused.
        assertEq(
            printed(['.', ['.', ['{}', [[':', 'a', ['{}', [[':', 'c', 5]]]]]], 'a'], 'c']),
            'Any::own_property(Any::own_property([(string_key("a"), [(string_key("c"), (5f64).to_any())].to_object().to_any())].to_object().to_any(), string_any("a")).unwrap(), string_any("c")).unwrap()')
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
        /** A numeric index: no `nanvm-lib` spelling until `entry` lands. */
        numericIndex: () => printed(['.', ['{}', []], 0]),
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
         * `own_property` only inspects a plain object, so a base this
         * printer can *prove* is something else — an array or string
         * literal, a boolean, a number, a bigint — is refused rather than
         * silently swapped for `undefined` (`[1].length`, `"ab"[0]` are
         * accepted DJS, per `fjs/fsc/README.md`).
         */
        dotOnArrayLiteral: () => printed(['.', ['[]', [1]], 'length']),
        dotOnStringLiteral: () => printed(['.', 'ab', '0']),
        dotOnBooleanLiteral: () => printed(['.', true, 'x']),
        dotOnNumberLiteral: () => printed(['.', 5, 'x']),
        dotOnBigintLiteral: () => printed(['.', 5n, 'x']),
        /**
         * The same two refusals, met through a base {@link resolvedBase}
         * must fold through a literal object first — `{ a: [1] }.a.length`
         * and a nullish result from a key absent in a fully literal object,
         * each a hop further away than the direct cases above.
         */
        dotOnNestedArrayLiteral: () => printed(['.', ['.', ['{}', [[':', 'a', ['[]', [1]]]]], 'a'], 'length']),
        dotOnNestedMissingKey: () => printed(['.', ['.', ['{}', []], 'missing'], 'x']),
        /** `Exps` admits an empty list in the schema; the Rust backend has no value for it. */
        emptyComma: () => printed([',', []]),
    },
    /**
     * Three `resolvedBase` shapes whose refusal a bare `throw` leaf cannot
     * pin: the leaf only checks *that* `printed` throws, so a change to
     * `resolvedBase` that swaps one refusal reason for another — a real
     * regression — would still pass under `throw`. {@link refusalReason}
     * reads `nodeExpr`'s `Result` directly, so each case here checks the
     * exact reason instead.
     */
    resolvedBaseRefusals: {
        /**
         * `resolvedBase` only folds through a literal object; a `.` node
         * holding a chain-step continuation is exactly the shape it must
         * *not* try to fold through (a continuation is control flow, not a
         * value — see `fjs/edag/README.md`'s Chains section), so it is left
         * unresolved rather than misread as an ordinary property access.
         * That base is still opaque to the shape checks (it is not provably
         * nullish or non-object), so the refusal here comes from printing
         * the chain step itself, one level down, the same as
         * `dotChainStep` above — proving `resolvedBase` did not crash or
         * silently drop the continuation on the way.
         */
        dotOnChainStepBase: () => {
            /** @type {Exp} */
            const inner = ['.', ['{}', []], 'y', ['|()', ['[]', []]]]
            assertStructurallySame(
                refusalReason(['.', inner, 'z']),
                ['no Rust for a property-access chain step', inner])
        },
        /**
         * `resolvedBase` folds through a `.` node only as far as an actual
         * literal object — a chain whose middle step resolves to something
         * else (an array, here) stops there, unresolved, rather than
         * assuming an object further down. The refusal still surfaces —
         * from the middle step's own direct check when it is printed, the
         * same one `dotOnArrayLiteral` pins — proving the fold neither
         * crashed nor wrongly treated the array as an object two hops up.
         *
         * The array is empty rather than `[1]`: with a non-empty item list,
         * dropping just `resolvedBase`'s `base[0] !== '{}'` clause (leaving
         * the rest of that guard and the spread check below it intact)
         * still refuses at this same node, because the spread check's
         * `p[0] !== ':'` happens to hold for a bare scalar item too and
         * returns unresolved anyway — a mutation this test would then miss.
         * An empty item list has nothing for `.some(...)` to fail on, so it
         * cannot be coincidentally rescued that way: reading past the
         * weakened guard, `props.some(...)` is vacuously `false`, `findLast`
         * finds nothing, and the fold would incorrectly continue to
         * `['undefined']` — a different, wrong reason — if that clause were
         * the only thing standing in the way.
         */
        dotOnNonObjectMiddleStep: () => {
            /** @type {Exp} */
            const middle = ['.', ['[]', []], 'length']
            assertStructurallySame(
                refusalReason(['.', middle, 'toString']),
                ['no nanvm-lib own-property read for this receiver type yet', middle])
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
