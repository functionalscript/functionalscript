/**
 * Proofs for the shared EDAG→Rust printer.
 *
 * @import { Exp } from '../types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { expExpr, nodeExpr, sharedNodesOf } from './module.f.mjs'

export const proof = {
    /** Every primitive kind, as {@link nodeExpr} prints it standalone. */
    primitives: () => {
        assertEq(nodeExpr(null), 'Nullish::Null.to_any()')
        assertEq(nodeExpr(true), 'true.to_any()')
        assertEq(nodeExpr(false), 'false.to_any()')
        assertEq(nodeExpr(-0.3), '(-0.3f64).to_any()')
        assertEq(nodeExpr('a'), 'string_any("a")')
        assertEq(nodeExpr(-1n), 'bigint_any(-1)')
        assertEq(nodeExpr(['undefined']), 'Nullish::Undefined.to_any()')
    },
    containers: () => {
        assertEq(nodeExpr(['[]', []]), 'Array::default().to_any()')
        assertEq(nodeExpr(['[]', [null]]), '[Nullish::Null.to_any()].to_array().to_any()')
        assertEq(nodeExpr(['{}', []]), 'Object::default().to_any()')
        assertEq(
            nodeExpr(['{}', [[':', 'k', null]]]),
            '[(string_key("k"), Nullish::Null.to_any())].to_object().to_any()')
    },
    /** Every operation node this printer knows, straight from the EDAG. */
    operations: () => {
        assertEq(nodeExpr(['-', 1]), '-((1f64).to_any())')
        assertEq(nodeExpr(['+', 1]), 'Any::unary_plus((1f64).to_any())')
        assertEq(
            nodeExpr(['?:', true, 1, 2]),
            'Any::conditional(true.to_any(), (1f64).to_any(), (2f64).to_any())')
        assertEq(nodeExpr(['=>', ['[]', []], ['undefined']]), 'function_any()')
        assertEq(nodeExpr(['*', 1, 2]), '(1f64).to_any() * (2f64).to_any()')
    },
    /** A composed operand keeps its parentheses; an atomic one does not. */
    nesting: () => {
        assertEq(
            nodeExpr(['*', 1, ['*', 2, 3]]),
            '(1f64).to_any() * ((2f64).to_any() * (3f64).to_any())')
        assertEq(nodeExpr(['-', ['undefined']]), '-(Nullish::Undefined.to_any())')
    },
    /**
     * Property access — new relative to the operator-test printer, whose
     * corpus has no receivers to index.
     */
    dot: () => {
        assertEq(
            nodeExpr(['.', ['{}', [[':', 'a', 1]]], 'a']),
            'Any::own_property([(string_key("a"), (1f64).to_any())].to_object().to_any(), string_any("a")).unwrap()')
        // Atomic as an operand: the method chain binds tighter than any
        // infix operator, so no parentheses are needed around it. The base
        // is an object literal — the one shape `own_property` reads
        // correctly — so this exercises parenthesization, not a refusal.
        assertEq(
            nodeExpr(['-', ['.', ['{}', []], 'b']]),
            '-(Any::own_property(Object::default().to_any(), string_any("b")).unwrap())')
    },
    /**
     * `,` — new relative to the operator-test printer, whose corpus has no
     * anchored, unreached roots. Every operand is established, in the order
     * `fjs/fsc/edag/module.f.mjs`'s `resolve` puts them in (imports, then
     * unreached `const`s, then the export), and the last one's value is the
     * whole node's.
     */
    comma: () => {
        assertEq(nodeExpr([',', [1, 2]]), '{ let _: Any<A> = (1f64).to_any(); (2f64).to_any() }')
        assertEq(
            nodeExpr([',', [1, 2, 3]]),
            '{ let _: Any<A> = (1f64).to_any(); let _: Any<A> = (2f64).to_any(); (3f64).to_any() }')
        // Atomic as an operand, the same as `.`: a brace-delimited block
        // needs no parentheses wherever it stands.
        assertEq(
            nodeExpr(['-', [',', [1, 2]]]),
            '-({ let _: Any<A> = (1f64).to_any(); (2f64).to_any() })')
    },
    /** A shared node prints once and clones at every later reference. */
    sharing: () => {
        /** @type {Exp} */
        const base = ['[]', []]
        const shared = /** @type {readonly (readonly [Exp, string])[]} */ ([[base, 'x.clone()']])
        assertEq(expExpr(shared)(base), 'x.clone()')
        assertEq(expExpr(shared)(['[]', [base]]), '[x.clone()].to_array().to_any()')
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
        unknownOperation: () => nodeExpr(['!==', 1, 2]),
        /** A lambda other than `() => undefined`. */
        lambdaBodyNotUndefined: () => nodeExpr(['=>', ['[]', []], ['args']]),
        /** An object key the printer cannot spell. */
        computedKey: () => nodeExpr(['{}', [[':', ['undefined'], 1]]]),
        /** A numeric index: no `nanvm-lib` spelling until `entry` lands. */
        numericIndex: () => nodeExpr(['.', ['{}', []], 0]),
        /** A `.` chain step: out of scope, refused rather than dropped. */
        dotChainStep: () => nodeExpr(['.', ['{}', []], 'b', ['|()', ['[]', []]]]),
        /**
         * A property read on a nullish base throws at run time — refused
         * rather than compiled to a Rust panic (`fjs/fsc/README.md`: "a
         * `null` or `undefined` base is the one failure a data module can
         * make").
         */
        dotOnNull: () => nodeExpr(['.', null, 'a']),
        dotOnUndefined: () => nodeExpr(['.', ['undefined'], 'a']),
        /**
         * `own_property` only inspects a plain object, so a base this
         * printer can *prove* is something else — an array or string
         * literal, a boolean, a number, a bigint — is refused rather than
         * silently swapped for `undefined` (`[1].length`, `"ab"[0]` are
         * accepted DJS, per `fjs/fsc/README.md`).
         */
        dotOnArrayLiteral: () => nodeExpr(['.', ['[]', [1]], 'length']),
        dotOnStringLiteral: () => nodeExpr(['.', 'ab', '0']),
        dotOnBooleanLiteral: () => nodeExpr(['.', true, 'x']),
    },
}
