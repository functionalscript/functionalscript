/**
 * Proofs for the shared EDAG→Rust printer.
 *
 * `nodeExpr`/`expExpr` return a `Result` rather than throwing (see the
 * module's own doc comment for why), so every case here reads it through
 * {@link printed}/{@link printedWith}, which `unwrap` back to a throwing
 * convenience — the ordinary FunctionalScript panic `fjs/AGENTS.md` §1.5
 * describes, exactly what the `throw` cases below need.
 *
 * @import { Exp, PropertyLambda } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { braced, eagerNodesOf, expExpr, holdsFunction, nestsOperation, nodeExpr, readsArgs, readsFrame, scope, sharedNodesOf, statementsOf } from './module.f.mjs'

/** @type {(e: Exp) => string} */
const printed = e => unwrap(nodeExpr(e))

/** The lines of a scope over `e`: what a compiled module's body holds. @type {(e: Exp) => readonly string[]} */
const scoped = e => unwrap(scope(e))

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
    /**
     * A case that nests an operation in an eager position is a scope: the
     * statements over the caller's bindings, braced as a thunk's body is.
     * A nested operation in a lazy position, or a bound node, is not one:
     * the thunk's block binds the one, the binding's `.clone()` is the other.
     */
    nestsOperation: () => {
        /** @type {Exp} */
        const inner = ['*', 2, 3]
        assertEq(nestsOperation([])(['+', inner, 1]), true)
        assertEq(nestsOperation([])(['+', 1, 2]), false)
        assertEq(nestsOperation([])(['&&', true, inner]), false)
        assertEq(nestsOperation([[inner, 'x.clone()']])(['+', inner, 1]), false)
        assertEq(nestsOperation([])(['-', ['.', ['{}', []], 'a']]), true)
        assertStructurallySame(unwrap(statementsOf([])(['+', inner, 1])), [
            'let c0: Any<A> = (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))?;',
            'c0 + f64_any(0x3ff0000000000000)',
        ])
        assertStructurallySame(unwrap(statementsOf([[inner, 'x.clone()']])(['+', inner, 1])), [
            'x.clone() + f64_any(0x3ff0000000000000)',
        ])
        assertEq(braced(['a']), '{ a }')
        assertEq(braced(['a;', 'b']), '{\n    a;\n    b\n}')
    },
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
        assertEq(printed(['=>', 0, ['[]', []], ['undefined']]), 'function_any()')
        assertEq(printed(['*', 1, 2]), 'f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)')
    },
    /**
     * A lazy operation's operands after the first are thunks, in either
     * mode: a value answers `|| Ok(…)`, and an operation answers its own
     * `Result` bare, and a node inside the operand is a temporary the
     * thunk's own block binds, so a throw anywhere inside it lands in the
     * closure — which is what lets a bare corpus statement hold an
     * operation in a lazy position, nested however it is, where an eager
     * position still cannot (see `nesting`). The first operand prints as
     * the mode prints any operand.
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
        // In a scope a thunk with a body of its own is a temporary too,
        // `let cN = || …;`, and the operation's line names it.
        assertStructurallySame(
            scoped(['&&', false, ['/', 1n, 0n]]),
            [
                'let c0 = || bigint_any(1) / bigint_any(0);',
                'Any::logical_and(false.to_any(), c0)',
            ])
        // Inside the thunk every node with operands is a temporary of the
        // thunk's own block, whatever the statement's mode — established
        // only when the thunk is — and the block is the closure's body,
        // one line under another: the operation's own operand, and an
        // operation inside a container the thunk answers, `false && [1n /
        // 0n]`. The names follow the lines: the thunk's before its own.
        const nestedThunk = [
            '|| {',
            '    let c0: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;',
            '    c0 * f64_any(0x4008000000000000)',
            '}',
        ]
        assertEq(
            printed(['&&', false, ['*', ['*', 1, 2], 3]]),
            `Any::logical_and(false.to_any(), ${nestedThunk.join('\n')})`)
        assertStructurallySame(
            scoped(['&&', false, ['*', ['*', 1, 2], 3]]),
            [
                'let c0 = || {',
                '    let c1: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;',
                '    c1 * f64_any(0x4008000000000000)',
                '};',
                'Any::logical_and(false.to_any(), c0)',
            ])
        const arrayThunk = [
            '|| {',
            '    let c0: Any<A> = (bigint_any(1) / bigint_any(0))?;',
            '    Ok([c0].to_array().to_any())',
            '}',
        ].join('\n')
        assertEq(
            printed(['&&', false, ['[]', [['/', 1n, 0n]]]]),
            `Any::logical_and(false.to_any(), ${arrayThunk})`)
        assertStructurallySame(
            scoped(['&&', false, ['[]', [['/', 1n, 0n]]]]),
            [
                'let c0 = || {',
                '    let c1: Any<A> = (bigint_any(1) / bigint_any(0))?;',
                '    Ok([c1].to_array().to_any())',
                '};',
                'Any::logical_and(false.to_any(), c0)',
            ])
        // A `.` read is an operation too, and a container is a value.
        assertStructurallySame(
            scoped(['||', true, ['.', ['{}', []], 'a']]),
            [
                'let c0 = || Any::dot(Object::default().to_any(), string_any("a")).end();',
                'Any::logical_or(true.to_any(), c0)',
            ])
        assertEq(
            printed(['||', true, ['[]', [['-', 1]]]]),
            'Any::logical_or(true.to_any(), || {\n    let c0: Any<A> = (-(f64_any(0x3ff0000000000000)))?;\n    Ok([c0].to_array().to_any())\n})')
        // Both arms of `?:`, and a nested lazy operation in an arm, which
        // is a thunk inside a thunk — in a scope, a thunk temporary inside
        // another's block; a lazy operation as the eager first operand is
        // composed like any operator there, bare, and a temporary in a
        // scope. A thunk over an atom stands where its operation is.
        assertStructurallySame(
            scoped(['?:', true, 1, ['/', 1n, 0n]]),
            [
                'let c0 = || bigint_any(1) / bigint_any(0);',
                'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c0)',
            ])
        assertEq(
            printed(['?:', ['&&', true, false], ['||', false, 1], 2]),
            'Any::conditional((Any::logical_and(true.to_any(), || Ok(false.to_any()))), || Any::logical_or(false.to_any(), || Ok(f64_any(0x3ff0000000000000))), || Ok(f64_any(0x4000000000000000)))')
        assertStructurallySame(
            scoped(['?:', ['&&', true, false], ['||', false, ['[]', [['-', 1]]]], 2]),
            [
                'let c0: Any<A> = (Any::logical_and(true.to_any(), || Ok(false.to_any())))?;',
                'let c1 = || {',
                '    let c2 = || {',
                '        let c3: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                '        Ok([c3].to_array().to_any())',
                '    };',
                '    Any::logical_or(false.to_any(), c2)',
                '};',
                'Any::conditional(c0, c1, || Ok(f64_any(0x4000000000000000)))',
            ])
        // The first operand is eager, and composed where its rendering
        // would otherwise re-associate — exactly as an eager operator's.
        assertEq(
            printed(['&&', ['*', 1, 2], 3]),
            'Any::logical_and((f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)), || Ok(f64_any(0x4008000000000000)))')
        assertStructurallySame(
            scoped(['&&', ['*', 1, 2], 3]),
            [
                'let c0: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;',
                'Any::logical_and(c0, || Ok(f64_any(0x4008000000000000)))',
            ])
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
            'Any::dot([(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any(), string_any("a")).end()')
        // Atomic as an operand: the call binds tighter than any infix
        // operator, so no parentheses are needed around it.
        assertEq(
            printed(['-', ['.', ['{}', []], 'b']]),
            '-(Any::dot(Object::default().to_any(), string_any("b")).end())')
    },
    /**
     * `Any::dot` reads an array, a string, a boolean, a number, and
     * a bigint receiver correctly — unlike `Any::own_property`, which only
     * inspects a plain object — so a base this printer can prove is one of
     * these prints the call rather than refusing it: `[1].length`, `"ab"[0]`,
     * `true.x` (`undefined`, since a boolean has no own properties at all)
     * are accepted DJS, per `fjs/fsc/README.md`.
     */
    dotOnNonObjectLiteral: () => {
        assertEq(
            printed(['.', ['[]', [1]], 'length']),
            'Any::dot([f64_any(0x3ff0000000000000)].to_array().to_any(), string_any("length")).end()')
        assertEq(
            printed(['.', 'ab', '0']),
            'Any::dot(string_any("ab"), string_any("0")).end()')
        assertEq(
            printed(['.', true, 'x']),
            'Any::dot(true.to_any(), string_any("x")).end()')
        assertEq(
            printed(['.', 5, 'x']),
            'Any::dot(f64_any(0x4014000000000000), string_any("x")).end()')
        assertEq(
            printed(['.', 5n, 'x']),
            'Any::dot(bigint_any(5), string_any("x")).end()')
    },
    /** A literal `number` index prints the same way a numeric primitive does elsewhere in this file. */
    numericIndex: () => {
        assertEq(
            printed(['.', ['{}', []], 0]),
            'Any::dot(Object::default().to_any(), f64_any(0x0000000000000000)).end()')
    },
    /**
     * A read on a nullish base prints as any read does: what it answers is
     * the VM's, a throw when the module runs, as JavaScript throws — the
     * `.rs` output writes a program and predicts nothing of it, where the
     * data outputs evaluate the module and report the throw as theirs.
     */
    nullishBase: () => {
        assertEq(printed(['.', null, 'a']), 'Any::dot(Nullish::Null.to_any(), string_any("a")).end()')
        assertEq(
            printed(['.', ['.', ['{}', []], 'missing'], 'x']),
            'Any::dot(Any::dot(Object::default().to_any(), string_any("missing")).end(), string_any("x")).end()')
        // A function's `length` is a number, and a read on a number is
        // `undefined`: `f.length.x` prints, as the VM answers it.
        assertEq(
            printed(['.', ['.', ['=>', 0, null, 1], 'length'], 'x']),
            'Any::dot(Any::dot(A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default()).to_any(), string_any("length")).end(), string_any("x")).end()')
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
        // A bound operation is its name as an operand too, atomic as
        // written, where the operation would be composed.
        assertEq(printedWith([[op, 'y.clone()']])(['-', op]), '-(y.clone())')
        assertEq(printed(['-', op]), '-((f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)))')
        // A node inside a lazy operand is a temporary of the thunk's block
        // in the bare mode too, over the bindings around it.
        assertEq(
            printedWith(shared)(['??', null, ['[]', [base, ['-', base]]]]),
            'Any::nullish_coalescing(Nullish::Null.to_any(), || {\n    let c0: Any<A> = (-(x.clone()))?;\n    Ok([x.clone(), c0].to_array().to_any())\n})')
        // A node reached eagerly and lazily prints where it stands in the
        // bare mode, in the thunk too — a comma as its block expression.
        /** @type {Exp} */
        const comma = [',', [1, 2]]
        assertEq(
            printed(['[]', [comma, ['&&', true, comma]]]),
            '[{ let _: Any<A> = f64_any(0x3ff0000000000000); f64_any(0x4000000000000000) }, Any::logical_and(true.to_any(), || Ok({ let _: Any<A> = f64_any(0x3ff0000000000000); f64_any(0x4000000000000000) }))].to_array().to_any()')
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
        /**
         * A function's body is a scope of its own: nothing inside it is
         * shared at the scope around it — `scope` walks the body afresh
         * — while its frame is that scope's.
         */
        stopsAtAFunctionBody: () => {
            /** @type {Exp} */
            const x = ['[]', []]
            assertEq(sharedNodesOf(['=>', 0, null, ['[]', [x, x]]]).length, 0)
            const found = sharedNodesOf(['[]', [['=>', 0, x, 1], x]])
            assertEq(found.length, 1)
            assert(found[0] === x, found)
        },
    },
    /**
     * The lines of one scope: a `let` per temporary — every node with
     * operands, one line, one expression — then the root as the `Result`
     * the scope's function answers — an operation's own, `Ok(…)` of any
     * other value — or the refusal of a shared node the root reaches only
     * through lazy operands.
     */
    scope: {
        /** A shared atom is a temporary, cloned at each reference. */
        statements: () => {
            /** @type {Exp} */
            const x = ['[]', []]
            assertStructurallySame(scoped(['[]', [x, x]]), [
                'let c0: Any<A> = Array::default().to_any();',
                'Ok([c0.clone(), c0.clone()].to_array().to_any())',
            ])
        },
        operationRoot: () => {
            assertStructurallySame(
                scoped(['.', ['{}', []], 'a']),
                ['Any::dot(Object::default().to_any(), string_any("a")).end()'])
        },
        /**
         * Every node with operands is a temporary in dependency order,
         * referenced by name — moved, each being referenced once — and an
         * atom referenced once is written where it stands: a primitive,
         * `undefined`, an empty container.
         */
        temporaries: () => {
            assertStructurallySame(
                scoped(['[]', [['*', 1, 2], ['{}', [[':', 'k', ['[]', [1]]]]], ['[]', []], ['undefined'], null]]),
                [
                    'let c0: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;',
                    'let c1: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                    'let c2: Any<A> = [(string_key("k"), c1)].to_object().to_any();',
                    'Ok([c0, c2, Array::default().to_any(), Nullish::Undefined.to_any(), Nullish::Null.to_any()].to_array().to_any())',
                ])
        },
        /**
         * An operation's `let` follows its call with `?`, so the temporary
         * is an `Any<A>` with its throw handed to the enclosing function:
         * an operator's text parenthesized before the `?`, a `.` read's
         * call and a call followed by it as they are. The root, an
         * operation, answers its own `Result`, its operands by name.
         */
        operations: () => {
            assertStructurallySame(scoped(['*', 1, 2]), ['f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)'])
            assertStructurallySame(scoped(['*', 1, ['*', 2, 3]]), [
                'let c0: Any<A> = (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))?;',
                'f64_any(0x3ff0000000000000) * c0',
            ])
            assertStructurallySame(scoped(['-', ['undefined']]), ['-(Nullish::Undefined.to_any())'])
            assertStructurallySame(scoped(['.', ['.', ['{}', [[':', 'a', ['{}', []]]]], 'a'], 'b']), [
                'let c0: Any<A> = [(string_key("a"), Object::default().to_any())].to_object().to_any();',
                'let c1: Any<A> = Any::dot(c0, string_any("a")).end()?;',
                'Any::dot(c1, string_any("b")).end()',
            ])
            assertStructurallySame(scoped(['[]', [['()', ['args'], ['[]', [1]]]]]), [
                'let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                'let c1: Any<A> = Any::call(args.clone().to_any(), c0)?;',
                'Ok([c1].to_array().to_any())',
            ])
            // A literal root is `Ok` of the literal.
            assertStructurallySame(scoped(1), ['Ok(f64_any(0x3ff0000000000000))'])
        },
        /**
         * A comma root answers by its last operand: the operands before it
         * are established for what they anchor, each a temporary named
         * `_`, nothing referencing it — and an atom among them, which no
         * establishment can fail, is not written at all. The last operand
         * is the scope's own answer, an operation's `Result` included.
         */
        commaRoot: () => {
            assertStructurallySame(scoped([',', [['-', 1], ['[]', []], 2]]), [
                'let _: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                'Ok(f64_any(0x4000000000000000))',
            ])
            assertStructurallySame(scoped([',', [['-', 1], ['*', 2, 3]]]), [
                'let _: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                'f64_any(0x4000000000000000) * f64_any(0x4008000000000000)',
            ])
            // A last operand shared with a discarded one is a temporary,
            // and the comma answers its name.
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped([',', [['[]', [c]], c]]), [
                'let c0: Any<A> = Array::default().to_any();',
                'let _: Any<A> = [c0.clone()].to_array().to_any();',
                'Ok(c0.clone())',
            ])
        },
        /**
         * A comma below the root — no lowering puts one there, `resolve`
         * anchoring at the root alone — is a temporary holding its last
         * operand's name, its discarded operands `_` temporaries before
         * it.
         */
        commaTemporary: () => {
            assertStructurallySame(scoped(['.', [',', [['-', 1], ['{}', [[':', 'a', 1]]]]], 'a']), [
                'let _: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                'let c0: Any<A> = [(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any();',
                'let c1: Any<A> = c0;',
                'Any::dot(c1, string_any("a")).end()',
            ])
        },
        refusedSharedOnlyThroughLazyOperands: () => {
            /** @type {Exp} */
            const c = ['[]', [1]]
            const result = scope(['?:', true, 1, ['[]', [c, c]]])
            assert(result[0] === 'error', result)
        },
        /**
         * A shared atom reached only through lazy operands is not refused:
         * binding it establishes nothing the program could skip, so the
         * scope's block binds it before the root and every thunk clones
         * it — `args`, the closure's parameter, which `(...a) => true ? a
         * : a` reaches twice and only lazily, and an empty container the
         * same. An atom that is itself the lazy operand is a thunk
         * answering it, shared as the thunk where both positions take it.
         * Sharing is by identity, as the lowering spells it — one `args`
         * node per scope — so the one node stands in both positions here.
         */
        sharedAtomOnlyThroughLazyOperands: () => {
            /** @type {Exp} */
            const args = ['args']
            assertStructurallySame(scoped(['?:', true, args, args]), [
                'let c0 = || Ok(args.clone().to_any());',
                'Any::conditional(true.to_any(), c0, c0)',
            ])
            assertStructurallySame(scoped(['?:', true, ['[]', [args]], ['[]', [args]]]), [
                'let c0: Any<A> = args.clone().to_any();',
                'let c1 = || Ok([c0.clone()].to_array().to_any());',
                'let c2 = || Ok([c0.clone()].to_array().to_any());',
                'Any::conditional(true.to_any(), c1, c2)',
            ])
            assertStructurallySame(scoped(['||', ['&&', true, args], args]), [
                'let c0 = || Ok(args.clone().to_any());',
                'let c1: Any<A> = (Any::logical_and(true.to_any(), c0))?;',
                'Any::logical_or(c1, c0)',
            ])
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['?:', true, 1, ['[]', [c, c]]]), [
                'let c0: Any<A> = Array::default().to_any();',
                'let c1 = || Ok([c0.clone(), c0.clone()].to_array().to_any());',
                'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c1)',
            ])
        },
        /**
         * A lazy operation reached eagerly and lazily — `const x = 1n ||
         * (1n / 0n)`, anchored and then `true && x` — is a temporary of the
         * scope, and so is the thunk over its own lazy operand, made where
         * `x` is; the thunk over `x` answers the name and binds nothing,
         * since a closure nothing uses is one `rustc` cannot type.
         */
        sharedLazyOperation: () => {
            /** @type {Exp} */
            const x = ['||', 1n, ['/', 1n, 0n]]
            assertStructurallySame(scoped([',', [x, ['&&', true, x]]]), [
                'let c0 = || bigint_any(1) / bigint_any(0);',
                'let c1: Any<A> = (Any::logical_or(bigint_any(1), c0))?;',
                'Any::logical_and(true.to_any(), || Ok(c1))',
            ])
        },
        /** `Exps` admits an empty list in the schema; the Rust backend has no value for it, wherever it stands. */
        refusedEmptyComma: () => {
            assertStructurallySame(scope([',', []]), ['error', ['no Rust for an empty comma', [',', []]]])
            assertEq(scope(['[]', [[',', []]]])[0], 'error')
        },
    },
    /**
     * Functions: a `=>` node — the corpus's `() => undefined` aside — is a
     * closure bound through `IStaticFunction`, its body a scope of its
     * own; `['args']` is the closure's parameter as a value; a call is
     * `Any::call` over two values, an operation in either mode.
     */
    functions: {
        args: () => {
            assertEq(printed(['args']), 'args.clone().to_any()')
        },
        call: () => {
            /** @type {Exp} */
            const e = ['()', ['args'], ['[]', [1]]]
            assertEq(printed(e), 'Any::call(args.clone().to_any(), [f64_any(0x3ff0000000000000)].to_array().to_any())')
            assertStructurallySame(scoped(e), [
                'let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                'Any::call(args.clone().to_any(), c0)',
            ])
        },
        /**
         * A body that reads its arguments names the parameter; one that
         * never does leaves it `_args`, unused.
         */
        closure: () => {
            assertEq(
                printed(['=>', 0, null, ['args']]),
                'A::static_function(|_self, args| { Ok(args.clone().to_any()) }, 0, Array::default()).to_any()')
            assertEq(
                printed(['=>', 0, null, 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default()).to_any()')
        },
        /**
         * The count is the `length` a `static_function` is given, its
         * second argument, whatever the body reads: named parameters are
         * positions of `args`, read as any position is.
         */
        count: () => {
            assertEq(
                printed(['=>', 2, null, ['.', ['args'], 1]]),
                'A::static_function(|_self, args| { Any::dot(args.clone().to_any(), f64_any(0x3ff0000000000000)).end() }, 2, Array::default()).to_any()')
            assertEq(
                printed(['=>', 3, null, 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 3, Array::default()).to_any()')
            // `() => undefined` with a count is not the corpus's lambda
            assertEq(
                printed(['=>', 1, ['[]', []], ['undefined']]),
                'A::static_function(|_self, _args| { Ok(Nullish::Undefined.to_any()) }, 1, Array::default()).to_any()')
        },
        /** A nested function's `args` are its own: the outer body reads none. */
        nested: () => {
            assertEq(
                printed(['=>', 0, null, ['=>', 0, null, ['args']]]),
                'A::static_function(|_self, _args| { Ok(A::static_function(|_self, args| { Ok(args.clone().to_any()) }, 0, Array::default()).to_any()) }, 0, Array::default()).to_any()')
        },
        /** A body whose root is an operation answers that operation's own `Result`, as a thunk does. */
        operationBody: () => {
            assertEq(
                printed(['=>', 0, null, ['.', ['args'], 0]]),
                'A::static_function(|_self, args| { Any::dot(args.clone().to_any(), f64_any(0x0000000000000000)).end() }, 0, Array::default()).to_any()')
        },
        /**
         * A body's temporaries are the body's own: bound in the closure,
         * numbered from `c0`, its block one line under another — a shared
         * read cloned at each reference, two reads each moved.
         */
        sharingInside: () => {
            /** @type {Exp} */
            const first = ['.', ['args'], 0]
            assertEq(
                printed(['=>', 0, null, ['[]', [first, first]]]),
                'A::static_function(|_self, args| {\n    let c0: Any<A> = Any::dot(args.clone().to_any(), f64_any(0x0000000000000000)).end()?;\n    Ok([c0.clone(), c0.clone()].to_array().to_any())\n}, 0, Array::default()).to_any()')
            assertStructurallySame(
                scoped(['=>', 0, null, ['[]', [['.', ['args'], 0], ['.', ['args'], 1]]]]),
                [
                    'Ok(A::static_function(|_self, args| {',
                    '    let c0: Any<A> = Any::dot(args.clone().to_any(), f64_any(0x0000000000000000)).end()?;',
                    '    let c1: Any<A> = Any::dot(args.clone().to_any(), f64_any(0x3ff0000000000000)).end()?;',
                    '    Ok([c0, c1].to_array().to_any())',
                    '}, 0, Array::default()).to_any())',
                ])
        },
        /**
         * A frame is the third argument of `A::static_function`: its items
         * values of the scope around the function, collected as the
         * `Array<A>` it takes — an empty one `Array::default()`, as `null`
         * is — and `['frame']` in the body is that array, read through
         * `self_`, which the closure then names.
         */
        frame: () => {
            assertEq(
                printed(['=>', 0, ['[]', [1]], ['.', ['frame'], 0]]),
                'A::static_function(|self_, _args| { Any::dot(A::frame(self_).clone().to_any(), f64_any(0x0000000000000000)).end() }, 0, [f64_any(0x3ff0000000000000)].to_array()).to_any()')
            assertEq(
                printed(['=>', 0, ['[]', []], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default()).to_any()')
            // A frame's items are the scope's temporaries, moved where the
            // frame is their only reference and cloned where it is not.
            /** @type {Exp} */
            const read = ['.', ['{}', []], 'a']
            assertStructurallySame(
                scoped(['[]', [['=>', 0, ['[]', [read]], ['frame']], read]]),
                [
                    'let c0: Any<A> = Any::dot(Object::default().to_any(), string_any("a")).end()?;',
                    'let c1: Any<A> = A::static_function(|self_, _args| { Ok(A::frame(self_).clone().to_any()) }, 0, [c0.clone()].to_array()).to_any();',
                    'Ok([c1, c0.clone()].to_array().to_any())',
                ])
        },
        /**
         * A nested function captures through its parent: the inner frame
         * is built in the outer body, from the outer frame's slot, and each
         * body reads its own frame alone.
         */
        nestedFrame: () => {
            assertEq(
                printed(['=>', 0, ['[]', [['[]', []]]], ['=>', 0, ['[]', [['.', ['frame'], 0]]], ['.', ['frame'], 0]]]),
                'A::static_function(|self_, _args| {\n'
                + '    let c0: Any<A> = Any::dot(A::frame(self_).clone().to_any(), f64_any(0x0000000000000000)).end()?;\n'
                + '    Ok(A::static_function(|self_, _args| { Any::dot(A::frame(self_).clone().to_any(), f64_any(0x0000000000000000)).end() }, 0, [c0].to_array()).to_any())\n'
                + '}, 0, [Array::default().to_any()].to_array()).to_any()')
        },
        /**
         * A frame that is no array literal is an `Any<A>` known to be an
         * array only when the module runs, and one reached from anywhere
         * but its function would be built twice: both refused.
         */
        otherFrame: () => {
            assertEq(refusalReason(['=>', 0, ['undefined'], 1])[0], 'no Rust for a frame that is not an array literal')
            assertEq(refusalReason(['=>', 0, 1, 1])[0], 'no Rust for a frame that is not an array literal')
            /** @type {Exp} */
            const frame = ['[]', [1]]
            assertEq(refusalReason(['[]', [['=>', 0, frame, 1], frame]])[0], 'no Rust for a frame reached from anywhere but its function')
        },
        /**
         * A function anywhere — an item, a call's callee, a body inside
         * another function, one with a frame — is held; the corpus's own
         * lambda binds nothing, and a primitive holds nothing.
         */
        holdsFunction: () => {
            assertEq(holdsFunction(['=>', 0, null, 1]), true)
            assertEq(holdsFunction(['=>', 0, ['[]', [1]], 1]), true)
            assertEq(holdsFunction(['=>', 0, ['[]', []], ['args']]), true)
            assertEq(holdsFunction(['[]', [1, ['=>', 0, null, 1]]]), true)
            assertEq(holdsFunction(['()', ['=>', 0, null, ['args']], ['[]', []]]), true)
            assertEq(holdsFunction(['=>', 0, ['[]', []], ['=>', 0, null, 1]]), true)
            assertEq(holdsFunction(['=>', 0, ['[]', []], ['undefined']]), false)
            assertEq(holdsFunction(['=>', 1, ['[]', []], ['undefined']]), true)
            assertEq(holdsFunction(['[]', [1, 'static_function(']]), false)
            assertEq(holdsFunction(1), false)
        },
        /**
         * Every question asked of a graph walks it once per distinct node:
         * a sharing chain forty levels deep, each level reaching the one
         * before it twice, is answered as fast as its forty nodes and not
         * as the trillion paths through them.
         */
        walksSharedNodesOnce: () => {
            /** @type {(depth: number, node: Exp) => Exp} */
            const chain = (depth, node) => depth === 0 ? node : chain(depth - 1, ['[]', [node, node]])
            const deep = chain(40, ['[]', []])
            assertEq(readsArgs(deep), false)
            assertEq(readsArgs(chain(40, ['args'])), true)
            assertEq(readsFrame(deep), false)
            assertEq(readsFrame(chain(40, ['frame'])), true)
            assertEq(holdsFunction(deep), false)
            assertEq(holdsFunction(chain(40, ['=>', 0, null, 1])), true)
            assertEq(sharedNodesOf(deep).length, 40)
        },
    },
    /**
     * A literal the target type cannot hold — a string with a lone
     * surrogate, a bigint outside `i64` — is refused where it is printed,
     * with the reason this printer gives it, wherever a string literal
     * stands: a primitive, an object key, an index.
     */
    /**
     * The nodes a root establishes unconditionally: through every eager
     * position, and a lazy operation's first operand, never its others —
     * however a node is also reached lazily.
     */
    eagerNodesOf: () => {
        /** @type {Exp} */
        const c = ['[]', []]
        // Through an array item, an object value, a comma operand, an eager
        // operator's operands, a `.` base, and a lazy operation's first
        // operand.
        assertEq(eagerNodesOf(['[]', [c]]).includes(c), true)
        assertEq(eagerNodesOf(['{}', [[':', 'k', c]]]).includes(c), true)
        assertEq(eagerNodesOf([',', [c, 1]]).includes(c), true)
        assertEq(eagerNodesOf(['*', 1, c]).includes(c), true)
        assertEq(eagerNodesOf(['.', c, 'length']).includes(c), true)
        assertEq(eagerNodesOf(['&&', c, 1]).includes(c), true)
        assertEq(eagerNodesOf(['?:', c, 1, 2]).includes(c), true)
        // Not through a function's body, established only when it is called.
        assertEq(eagerNodesOf(['=>', 0, null, ['[]', [c]]]).includes(c), false)
        // Not through a lazy operand, at any depth below it.
        assertEq(eagerNodesOf(['&&', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['||', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['??', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['?:', true, c, 2]).includes(c), false)
        assertEq(eagerNodesOf(['?:', true, 1, ['[]', [c, c]]]).includes(c), false)
        // One eager reach is enough, wherever the lazy ones are.
        assertEq(eagerNodesOf(['[]', [['&&', true, c], c]]).includes(c), true)
        // A list whose first item spells a lazy tag is a list: both `c`s
        // are items, reached.
        assertEq(eagerNodesOf(['[]', ['&&', c, ['&&', true, c]]]).includes(c), true)
        // The root comes first, and a primitive root reaches nothing.
        assertStructurallySame(eagerNodesOf(c), [c])
        assertStructurallySame(eagerNodesOf(1), [])
    },
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
        /** A frame that is no array literal. */
        lambdaFrameNotArray: () => printed(['=>', 0, ['undefined'], ['undefined']]),
        /** An object key the printer cannot spell. */
        computedKey: () => printed(['{}', [[':', ['undefined'], 1]]]),
        /**
         * A `Number(...)` cast index: it names a run-time coercion, not a
         * literal key `indexExpr` can spell directly, and this printer has no
         * `Number(...)` cast primitive to route it through.
         */
        numberCastIndex: () => printed(['.', ['{}', []], ['Number', 1]]),
        /**
         * A `Number(...)` cast key one step into a chain refuses as
         * `numberCastIndex` above does, from `indexExpr`, when the inner
         * node is printed.
         */
        dotOnArrayWithNumberCastKey: () => printed(['.', ['.', ['[]', []], ['Number', 1]], 'x']),
        dotOnStringWithNumberCastKey: () => printed(['.', ['.', 'ab', ['Number', 1]], 'x']),
        /** `Exps` admits an empty list in the schema; the Rust backend has no value for it. */
        emptyComma: () => printed([',', []]),
    },
    /**
     * Chains (`fjs/edag/README.md`, Chains). A `.` node is `Any::dot(a, key)`
     * and its exit — `.end()` with no continuation, the one spelling of
     * `a.b` — and `?.` and `?.()` open a region, `Any::option_dot` and
     * `Any::option_call`, their key or arguments a thunk since a nullish
     * first operand skips them. Each step is the method the README's table
     * names for the state the chain is in, and a terminal step is
     * `.end_call(…)`: one expression, however long the chain.
     */
    chains: {
        /** `a.b(...c)`: `|()` with a receiver alone live is terminal. */
        methodCall: () => {
            assertEq(
                printed(['.', ['{}', []], 'b', ['|()', ['[]', []]]]),
                'Any::dot(Object::default().to_any(), string_any("b")).end_call(|| Ok(Array::default().to_any()))')
        },
        /** `a.b?.(...c)`: `|?.()` opens a region the chain goes on inside, and `.end()` closes. */
        propertyOptionCall: () => {
            assertEq(
                printed(['.', ['{}', []], 'b', ['|?.()', ['[]', []]]]),
                'Any::dot(Object::default().to_any(), string_any("b")).option_call(|| Ok(Array::default().to_any())).end()')
        },
        /**
         * `a?.b`, `a?.[0]`, `a?.b.c`, `a?.b(...c)`, `a?.b?.(...c)` and
         * `(a?.b)(...c)`: every step `optionPropertyLambda` admits, the
         * key a thunk over its literal.
         */
        optionDot: () => {
            const open = 'Any::option_dot(Object::default().to_any(), || Ok(string_any("b")))'
            const args = '|| Ok(Array::default().to_any())'
            assertEq(printed(['?.', ['{}', []], 'b']), `${open}.end()`)
            assertEq(
                printed(['?.', ['{}', []], 0]),
                'Any::option_dot(Object::default().to_any(), || Ok(f64_any(0x0000000000000000))).end()')
            assertEq(printed(['?.', ['{}', []], 'b', ['|.', 'c']]), `${open}.dot(|| Ok(string_any("c"))).end()`)
            assertEq(printed(['?.', ['{}', []], 'b', ['|()', ['[]', []]]]), `${open}.call(${args}).end()`)
            assertEq(printed(['?.', ['{}', []], 'b', ['|?.()', ['[]', []]]]), `${open}.option_call(${args}).end()`)
            assertEq(printed(['?.', ['{}', []], 'b', ['|!()', ['[]', []]]]), `${open}.end_call(${args})`)
        },
        /**
         * `a?.(...c)`, `a?.(...c).d`, `a?.(...c)(...d)`, and the README's
         * `a?.b(...c).d(...e)`: the steps `optionLambda` admits, and a
         * chain through three states.
         */
        optionCall: () => {
            const open = 'Any::option_call(Nullish::Undefined.to_any(), || Ok(Array::default().to_any()))'
            const args = '|| Ok(Array::default().to_any())'
            assertEq(printed(['?.()', ['undefined'], ['[]', []]]), `${open}.end()`)
            assertEq(printed(['?.()', ['undefined'], ['[]', []], ['|.', 'd']]), `${open}.dot(|| Ok(string_any("d"))).end()`)
            assertEq(printed(['?.()', ['undefined'], ['[]', []], ['|()', ['[]', []]]]), `${open}.call(${args}).end()`)
            assertEq(
                printed(['?.', ['{}', []], 'b', ['|()', ['[]', []], ['|.', 'd', ['|()', ['[]', []]]]]]),
                `Any::option_dot(Object::default().to_any(), || Ok(string_any("b"))).call(${args}).dot(|| Ok(string_any("d"))).call(${args}).end()`)
        },
        /** Atomic as an operand: a method chain binds tighter than any infix operator. */
        operand: () => {
            assertEq(
                printed(['-', ['?.', ['{}', []], 'b']]),
                '-(Any::option_dot(Object::default().to_any(), || Ok(string_any("b"))).end())')
        },
        /** A `.` node with a continuation as a base: the outer read prints over the chain's own text. */
        opaqueBase: () => {
            assertEq(
                printed(['.', ['.', ['{}', []], 'y', ['|()', ['[]', []]]], 'z']),
                'Any::dot(Any::dot(Object::default().to_any(), string_any("y")).end_call(|| Ok(Array::default().to_any())), string_any("z")).end()')
        },
        /**
         * A nullish base: `?.` and `?.()` guard it, `undefined` at run
         * time; a `.` with a continuation on one prints as a bare `.` does,
         * and throws when the module runs.
         */
        nullishBase: () => {
            assertEq(
                printed(['?.', null, 'a']),
                'Any::option_dot(Nullish::Null.to_any(), || Ok(string_any("a"))).end()')
            assertEq(
                printed(['?.()', ['undefined'], ['[]', []]]),
                'Any::option_call(Nullish::Undefined.to_any(), || Ok(Array::default().to_any())).end()')
            assertEq(
                printed(['.', null, 'a', ['|()', ['[]', []]]]),
                'Any::dot(Nullish::Null.to_any(), string_any("a")).end_call(|| Ok(Array::default().to_any()))')
        },
        /**
         * Arguments are a lazy position: an operation inside them is the
         * thunk's own, bound inside the closure in either mode — a
         * continuation's, a `?.()` node's, and a nested step's alike — so
         * nothing the chain may skip is established before it.
         */
        lazyArguments: () => {
            const thunk = [
                '|| {',
                '    let c0: Any<A> = (bigint_any(1) / bigint_any(0))?;',
                '    Ok([c0].to_array().to_any())',
                '}',
            ].join('\n')
            assertEq(
                printed(['.', ['{}', []], 'b', ['|()', ['[]', [['/', 1n, 0n]]]]]),
                `Any::dot(Object::default().to_any(), string_any("b")).end_call(${thunk})`)
            assertStructurallySame(
                scoped(['.', ['{}', []], 'b', ['|()', ['[]', [['/', 1n, 0n]]]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (bigint_any(1) / bigint_any(0))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::dot(Object::default().to_any(), string_any("b")).end_call(c0)',
                ])
            assertStructurallySame(
                scoped(['?.()', ['undefined'], ['[]', [['-', 1]]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::option_call(Nullish::Undefined.to_any(), c0).end()',
                ])
            assertStructurallySame(
                scoped(['?.', ['{}', []], 'b', ['|.', 'c', ['|()', ['[]', [['-', 1]]]]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::option_dot(Object::default().to_any(), || Ok(string_any("b"))).dot(|| Ok(string_any("c"))).call(c0).end()',
                ])
        },
        /** In a scope a chain temporary follows its `let` with `?` as it is, a method chain needing no parentheses. */
        temporary: () => {
            assertStructurallySame(
                scoped(['[]', [['?.', ['{}', []], 'a']]]),
                [
                    'let c0: Any<A> = Any::option_dot(Object::default().to_any(), || Ok(string_any("a"))).end()?;',
                    'Ok([c0].to_array().to_any())',
                ])
        },
        /**
         * A node shared but reached only through a chain's lazy positions
         * has no block that may bind it — the same refusal a node reached
         * only through lazy operands gets, an atom excepted as there —
         * where one reached eagerly as well is a temporary of the scope,
         * and the thunk answers its name.
         */
        sharing: () => {
            /** @type {Exp} */
            const one = ['[]', [1]]
            const result = scope(['?.()', ['undefined'], ['[]', [one, one]]])
            assert(result[0] === 'error', result)
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['?.()', ['undefined'], ['[]', [c, c]]]), [
                'let c0: Any<A> = Array::default().to_any();',
                'let c1 = || Ok([c0.clone(), c0.clone()].to_array().to_any());',
                'Any::option_call(Nullish::Undefined.to_any(), c1).end()',
            ])
            assertStructurallySame(
                scoped(['[]', [c, ['?.()', ['undefined'], c]]]),
                [
                    'let c0: Any<A> = Array::default().to_any();',
                    'let c1: Any<A> = Any::option_call(Nullish::Undefined.to_any(), || Ok(c0.clone())).end()?;',
                    'Ok([c0.clone(), c1].to_array().to_any())',
                ])
        },
        /**
         * The eager positions per tag: a `.` node's receiver and key, a
         * `?.` or `?.()` node's first operand; nothing inside a
         * continuation, at any depth, nor a `?.()` node's arguments.
         */
        eagerNodesOf: () => {
            /** @type {Exp} */
            const c = ['[]', []]
            assertEq(eagerNodesOf(['.', c, 'a', ['|()', ['[]', []]]]).includes(c), true)
            assertEq(eagerNodesOf(['?.', c, 'a']).includes(c), true)
            assertEq(eagerNodesOf(['?.()', c, ['[]', []]]).includes(c), true)
            assertEq(eagerNodesOf(['.', ['{}', []], 'a', ['|()', c]]).includes(c), false)
            assertEq(eagerNodesOf(['?.()', ['undefined'], c]).includes(c), false)
            assertEq(eagerNodesOf(['?.', ['{}', []], 'a', ['|.', 'b', ['|()', c]]]).includes(c), false)
            // A continuation is not a node: the walk lists what it holds
            // and never the tuple itself.
            /** @type {PropertyLambda} */
            const k = ['|()', c]
            assertEq(sharedNodesOf(['[]', [['.', ['{}', []], 'a', k], ['.', ['{}', []], 'b', k]]]).includes(c), true)
        },
        /**
         * A terminal step handed a continuation: the schema spells none,
         * and the printer refuses rather than dropping it.
         */
        refusedTerminalWithContinuation: () => {
            /** @type {readonly unknown[]} */
            const k = ['|()', ['[]', []], ['|.', 'c']]
            assertStructurallySame(
                refusalReason(/** @type {Exp} */ (/** @type {unknown} */ (['.', ['{}', []], 'b', k]))),
                ['a terminal step with a continuation', k])
        },
        /**
         * A continuation tag that is none of the four steps: the schema
         * spells none, and the printer refuses it rather than read it as
         * the step it resembles.
         */
        refusedUnknownStep: () => {
            /** @type {readonly unknown[]} */
            const k = ['bogus', ['[]', []]]
            assertStructurallySame(
                refusalReason(/** @type {Exp} */ (/** @type {unknown} */ (['?.', ['{}', []], 'f', k]))),
                ['no Rust for a chain step', k])
        },
        /** A `Number(...)` cast key inside a region is refused as it is outside one. */
        refusedNumberCastKey: () => {
            assertStructurallySame(
                refusalReason(['?.', ['{}', []], ['Number', 1]]),
                ['no Rust for a Number(...) cast index', ['Number', 1]])
        },
    },
    /**
     * Refusals met one step into a chain, each the inner node's own — a
     * spread the printer cannot spell, a `Number(...)` cast key — surfacing
     * with the inner node's reason when it is printed, and never a reason
     * about the base's value, which the printer does not predict.
     */
    chainRefusals: {
        /** The spread is refused where the object is printed, the same one `objectSpread` (`fjs/nanvm/rust/proof.f.mjs`) pins. */
        dotOnObjectWithSpread: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['{}', [['...', 'x']]], 'y'], 'z']),
                ['not a property', ['...', 'x']])
        },
        /** A spread in an array item list has no spelling, wherever the array stands. */
        dotOnArrayWithSpread: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['[]', [['...', 'x'], 1]], 0], 'y']),
                ['no Rust for', '...'])
        },
        /** The cast key is `indexExpr`'s refusal, the same one `numberCastIndex` pins directly. */
        dotOnObjectWithNumberCastKey: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['{}', []], ['Number', 1]], 'x']),
                ['no Rust for a Number(...) cast index', ['Number', 1]])
        },
    },
}
