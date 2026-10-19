/**
 * Proofs for the shared EDAG→Rust printer.
 *
 * `nodeExpr`/`expExpr` return a `Result` rather than throwing (see the
 * module's own doc comment for why), so every case here reads it through
 * {@link printed}/{@link printedWith}, which `unwrap` back to a throwing
 * convenience — the ordinary FunctionalScript panic `fjs/AGENTS.md` §1.5
 * describes, exactly what the `throw` cases below need.
 *
 * @import { Exp, Property, Spread } from '../types.ts'
 * @import { Printed, Uses } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.js'
import { braced, eagerNodesOf, expExpr, expExprTagged, holdsFunction, needsRuntime, nestsOperation, nodeExpr, readsArgs, readsFrame, scope, scopeTagged, statementsOf, useLines, useLinesTagged, helperExpr } from './module.f.mjs'
import { fromTagged, toText, untagged } from '../../text/marked/module.f.mjs'
import { unmarkedWords } from './unmarked/module.f.js'

/** A node as a value in a scope whose runtime value is `runtime`, a compiled module's. @type {(e: Exp) => string} */
const printed = e => {
    complete(unwrap(expExprTagged([], 'runtime')(e)))
    return unwrap(expExpr([], 'runtime')(e))
}

/** A node as a value in a scope with no runtime, the runtime module's own. @type {(e: Exp) => Result<string, readonly unknown[]>} */
const printedWithout = e => nodeExpr(e)

/**
 * That the printer marked every word it marks: the tagged text has no plain
 * keyword, `true`, `false` or number left. A missing mark changes no text,
 * so no comparison of the text sees it; this is what does, for every case
 * the helpers below print.
 *
 * @type {(tagged: string) => void}
 */
const complete = tagged => assertEq(JSON.stringify(unmarkedWords(unwrap(fromTagged(tagged)))), '[]', tagged)

/** The lines of a scope over `e`: what a compiled module's body holds. @type {(e: Exp) => readonly string[]} */
const scoped = e => {
    complete(unwrap(scopeTagged(e, undefined, 'runtime')).lines.join('\n'))
    return unwrap(scope(e, 'runtime')).lines
}

/** The names a scope over `e` spells. @type {(e: Exp) => Uses} */
const usedBy = e => unwrap(scope(e, 'runtime')).uses

/** `self(NEXT)`. @type {(next: Exp) => Exp} */
const call = next => ['()', ['self'], [next]]

/** `r => COND ? STEP : r`. @type {(condition: Exp, step: Exp) => Exp} */
const loop = (condition, step) => ['=>', 1, [], ['?:', condition, step, ['arg', 0]]]

/** `r => r < 10 ? self(r + 1) : r`, the loop. @type {Exp} */
const counting = loop(['<', ['arg', 0], 10], call(['+', ['arg', 0], 1]))

/** @type {(shared: readonly (readonly [Exp, string])[]) => (e: Exp) => string} */
const printedWith = shared => e => {
    complete(unwrap(expExprTagged(shared, 'runtime')(e)))
    return unwrap(expExpr(shared, 'runtime')(e))
}

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
    // `self` is the closure's `self_` parameter as the `Function` it is,
    // so a body reading it names that parameter, as a frame read does
    self: () => {
        /** @type {Exp} */
        const loop = ['=>', 0, [], ['()', ['self'], []]]
        assertStructurallySame(usedBy(loop), { vm: ['Array', 'Function', 'ToAny'], unstable: [] })
        assertStructurallySame(scoped(loop), [
            'Ok(A::static_function(|self_, _args| { Any::call(Function::new(self_.clone()).to_any(), Array::default().to_any()) }, 0, Array::default(), Some("(function $0(){return ((0,($0))());})")).to_any())',
        ])
    },
    /**
     * A loop, `r => COND ? self(NEXT) : r`, is the closure whose body is
     * Rust's `loop`, no round a call (`fjs/edag/todo/tail-call-loop.md`):
     * the variable bound to the argument, the condition's temporaries and
     * the `break` where it is falsy, the round's temporaries — the asserts
     * among them, discarded — and the assignment. `self` is spelled
     * nowhere, so the closure reads `self_` only for a frame.
     */
    loops: {
        counting: () => {
            assertStructurallySame(scoped(counting), [
                'Ok(A::static_function(|_self, args| {',
                '    let mut r: Any<A> = args.argument(0);',
                '    loop {',
                '        if !(Any::lt(r.clone(), f64_any(0x4024000000000000)))?.to_boolean() { break }',
                '        let c0: Any<A> = (r.clone() + f64_any(0x3ff0000000000000))?;',
                '        r = c0;',
                '    }',
                '    Ok(r)',
                '}, 1, Array::default(), Some("($0)=>{let $1=$0;while((($1)<(10))){$1=(($1)+(1));}return $1;}")).to_any())',
            ])
            assertStructurallySame(usedBy(counting), { vm: ['Array', 'ToAny'], unstable: ['f64_any'] })
            // the same closure where it stands as an expression
            assertEq(printed(counting).split('\n')[2], '    loop {')
        },
        // the asserts are the round's discarded temporaries, the next
        // value being the variable, no assignment — and no `mut`, which
        // `rustc` would warn of; the condition's own temporaries precede
        // the test, a comma's included
        asserts: () => {
            assertStructurallySame(scoped(loop(true, [',', [['+', 1, 2], ['[]', [['arg', 0]]], call(['arg', 0])]])).slice(1, 7), [
                '    let r: Any<A> = args.argument(0);',
                '    loop {',
                '        if !true.to_any().to_boolean() { break }',
                '        let _: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;',
                '        let _: Any<A> = [r.clone()].to_array().to_any();',
                '    }',
            ])
            assertStructurallySame(scoped(loop([',', [['+', 1, 2], true]], call(1))).slice(2, 6), [
                '    loop {',
                '        let _: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;',
                '        if !true.to_any().to_boolean() { break }',
                '        r = f64_any(0x3ff0000000000000);',
            ])
        },
        // a next value that throws is assigned as any is: the `Err` the
        // round's `?` returns, so the loop throws where the recursion threw
        throwing: () => {
            assertStructurallySame(scoped(loop(true, call(['throw', 1]))).slice(2, 6), [
                '    loop {',
                '        if !true.to_any().to_boolean() { break }',
                '        let c0: Any<A> = (Err(f64_any(0x3ff0000000000000)))?;',
                '        r = c0;',
            ])
        },
        // a frame read is the one read of `self_`; the argument read twice
        // is one temporary of the round, as any shared atom is; an argument
        // past the length is read as any argument is
        reads: () => {
            assertStructurallySame(scoped(['=>', 1, [], ['?:', ['arg', 1], call(['arg', 1]), ['arg', 0]]]).slice(3, 5), [
                '        if !args.argument(1).to_boolean() { break }',
                '        r = args.argument(1);',
            ])
            assertStructurallySame(scoped(['=>', 1, [1, 2], ['?:', ['frame', 0], call(['frame', 1]), ['arg', 0]]]).slice(0, 6), [
                'Ok(A::static_function(|self_, args| {',
                '    let mut r: Any<A> = args.argument(0);',
                '    loop {',
                '        if !A::frame(self_)[0].clone().to_boolean() { break }',
                '        r = A::frame(self_)[1].clone();',
                '    }',
            ])
            /** @type {Exp} */
            const a = ['arg', 0]
            assertStructurallySame(scoped(['=>', 1, [], ['?:', ['<', a, 10], call(['+', a, a]), a]]).slice(3, 6), [
                '        if !(Any::lt(r.clone(), f64_any(0x4024000000000000)))?.to_boolean() { break }',
                '        let c0: Any<A> = r.clone();',
                '        let c1: Any<A> = (c0.clone() + c0.clone())?;',
            ])
        },
        // the recognizer is asked of the function's own table: a fragment
        // that has none — a slot shared with the body, across the
        // function's own boundary — is no loop, and a comma around the
        // body holding the `?:` alone is the loop's body
        table: () => {
            /** @type {Exp} */
            const s = ['[]', [1]]
            assert(!scoped(['=>', 1, [s], ['?:', s, call(1), ['arg', 0]]]).some(line => line.endsWith('loop {')))
            assertEq(scoped(['=>', 1, [], [',', [['?:', true, call(1), ['arg', 0]]]]])[2], '    loop {')
        },
        /**
         * A loop function called where it is written, the one place
         * reaching it, is the loop where the call stands: no closure is
         * built and none called, the call's own temporary is the
         * variable, bound to the argument, and the value after the loop.
         */
        inPlace: {
            // the scope's root, answered by name after the loop
            root: () => {
                assertStructurallySame(scoped(['()', counting, [0]]), [
                    'let mut c0: Any<A> = f64_any(0x0000000000000000);',
                    'loop {',
                    '    if !(Any::lt(c0.clone(), f64_any(0x4024000000000000)))?.to_boolean() { break }',
                    '    let c1: Any<A> = (c0.clone() + f64_any(0x3ff0000000000000))?;',
                    '    c0 = c1;',
                    '}',
                    'Ok(c0)',
                ])
                assertStructurallySame(usedBy(['()', counting, [0]]), { vm: [], unstable: ['f64_any'] })
            },
            // a temporary referenced twice, cloned as any is; and one in a
            // thunk's block, bound there
            referenced: () => {
                /** @type {Exp} */
                const c = ['()', counting, [0]]
                assertEq(scoped(['[]', [c, c]]).at(-1), 'Ok([c0.clone(), c0.clone()].to_array().to_any())')
                assertStructurallySame(scoped(['&&', true, ['[]', [c]]]), [
                    'let c0 = || {',
                    '    let mut c1: Any<A> = f64_any(0x0000000000000000);',
                    '    loop {',
                    '        if !(Any::lt(c1.clone(), f64_any(0x4024000000000000)))?.to_boolean() { break }',
                    '        let c2: Any<A> = (c1.clone() + f64_any(0x3ff0000000000000))?;',
                    '        c1 = c2;',
                    '    }',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::logical_and(true.to_any(), c0)',
                ])
            },
            // a slot is a temporary of the scope around, an atom too, bound
            // once as a frame is built once, and cloned at every read; a
            // primitive slot is read as its literal; a slot shared with the
            // scope is the one temporary
            slots: () => {
                assertStructurallySame(scoped(['()', ['=>', 1, [['[]', []], 5], ['?:', ['frame', 0], call(['frame', 1]), ['arg', 0]]], [1]]), [
                    'let c0: Any<A> = Array::default().to_any();',
                    'let mut c1: Any<A> = f64_any(0x3ff0000000000000);',
                    'loop {',
                    '    if !c0.clone().to_boolean() { break }',
                    '    c1 = f64_any(0x4014000000000000);',
                    '}',
                    'Ok(c1)',
                ])
                /** @type {Exp} */
                const shared = ['+', 1, 2]
                assertStructurallySame(scoped(['[]', [shared, ['()', ['=>', 1, [shared], ['?:', ['frame', 0], call(['frame', 0]), ['arg', 0]]], [1]]]]), [
                    'let c0: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;',
                    'let mut c1: Any<A> = f64_any(0x3ff0000000000000);',
                    'loop {',
                    '    if !c0.clone().to_boolean() { break }',
                    '    c1 = c0.clone();',
                    '}',
                    'Ok([c0.clone(), c1].to_array().to_any())',
                ])
            },
            // in a function's body, the shape a `while` lowers to: the
            // function's argument is the slot, and the closure reads no
            // frame of its own
            body: () => {
                assertStructurallySame(scoped(['=>', 1, [], ['()', ['=>', 1, [['arg', 0]], ['?:', ['<', ['arg', 0], ['frame', 0]], call(['+', ['arg', 0], 1]), ['arg', 0]]], [0]]]), [
                    'Ok(A::static_function(|_self, args| {',
                    '    let c0: Any<A> = args.argument(0);',
                    '    let mut c1: Any<A> = f64_any(0x0000000000000000);',
                    '    loop {',
                    '        if !(Any::lt(c1.clone(), c0.clone()))?.to_boolean() { break }',
                    '        let c2: Any<A> = (c1.clone() + f64_any(0x3ff0000000000000))?;',
                    '        c1 = c2;',
                    '    }',
                    '    Ok(c1)',
                    '}, 1, Array::default(), Some("($0)=>{let $1=0;while($1<$0){$1=$1+1;}return $1;}")).to_any())',
                ])
            },
            // a loop in a loop's round: the round's temporaries are
            // numbered after the scope's around it, which the round's
            // block must not shadow — the outer variable read in the inner
            // round through the slot bound before it
            nested: () => {
                /** @type {Exp} */
                const inner = ['=>', 1, [['arg', 0]], ['?:', ['<', ['arg', 0], ['+', ['frame', 0], 1]], call(['+', ['arg', 0], 1]), ['arg', 0]]]
                assertStructurallySame(scoped(['()', loop(['<', ['arg', 0], 10], call(['()', inner, [['arg', 0]]])), [0]]), [
                    'let mut c0: Any<A> = f64_any(0x0000000000000000);',
                    'loop {',
                    '    if !(Any::lt(c0.clone(), f64_any(0x4024000000000000)))?.to_boolean() { break }',
                    '    let c1: Any<A> = c0.clone();',
                    '    let mut c2: Any<A> = c0.clone();',
                    '    loop {',
                    '        let c3: Any<A> = (c1.clone() + f64_any(0x3ff0000000000000))?;',
                    '        if !(Any::lt(c2.clone(), c3))?.to_boolean() { break }',
                    '        let c3: Any<A> = (c2.clone() + f64_any(0x3ff0000000000000))?;',
                    '        c2 = c3;',
                    '    }',
                    '    c0 = c2;',
                    '}',
                    'Ok(c0)',
                ])
                // and in the round of a loop held as a value
                assertStructurallySame(scoped(loop(['<', ['arg', 0], 10], call(['()', inner, [['arg', 0]]]))).slice(4, 8), [
                    '        let c0: Any<A> = r.clone();',
                    '        let mut c1: Any<A> = r.clone();',
                    '        loop {',
                    '            let c2: Any<A> = (c0.clone() + f64_any(0x3ff0000000000000))?;',
                ])
            },
            // an argument past the first is `undefined`, as a call of one
            // argument binds it; a next value that is the variable needs no
            // assignment and no `mut`
            arguments: () => {
                assertStructurallySame(scoped(['()', ['=>', 1, [], ['?:', ['arg', 1], call(['arg', 1]), ['arg', 0]]], [1]]).slice(2, 4), [
                    '    if !Nullish::Undefined.to_any().to_boolean() { break }',
                    '    c0 = Nullish::Undefined.to_any();',
                ])
                assertStructurallySame(scoped(['()', loop(true, [',', [['+', 1, 2], call(['arg', 0])]]), [1]]), [
                    'let c0: Any<A> = f64_any(0x3ff0000000000000);',
                    'loop {',
                    '    if !true.to_any().to_boolean() { break }',
                    '    let _: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;',
                    '}',
                    'Ok(c0)',
                ])
            },
            // the closure is built and called where the call is no loop in
            // place: of two arguments or none, of a spread, of a function
            // reached from elsewhere too or reading its `args`, of no loop,
            // as a thunk's own root, as a comma's discarded operand, and in
            // the corpus's mode, where the root is one expression
            closure: () => {
                /** @type {Exp} */
                const held = counting
                /** @type {readonly Exp[]} */
                const cases = [
                    ['()', counting, [1, 2]],
                    ['()', counting, []],
                    ['()', counting, [['...', ['[]', []]]]],
                    ['[]', [held, ['()', held, [1]]]],
                    ['()', ['=>', 1, [], ['?:', ['args'], call(1), ['arg', 0]]], [1]],
                    ['()', ['=>', 1, [], ['arg', 0]], [1]],
                    ['&&', true, ['()', counting, [1]]],
                    [',', [['()', counting, [1]], 1]],
                ]
                for (const e of cases) { assert(scoped(e).some(line => line.includes('A::static_function(')), JSON.stringify(e)) }
                assert(printed(['()', counting, [0]]).startsWith('Any::call(A::static_function('))
            },
        },
        /**
         * The recursion is kept, `Function::new(self_)` called, for what
         * is not the template, and for the shapes every writer keeps it
         * for (`keepsRecursion` in `fjs/edag/loop`, asked of the
         * function's own table): a root assert, a value minting identity
         * the condition shares with the round — a container, which bound
         * in each would be two where the graph has one — a rest read, or
         * a spread as the next value. A shared operation merges, one
         * value however many times it is evaluated, and is bound in the
         * condition and in the round alike.
         */
        recursion: () => {
            /** @type {Exp} */
            const minted = ['[]', [['arg', 0]]]
            assertStructurallySame(scoped(loop(['.', minted, 0], call(['.', minted, 'length']))), [
                'Ok(A::static_function(|self_, args| {',
                '    let c0: Any<A> = [args.argument(0)].to_array().to_any();',
                '    let c1: Any<A> = Any::dot(c0.clone(), f64_any(0x0000000000000000)).end()?;',
                '    let c2 = || {',
                '        let c3: Any<A> = Any::dot(c0.clone(), string_any("length")).end()?;',
                '        Any::call(Function::new(self_.clone()).to_any(), [c3].to_array().to_any())',
                '    };',
                '    Any::conditional(c1, c2, || Ok(args.argument(0)))',
                '}, 1, Array::default(), Some("(function $0($1){const $2=(()=>{let $3,$4=false;return()=>{if(!$4){$3=([($1)]);$4=true;}return $3;};})();return ((($2())[(0)])?((0,($0))((($2())[(\\"length\\")]))):($1));})")).to_any())',
            ])
            /** @type {Exp} */
            const n = ['+', ['arg', 0], 1]
            assertStructurallySame(scoped(loop(['<', n, 10], call(n))).slice(2, 8), [
                '    loop {',
                '        let c0: Any<A> = (r.clone() + f64_any(0x3ff0000000000000))?;',
                '        if !(Any::lt(c0, f64_any(0x4024000000000000)))?.to_boolean() { break }',
                '        let c0: Any<A> = (r.clone() + f64_any(0x3ff0000000000000))?;',
                '        r = c0;',
                '    }',
            ])
            /** @type {Exp} */
            const c = call(1)
            /** @type {readonly Exp[]} */
            const cases = [
                ['=>', 1, [], [',', [['+', 1, 2], ['?:', true, c, ['arg', 0]]]]],
                loop(['rest'], c),
                loop(true, ['()', ['self'], [['...', ['[]', []]]]]),
                // another length, another alternate, a body that is no `?:`
                ['=>', 2, [], ['?:', true, c, ['arg', 0]]],
                ['=>', 1, [], ['?:', true, c, 1]],
                ['=>', 1, [], c],
                ['=>', 1, [], 1],
                // a consequent that is no call of `self` with one argument,
                // and a call shared by the comma around it
                loop(true, ['()', ['arg', 0], [1]]),
                loop(true, ['()', 1, [1]]),
                loop(true, ['()', ['self'], [1, 2]]),
                loop(true, [',', [c, c]]),
                // `self` read anywhere else: in the condition, as the next
                // value, and captured by a nested function
                loop(['()', ['self'], [1]], c),
                loop(true, call(['self'])),
                loop(true, call(['=>', 0, [['self']], 1])),
            ]
            for (const e of cases) { assert(!scoped(e).some(line => line.endsWith('loop {')), JSON.stringify(e)) }
        },
    },
    /**
     * Every name a scope's text spells is reported, recorded where the
     * printer spells it, and only those: a string literal spelling a name
     * is data, and `Any` and a function's bound are no scope's to report.
     */
    uses: {
        literal: () => {
            assertStructurallySame(usedBy(['typeof', 'Nullish::Null.to_any()']), { vm: [], unstable: ['string_any'] })
        },
        primitives: () => {
            assertStructurallySame(usedBy(['[]', [null, true, 1, 'a', '\ud800', 2n, 2n ** 64n]]), {
                vm: ['Nullish', 'ToAny', 'ToArray'],
                unstable: ['bigint_any', 'bigint_any_words', 'f64_any', 'string_any', 'string_any_utf16'],
            })
        },
        containers: () => {
            assertStructurallySame(usedBy(['[]', [['[]', []], ['{}', []], ['undefined']]]), {
                vm: ['Array', 'Nullish', 'Object', 'ToAny', 'ToArray'],
                unstable: [],
            })
            assertStructurallySame(usedBy(['{}', [[':', 'a', 1], [':', '\ud800', 2]]]), {
                vm: ['ToAny', 'ToObject'],
                unstable: ['f64_any', 'string_key', 'string_key_utf16'],
            })
        },
        spreads: () => {
            assertStructurallySame(usedBy(['[]', [1, ['...', ['args']]]]), {
                vm: ['ToAny'],
                unstable: ['f64_any', 'spread_array', 'spread_item', 'value_item'],
            })
            assertStructurallySame(usedBy(['()', ['args'], [['...', ['args']]]]), {
                vm: ['ToAny'],
                unstable: ['spread_call', 'spread_item'],
            })
            assertStructurallySame(usedBy(['{}', [[':', 'a', 1], ['...', ['args']]]]), {
                vm: ['ToAny'],
                unstable: ['f64_any', 'property_item', 'spread_entries', 'spread_object', 'string_key'],
            })
        },
        operators: () => {
            assertStructurallySame(usedBy(['===', ['String', 1], ['!==', 1, 2]]), {
                vm: ['ToAny'],
                unstable: ['f64_any', 'strict_eq', 'strict_ne'],
            })
            assertStructurallySame(usedBy(['.', ['undefined'], 0]), { vm: ['Nullish', 'ToAny'], unstable: ['f64_any'] })
        },
        functions: () => {
            assertStructurallySame(usedBy(['=>', 0, [], 'a']), { vm: ['Array', 'ToAny'], unstable: ['string_any'] })
            assertStructurallySame(usedBy(['=>', 0, [], ['undefined']]), { vm: ['Array', 'Nullish', 'ToAny'], unstable: [] })
            assertStructurallySame(usedBy(['=>', 0, [1], ['frame', 0]]), { vm: ['ToAny', 'ToArray'], unstable: ['f64_any'] })
            assertStructurallySame(usedBy(['=>', 1, [], ['[]', [['arg', 0], ['args'], ['rest']]]]), {
                vm: ['Array', 'ToAny', 'ToArray'],
                unstable: [],
            })
        },
    },
    useLines: () => {
        assertStructurallySame(useLines({ vm: [], unstable: [] }, 'IVm'), ['use nanvm_lib::vm::{Any, IVm};'])
        assertStructurallySame(useLines({ vm: ['ToAny', 'Array'], unstable: ['f64_any'] }, 'IStaticFunction'), [
            'use nanvm_lib::vm::unstable::f64_any;',
            'use nanvm_lib::vm::{Any, Array, IStaticFunction, ToAny};',
        ])
        assertStructurallySame(useLines({ vm: ['Any'], unstable: ['f64_any', 'strict_eq'] }, 'IVm'), [
            'use nanvm_lib::vm::unstable::{f64_any, strict_eq};',
            'use nanvm_lib::vm::{Any, IVm};',
        ])
        // past rustfmt's 100 columns the braced names wrap as it wraps them:
        // on lines of their own, filled to the width
        // the boundary rustfmt draws: a braced `use` of 99 columns wraps,
        // one of 98 stays, and a continuation line reaches 99 at most
        assertStructurallySame(useLines({ vm: [], unstable: ['bigint_any', 'f64_any', 'static_read', 'strict_eq', 'string_any', 'string_key'] }, 'IVm'), [
            'use nanvm_lib::vm::unstable::{',
            '    bigint_any, f64_any, static_read, strict_eq, string_any, string_key,',
            '};',
            'use nanvm_lib::vm::{Any, IVm};',
        ])
        assertStructurallySame(useLines({ vm: [], unstable: ['bigint_any', 'f64_any', 'static_read', 'strict_eq', 'string_any', 'string_ke'] }, 'IVm'), [
            'use nanvm_lib::vm::unstable::{bigint_any, f64_any, static_read, strict_eq, string_any, string_ke};',
            'use nanvm_lib::vm::{Any, IVm};',
        ])
        const long = 'b'.repeat(87)
        assertStructurallySame(useLines({ vm: [], unstable: ['aaaa', long, 'cc'] }, 'IVm'), ['use nanvm_lib::vm::unstable::{', `    aaaa, ${long},`, '    cc,', '};', 'use nanvm_lib::vm::{Any, IVm};'])
        assertStructurallySame(useLines({ vm: [], unstable: ['aaaa', `${long}bb`, 'cc'] }, 'IVm'), ['use nanvm_lib::vm::unstable::{', '    aaaa,', `    ${long}bb, cc,`, '};', 'use nanvm_lib::vm::{Any, IVm};'])
        assertStructurallySame(useLines({ vm: [], unstable: ['f64_any', 'spread_array', 'spread_call', 'spread_item', 'string_any', 'string_key', 'value_item'] }, 'IVm'), [
            'use nanvm_lib::vm::unstable::{',
            '    f64_any, spread_array, spread_call, spread_item, string_any, string_key, value_item,',
            '};',
            'use nanvm_lib::vm::{Any, IVm};',
        ])
        assertStructurallySame(useLines({ vm: [], unstable: Array.from({ length: 11 }, (_, i) => `helper_number_${i}`) }, 'IVm'), [
            'use nanvm_lib::vm::unstable::{',
            '    helper_number_0, helper_number_1, helper_number_2, helper_number_3, helper_number_4,',
            '    helper_number_5, helper_number_6, helper_number_7, helper_number_8, helper_number_9,',
            '    helper_number_10,',
            '};',
            'use nanvm_lib::vm::{Any, IVm};',
        ])
    },
    // The `use` of each statement is a keyword, whether the names fit one
    // line, wrap, or are a single name, and the text is `useLines`'s.
    useLinesTagged: () => {
        /** @type {readonly (readonly [Uses, string, number])[]} */
        const cases = [
            [{ vm: [], unstable: [] }, 'IVm', 1],
            [{ vm: [], unstable: ['f64_any'] }, 'IVm', 2],
            [{ vm: ['ToAny'], unstable: ['f64_any', 'strict_eq'] }, 'IStaticFunction', 2],
            [{ vm: [], unstable: Array.from({ length: 11 }, (_, i) => `helper_number_${i}`) }, 'IVm', 2],
        ]
        for (const [uses, bound, statements] of cases) {
            const marked = unwrap(fromTagged(useLinesTagged(uses, bound).join('\n')))
            assertEq(JSON.stringify(marked.filter(([, kind]) => kind === 'keyword').map(([text]) => text)), JSON.stringify(Array(statements).fill('use')))
            assertEq(toText(marked), useLines(uses, bound).join('\n'))
            assertEq(JSON.stringify(unmarkedWords(marked)), '[]')
        }
    },
    // Each kind the printer says it marks, where it spells one.
    markedKinds: () => {
        /** @type {(e: Exp) => string} */
        const runs = e => JSON.stringify(unwrap(fromTagged(unwrap(expExprTagged([])(e)))).filter(([, kind]) => kind !== undefined))
        assertEq(runs(true), '[["true","literal"]]')
        assertEq(runs(1), '[["0x3ff0000000000000","number"]]')
        assertEq(runs('a'), '[["\\"a\\"","string"]]')
        assertEq(runs(2n), '[["2","number"]]')
        // a bigint past `i64`: the sign is a literal, each word a number
        assertEq(runs(2n ** 63n), '[["false","literal"],["0x8000000000000000","number"]]')
        assertEq(runs(-(2n ** 64n)), '[["true","literal"],["0x0000000000000000","number"],["0x0000000000000001","number"]]')
        // a string no `&str` holds: each unit a number
        assertEq(runs('\ud800'), '[["0xd800","number"]]')
        // a discarded operand is bound by a `let`
        assertEq(runs([',', [1, 2]]), '[["let","keyword"],["0x3ff0000000000000","number"],["0x4000000000000000","number"]]')
        // an index read and a function's length are numbers too
        assertEq(JSON.stringify(unwrap(fromTagged(unwrap(scopeTagged(['=>', 1, [], ['arg', 0]])).lines.join('\n'))).filter(([, kind]) => kind === 'number')), '[["0","number"],["1","number"]]')
        assertEq(JSON.stringify(unwrap(fromTagged(unwrap(scopeTagged(['=>', 0, [['[]', [1]]], ['frame', 0]])).lines.join('\n'))).filter(([, kind]) => kind === 'number').map(([text]) => text)), '["0x3ff0000000000000","0","0"]')
    },
    fixedAndRest: () => {
        const text = scoped(['=>', 3, [], ['[]', [['arg', 0], ['arg', 2], ['rest']]]]).join('\n')
        assert(text.includes('args.argument(0)'))
        assert(text.includes('args.argument(2)'))
        assert(text.includes('let rest = args.rest(3);'))
        assert(text.includes('}, 3, Array::default(), Some("($0,$1,$2,...$3)=>[$0,$2,$3]")).to_any()'))
    },
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
        assertEq(printed(0n), 'bigint_any(0)')
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
        // the constructor is the `Constructor` variant it names, never an
        // operand: a string operand would print as `string_any("Array")`
        assertEq(printed(['instanceof', ['[]', []], 'Array']), 'Any::instanceof_(Array::default().to_any(), Constructor::Array)')
        assertEq(printed(['instanceof', 'Array', 'Array']), 'Any::instanceof_(string_any("Array"), Constructor::Array)')
        assertStructurallySame(usedBy(['instanceof', 'x', 'Array']), { vm: ['Constructor'], unstable: ['string_any'] })
        assertEq(printed(['-', 1]), '-(f64_any(0x3ff0000000000000))')
        assertEq(printed(['+', 1]), 'Any::unary_plus(f64_any(0x3ff0000000000000))')
        assertEq(
            printed(['?:', true, 1, 2]),
            'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), || Ok(f64_any(0x4000000000000000)))')
        assertEq(printed(['=>', 0, [], ['undefined']]), 'function_any()')
        assertEq(printed(['*', 1, 2]), 'f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)')
    },
    /**
     * The `entry` helper as a value: the static function every function
     * is, its body `Any::entry` of its two fixed arguments, under the text
     * the writer gives the helper.
     */
    /**
     * A helper as a value with the names it spells, what a frame slot
     * holding one prints as in the static runtime: tagged, as
     * `scopeTagged`'s lines are.
     */
    helperExpr: () => {
        const [text, uses] = unwrap(helperExpr(['slice']))
        assertEq(untagged(text), printed(['slice']))
        assertStructurallySame([...new Set(uses.map(([m, n]) => `${m}::${n}`))].toSorted(), ['unstable::string_any', 'vm::Array', 'vm::ToAny', 'vm::ToArray'])
        assertEq(unwrap(helperExpr(['entry']))[1].some(([, n]) => n === 'Array'), true)
    },
    /**
     * A caller's text for a function node, in place of the writer's, where
     * it gives one — the static runtime's built-ins — and the writer's
     * where it gives none, nested functions included.
     */
    givenText: () => {
        const given = /** @type {Exp} */ (['=>', 0, [], 1])
        const text = unwrap(scopeTagged(['[]', [given, ['=>', 0, [], ['=>', 0, [], 2]]]], e => e === given ? 'function f() { [native code] }' : undefined)).lines.map(untagged).join('\n')
        assert(text.includes('Some("function f() { [native code] }")'))
        assert(text.includes('Some("()=>()=>2")') && text.includes('Some("()=>2")'))
        assert(!unwrap(scopeTagged(['[]', [given]])).lines.map(untagged).join('\n').includes('native code'))
    },
    entry: () => {
        assertEq(printed(['entry']), 'A::static_function(|_self, args| Any::entry(args.argument(0), args.argument(1)), 2, Array::default(), Some("($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}")).to_any()')
        assertEq(printed(['()', ['entry'], [1, 2]]), 'Any::call(A::static_function(|_self, args| Any::entry(args.argument(0), args.argument(1)), 2, Array::default(), Some("($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}")).to_any(), [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array().to_any())')
        // `hasEntry` the same, its `bool` made an `Any`
        assertEq(printed(['hasEntry']), 'A::static_function(|_self, args| Any::has_entry(args.argument(0), args.argument(1)).map(|b| b.to_any()), 2, Array::default(), Some("($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;}")).to_any()')
        // an intrinsic: the closure answering the member call of the name
        // on its first argument with the rest, the library's call step
        assertEq(printed(['slice']), 'A::static_function(|_self, args| Any::dot(args.argument(0), string_any("slice")).end_call_native(|| Ok([args.argument(1), args.argument(2)].to_array().to_any())), 3, Array::default(), Some("($0,$1,$2)=>$0.slice($1,$2)")).to_any()')
    },
    /**
     * A static function as a value — `Object.is` — is read from the
     * runtime value by its path, `static_read(&runtime, "Object.is")?`,
     * the one closure the value holds, so every read is the same
     * function. An atom with a `?` of its own: a thunk over it is
     * `|| Ok(…)`; shared, it is one temporary.
     */
    objectIs: () => {
        assertEq(printed(['Object.is']), 'static_read(&runtime, "Object.is")?')
        assertStructurallySame(scoped(['()', ['Object.is'], [1, 2]]), [
            'let c0: Any<A> = static_read(&runtime, "Object.is")?;',
            'Any::call(c0, [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array().to_any())',
        ])
        /** @type {Exp} */
        const is = ['Object.is']
        assertStructurallySame(scoped(['[]', [is, is]]), [
            'let c0: Any<A> = static_read(&runtime, "Object.is")?;',
            'Ok([c0.clone(), c0.clone()].to_array().to_any())',
        ])
        assertStructurallySame(usedBy(['()', ['Object.is'], [1, 2]]), { vm: ['ToAny', 'ToArray'], unstable: ['f64_any', 'static_read'] })
        assertStructurallySame(scoped(['Object.is']), ['static_read(&runtime, "Object.is")'])
        // a function reading a static holds the runtime in its frame, one
        // slot after its own, and reads the static through it
        assertStructurallySame(scoped(['=>', 0, [], ['Object.is']]), ['Ok(A::static_function(|self_, _args| { static_read(&A::frame(self_)[0], "Object.is") }, 0, [runtime.clone()].to_array(), Some("()=>Object.is")).to_any())'])
        assertStructurallySame(scoped(['&&', true, ['Object.is']]), ['let c0 = || static_read(&runtime, "Object.is");', 'Any::logical_and(true.to_any(), c0)'])
        // a thunk's answer is the static's read where the scope binds
        // nothing, or binds other temporaries; a shared static bound before
        // the thunk is read once, and the thunk answers the temporary
        assertStructurallySame(scoped(['&&', ['Object.is'], ['&&', true, ['Number.isNaN']]]), [
            'let c0: Any<A> = static_read(&runtime, "Object.is")?;',
            'let c1 = || {',
            '    let c2 = || static_read(&runtime, "Number.isNaN");',
            '    Any::logical_and(true.to_any(), c2)',
            '};',
            'Any::logical_and(c0, c1)',
        ])
        assertStructurallySame(scoped(['&&', is, ['&&', true, is]]), [
            'let c0: Any<A> = static_read(&runtime, "Object.is")?;',
            'let c1 = || Any::logical_and(true.to_any(), || Ok(c0.clone()));',
            'Any::logical_and(c0.clone(), c1)',
        ])
        // with no runtime in scope, the runtime module's own, a static is
        // refused, and a member call with it: the core may not use what it
        // defines. The one native static the core lists as itself,
        // `Object.entries`, is the closure over `Any::entries`, under the
        // built-in's text.
        assertStructurallySame(printedWithout(['Object.is']), ['error', ['a static function read with no runtime in scope; the core may not use what it defines', 'Object.is']])
        assertStructurallySame(printedWithout(['.', ['{}', []], 'b', ['|()', []]]), ['error', ['a member call with no runtime in scope; the core may not use what it defines', ['|()', []]]])
        assertStructurallySame(printedWithout(['Object.entries']), ok('A::static_function(|_self, args| Any::entries(args.argument(0)), 1, Array::default(), Some("function entries() { [native code] }")).to_any()'))
        // every static is its accessor, named as Rust spells the name
        assertEq(printed(['Number.isSafeInteger']), 'static_read(&runtime, "Number.isSafeInteger")?')
        assertStructurallySame(scoped(['()', ['Number.isInteger'], [1]]), [
            'let c0: Any<A> = static_read(&runtime, "Number.isInteger")?;',
            'Any::call(c0, [f64_any(0x3ff0000000000000)].to_array().to_any())',
        ])
    },
    /** A module scope and each nested body construct their own functions. */
    undefinedFunction: () => {
        const text = /** @type {const} */ ('A::static_function(|_self, _args| { Ok(Nullish::Undefined.to_any()) }, 0, Array::default(), Some("()=>undefined")).to_any()')
        assertStructurallySame(scoped(['=>', 0, [], ['undefined']]), [`Ok(${text})`])
        assertStructurallySame(scoped(['=>', 0, [], ['=>', 0, [], ['undefined']]]), [
            `Ok(A::static_function(|_self, _args| { Ok(${text}) }, 0, Array::default(), Some("()=>()=>undefined")).to_any())`,
        ])
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
        // `throw` is the `Err` arm of the `Result` every operation answers:
        // in an arm of `?:` it is a thunk like any lazy operand, and where
        // a scope ends in one the scope answers that `Err`.
        assertStructurallySame(
            scoped(['?:', true, 1, ['throw', 2]]),
            [
                'let c0 = || Err(f64_any(0x4000000000000000));',
                'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c0)',
            ])
        // the value is evaluated before the failure, so a container is
        // established first, as one is under any other operator
        assertStructurallySame(scoped(['throw', ['[]', [1]]]), [
            'let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
            'Err(c0)',
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
     * a bigint receiver correctly — a `length` among what it reads, which
     * `Any::entry`, the helper's read, never answers — so a base this
     * printer can prove is one of
     * these prints the call rather than refusing it: `[1].length`, `"ab"[0]`,
     * `true.x` (`undefined`, since a boolean has no own properties at all)
     * are accepted, per `spec/README.md`'s Property Access.
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
            printed(['.', ['.', ['=>', 0, [], 1], 'length'], 'x']),
            'Any::dot(Any::dot(A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some("()=>1")).to_any(), string_any("length")).end(), string_any("x")).end()')
    },
    /**
     * `,` — new relative to the operator-test printer, whose corpus has no
     * anchored, unreached roots. Every operand is established, in the order
     * `fjs/compiler/edag/module.f.mjs`'s `resolve` puts them in (imports, then
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
            assertStructurallySame(scoped(['[]', [['()', ['args'], [1]]]]), [
                'let c0: Any<A> = Any::call(args.clone().to_any(), [f64_any(0x3ff0000000000000)].to_array().to_any())?;',
                'Ok([c0].to_array().to_any())',
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
            // two thunks reach it, and neither may bind it for the other
            assert(scope(['[]', [['&&', true, c], ['&&', false, c]]])[0] === 'error')
            // it is the thunk, twice
            assert(scope(['?:', true, c, c])[0] === 'error')
            // and one thunk reaches it only through its own lazy operands
            assert(scope(['?:', true, 1, ['[]', [['&&', 1, c], ['&&', 2, c]]]])[0] === 'error')
        },
        /**
         * A shared node one thunk's root reaches eagerly, and nothing
         * outside that thunk reaches at all, binds in the thunk's block:
         * established exactly when the program establishes it, once. It
         * is the shape a `const` inside an arm lowers to, the arm's call
         * inlined — `true ? 1 : (() => { const c = [1]; return [c, c];
         * })()` — and nests as arms nest.
         */
        sharedOwnedByAThunk: () => {
            /** @type {Exp} */
            const c = ['[]', [1]]
            assertStructurallySame(scoped(['?:', true, 1, ['[]', [c, c]]]), [
                'let c0 = || {',
                '    let c1: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                '    Ok([c1.clone(), c1.clone()].to_array().to_any())',
                '};',
                'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c0)',
            ])
            /** @type {Exp} */
            const d = ['[]', [2]]
            assertStructurallySame(scoped(['?:', true, 1, ['&&', 2, ['[]', [d, d]]]]), [
                'let c0 = || {',
                '    let c1 = || {',
                '        let c2: Any<A> = [f64_any(0x4000000000000000)].to_array().to_any();',
                '        Ok([c2.clone(), c2.clone()].to_array().to_any())',
                '    };',
                '    Any::logical_and(f64_any(0x4000000000000000), c1)',
                '};',
                'Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c0)',
            ])
            // one the scope's root reaches eagerly as well is the scope's
            // temporary, as ever
            assertStructurallySame(scoped(['[]', [c, ['?:', true, 1, ['[]', [c, c]]]]]), [
                'let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                'let c1 = || Ok([c0.clone(), c0.clone()].to_array().to_any());',
                'let c2: Any<A> = (Any::conditional(true.to_any(), || Ok(f64_any(0x3ff0000000000000)), c1))?;',
                'Ok([c0.clone(), c2].to_array().to_any())',
            ])
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
        lengthLimit: () => {
            assertEq(printed(['=>', 16, [], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 16, Array::default(), Some("($0,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)=>1")).to_any()')
            for (const length of [17, 2 ** 32, Number.MAX_SAFE_INTEGER, 1e30]) {
                assertStructurallySame(nodeExpr(['=>', length, [], 1]),
                    ['error', ['a function length above 16', length]])
            }
        },
        args: () => {
            assertEq(printed(['args']), 'args.clone().to_any()')
        },
        call: () => {
            /** @type {Exp} */
            const e = ['()', ['args'], [1]]
            assertEq(printed(e), 'Any::call(args.clone().to_any(), [f64_any(0x3ff0000000000000)].to_array().to_any())')
            assertStructurallySame(scoped(e), [
                'Any::call(args.clone().to_any(), [f64_any(0x3ff0000000000000)].to_array().to_any())',
            ])
            // The arguments are a list by position, so a first item that
            // spells a tag is a string, eager or in a thunk.
            assertEq(
                printed(['()', ['args'], [',', 'args']]),
                'Any::call(args.clone().to_any(), [string_any(","), string_any("args")].to_array().to_any())')
            assertStructurallySame(scoped(['?.()', ['undefined'], [',', 'args']]), [
                'let c0 = || Ok([string_any(","), string_any("args")].to_array().to_any());',
                'Any::option_call(Nullish::Undefined.to_any(), c0).end()',
            ])
        },
        /**
         * A body that reads its arguments names the parameter; one that
         * never does leaves it `_args`, unused. The last argument is the
         * function's text, `tryFunctionText`'s.
         */
        closure: () => {
            assertEq(
                printed(['=>', 0, [], ['rest']]),
                'A::static_function(|_self, args| {\n    let rest = args.rest(0);\n    Ok(rest.clone().to_any())\n}, 0, Array::default(), Some("(...$0)=>$0")).to_any()')
            assertEq(
                printed(['=>', 0, [], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some("()=>1")).to_any()')
        },
        /** A nested function's `args` are its own: the outer body reads none. */
        nested: () => {
            assertEq(
                printed(['=>', 0, [], ['=>', 0, [], ['rest']]]),
                'A::static_function(|_self, _args| { Ok(A::static_function(|_self, args| {\n    let rest = args.rest(0);\n    Ok(rest.clone().to_any())\n}, 0, Array::default(), Some("(...$0)=>$0")).to_any()) }, 0, Array::default(), Some("()=>(...$0)=>$0")).to_any()')
        },
        /** A body whose root is an operation answers that operation's own `Result`, as a thunk does. */
        operationBody: () => {
            assertEq(
                printed(['=>', 0, [], ['.', ['rest'], 0]]),
                'A::static_function(|_self, args| {\n    let rest = args.rest(0);\n    Any::dot(rest.clone().to_any(), f64_any(0x0000000000000000)).end()\n}, 0, Array::default(), Some("(...$0)=>$0[0]")).to_any()')
        },
        /**
         * A body's temporaries are the body's own: bound in the closure,
         * numbered from `c0`, its block one line under another — a shared
         * read cloned at each reference, two reads each moved.
         */
        sharingInside: () => {
            /** @type {Exp} */
            const first = ['.', ['rest'], 0]
            assertEq(
                printed(['=>', 0, [], ['[]', [first, first]]]),
                'A::static_function(|_self, args| {\n    let rest = args.rest(0);\n    let c0: Any<A> = Any::dot(rest.clone().to_any(), f64_any(0x0000000000000000)).end()?;\n    Ok([c0.clone(), c0.clone()].to_array().to_any())\n}, 0, Array::default(), Some("(...$0)=>{const $1=$0[0];return [$1,$1];}")).to_any()')
            assertStructurallySame(
                scoped(['=>', 0, [], ['[]', [['.', ['rest'], 0], ['.', ['rest'], 1]]]]),
                [
                    'Ok(A::static_function(|_self, args| {',
                    '    let rest = args.rest(0);',
                    '    let c0: Any<A> = Any::dot(rest.clone().to_any(), f64_any(0x0000000000000000)).end()?;',
                    '    let c1: Any<A> = Any::dot(rest.clone().to_any(), f64_any(0x3ff0000000000000)).end()?;',
                    '    Ok([c0, c1].to_array().to_any())',
                    '}, 0, Array::default(), Some("(...$0)=>[$0[0],$0[1]]")).to_any())',
                ])
        },
        /**
         * A frame is the third argument of `A::static_function`: its items
         * values of the scope around the function, collected as the
         * `Array<A>` it takes — an empty one `Array::default()`, as `null`
         * is — and `['frame', i]` in the body is slot `i` of that array,
         * indexed through `self_`, which the closure then names. A slot
         * read twice is one temporary, as any shared atom is.
         */
        frame: () => {
            assertEq(
                printed(['=>', 0, [1], ['frame', 0]]),
                'A::static_function(|self_, _args| { Ok(A::frame(self_)[0].clone()) }, 0, [f64_any(0x3ff0000000000000)].to_array(), Some("()=>$0")).to_any()')
            assertEq(
                printed(['=>', 0, [['[]', []], ['{}', []]], ['[]', [['frame', 1], ['frame', 0]]]]),
                'A::static_function(|self_, _args| { Ok([A::frame(self_)[1].clone(), A::frame(self_)[0].clone()].to_array().to_any()) }, 0, [Array::default().to_any(), Object::default().to_any()].to_array(), Some("()=>{const $2=$0;const $3=$1;return [$3,$2];}")).to_any()')
            assertEq(
                printed(['=>', 0, [], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some("()=>1")).to_any()')
            // A frame's items are the scope's temporaries, moved where the
            // frame is their only reference and cloned where it is not.
            /** @type {Exp} */
            const read = ['.', ['{}', []], 'a']
            assertStructurallySame(
                scoped(['[]', [['=>', 0, [read], ['frame', 0]], read]]),
                [
                    'let c0: Any<A> = Any::dot(Object::default().to_any(), string_any("a")).end()?;',
                    'let c1: Any<A> = A::static_function(|self_, _args| { Ok(A::frame(self_)[0].clone()) }, 0, [c0.clone()].to_array(), Some("()=>$0")).to_any();',
                    'Ok([c1, c0.clone()].to_array().to_any())',
                ])
        },
        /**
         * A nested function captures through its parent: the inner frame
         * is built in the outer body, from the outer frame's slot — an
         * atom, written where the inner frame takes it, in the outer
         * closure's text and outside the inner one's, so its `self_` is the
         * outer's — and each body reads its own frame alone.
         */
        nestedFrame: () => {
            assertEq(
                printed(['=>', 0, [['[]', []]], ['=>', 0, [['frame', 0]], ['frame', 0]]]),
                'A::static_function(|self_, _args| { Ok(A::static_function(|self_, _args| { Ok(A::frame(self_)[0].clone()) }, 0, [A::frame(self_)[0].clone()].to_array(), Some("()=>$0")).to_any()) }, 0, [Array::default().to_any()].to_array(), Some("()=>()=>$0")).to_any()')
        },
        /**
         * A slot the frame does not have is refused, as the JavaScript
         * executors refuse it, rather than printed as an index that
         * panics: a read past the slots, of a function with none, or with
         * an index that is no canonical index. A nested body's reads are
         * checked against its own slots, not its parent's.
         */
        slotPastTheFrame: () => {
            for (const e of /** @type {readonly Exp[]} */ ([
                ['=>', 0, [1], ['frame', 1]],
                ['=>', 0, [], ['frame', 0]],
                ['=>', 0, [1], ['frame', -0]],
                ['=>', 0, [1], ['frame', -1]],
                ['=>', 0, [1, 2], ['=>', 0, [['frame', 1]], ['frame', 1]]],
            ])) { assertEq(refusalReason(e)[0], 'no Rust for a frame slot the frame does not have') }
            assertEq(nodeExpr(['=>', 0, [1, 2], ['=>', 0, [['frame', 1]], ['frame', 0]]])[0], 'ok')
        },
        /**
         * A slot is an operand of the scope around the function: one the
         * scope reaches elsewhere too is a temporary, bound once and cloned
         * into the frame.
         */
        sharedSlot: () => {
            /** @type {Exp} */
            const c = ['[]', [1]]
            assertStructurallySame(
                scoped(['[]', [['=>', 0, [c], 1], c]]),
                [
                    'let c0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                    'let c1: Any<A> = A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, [c0.clone()].to_array(), Some("()=>1")).to_any();',
                    'Ok([c1, c0.clone()].to_array().to_any())',
                ])
        },
        /**
         * A function anywhere — an item, a call's callee, a body inside
         * another function, one with a frame or returning undefined — is
         * held; a primitive holds nothing.
         */
        holdsFunction: () => {
            assertEq(holdsFunction(['entry']), true)
            assertEq(holdsFunction(['hasEntry']), true)
            assertEq(holdsFunction(['slice']), true)
            assertEq(holdsFunction(['[]', [['entry']]]), true)
            assertEq(holdsFunction(['=>', 0, [], 1]), true)
            assertEq(holdsFunction(['=>', 0, [1], 1]), true)
            assertEq(holdsFunction(['=>', 0, [], ['rest']]), true)
            assertEq(holdsFunction(['[]', [1, ['=>', 0, [], 1]]]), true)
            assertEq(holdsFunction(['()', ['=>', 0, [], ['rest']], []]), true)
            assertEq(holdsFunction(['=>', 0, [], ['=>', 0, [], 1]]), true)
            assertEq(holdsFunction(['=>', 0, [], ['undefined']]), true)
            assertEq(holdsFunction(['[]', [1, 'static_function(']]), false)
            assertEq(holdsFunction(1), false)
        },
        /**
         * A scope needs the runtime value for a static, read from it, or a
         * member call, dispatched through it — after the `.` or `?.` a
         * chain opens with or a `|.` step, where a call step on a plain
         * value, the state a call or a `?.()` left, asks nothing of it. A
         * function's body counts: its closure holds the value in its frame.
         */
        needsRuntime: () => {
            assertEq(needsRuntime(['Object.is']), true)
            assertEq(needsRuntime(['[]', [1, ['Number.isNaN']]]), true)
            assertEq(needsRuntime(['=>', 0, [], ['Object.is']]), true)
            assertEq(needsRuntime(['.', ['{}', []], 'b', ['|()', []]]), true)
            assertEq(needsRuntime(['?.', ['{}', []], 'b', ['|?.()', []]]), true)
            assertEq(needsRuntime(['?.()', ['undefined'], [], ['|()', [], ['|.', 'd', ['|()', []]]]]), true)
            assertEq(needsRuntime(['.', ['{}', []], 'b']), false)
            assertEq(needsRuntime(['?.()', ['undefined'], [], ['|()', []]]), false)
            assertEq(needsRuntime(['()', ['=>', 0, [], ['[]', []]], []]), false)
            assertEq(needsRuntime(1), false)
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
            assertEq(readsFrame(chain(40, ['frame', 0])), true)
            assertEq(holdsFunction(deep), false)
            assertEq(holdsFunction(chain(40, ['=>', 0, [], 1])), true)
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
        assertEq(eagerNodesOf(['=>', 0, [], ['[]', [c]]]).includes(c), false)
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
    /**
     * A string with a lone surrogate, which no `&str` can hold, is spelled by
     * its code units, as a value, a key and an index alike; a paired one
     * stays a literal.
     */
    loneSurrogates: () => {
        assertEq(printed('a\ud800b'), 'string_any_utf16(&[0x0061, 0xd800, 0x0062])')
        assertEq(
            printed(['{}', [[':', '\udc00', 1]]]),
            '[(string_key_utf16(&[0xdc00]), f64_any(0x3ff0000000000000))].to_object().to_any()')
        assertEq(
            printed(['.', ['{}', []], '\ud800']),
            'Any::dot(Object::default().to_any(), string_any_utf16(&[0xd800])).end()')
        assertEq(printed('\u{1F600}'), 'string_any("\u{1F600}")')
    },
    /** A bigint within `i64` is `bigint_any`, one past either end its sign and `u64` words. */
    bigints: () => {
        assertEq(printed(2n ** 63n - 1n), 'bigint_any(9223372036854775807)')
        assertEq(printed(-(2n ** 63n)), 'bigint_any(-9223372036854775808)')
        assertEq(printed(2n ** 63n), 'bigint_any_words(false, &[0x8000000000000000])')
        assertEq(printed(-(2n ** 63n) - 1n), 'bigint_any_words(true, &[0x8000000000000001])')
        assertEq(
            printed(123_456_789_012_345_678_901_234_567_890n),
            'bigint_any_words(false, &[0xc373e0ee4e3f0ad2, 0x000000018ee90ff6])')
        assertEq(printed(-(2n ** 64n)), 'bigint_any_words(true, &[0x0000000000000000, 0x0000000000000001])')
    },
    /**
     * A key that is not a string literal, `{ [k]: v }`: coerced by
     * `computed_item` where the entry is built, which can throw, so the
     * entries go through `spread_object`, inside a Result-returning scope.
     * A bare corpus expression has no such scope and must refuse the key.
     */
    computedKey: {
        operand: () => assertStructurallySame(
            scoped(['{}', [[':', ['undefined'], 1]]]),
            ['Ok(spread_object([computed_item(Nullish::Undefined.to_any(), f64_any(0x3ff0000000000000))?]))']),
        mixed: () => assertStructurallySame(
            scoped(['{}', [[':', 'a', 0], [':', 1, 2]]]),
            ['Ok(spread_object([property_item(string_key("a"), f64_any(0x0000000000000000)), computed_item(f64_any(0x3ff0000000000000), f64_any(0x4000000000000000))?]))']),
        spread: () => assertStructurallySame(
            scoped(['{}', [[':', 1, 2], ['...', ['{}', []]]]]),
            ['Ok(spread_object([computed_item(f64_any(0x3ff0000000000000), f64_any(0x4000000000000000))?, spread_entries(Object::default().to_any())]))']),
        corpusRefusal: () => {
            const reason = 'no Rust for computed object keys in corpus mode; use scope'
            assertEq(refusalReason(['{}', [[':', ['undefined'], 1]]])[0], reason)
            assertEq(refusalReason(['typeof', ['{}', [[':', 1, 2]]]])[0], reason)
        },
    },
    /**
     * A `Number(…)` index, `a[k]` once the source spells it: an operand like
     * any other, bound where it is a temporary and cast by `Any::number`,
     * after the receiver and before the access. Inside a region the cast and
     * its operand are one thunk, which the guard runs or skips.
     */
    computedIndex: {
        /** The key is an operation, so it is a binding of its own, then the cast. */
        dot: () => assertStructurallySame(
            scoped(['.', ['{}', []], ['Number', ['+', 1]]]),
            [
                'let c0: Any<A> = (Any::unary_plus(f64_any(0x3ff0000000000000)))?;',
                'let c1: Any<A> = (Any::number(c0))?;',
                'Any::dot(Object::default().to_any(), c1).end()',
            ]),
        /** A literal operand needs no binding of its own. */
        literalOperand: () => assertStructurallySame(
            scoped(['.', ['{}', []], ['Number', 1]]),
            [
                'let c0: Any<A> = (Any::number(f64_any(0x3ff0000000000000)))?;',
                'Any::dot(Object::default().to_any(), c0).end()',
            ]),
        /** One step into a chain, the inner read's key is cast as it is outside one. */
        dotOfDot: () => assertStructurallySame(
            scoped(['.', ['.', ['[]', []], ['Number', 1]], 'x']),
            [
                'let c0: Any<A> = (Any::number(f64_any(0x3ff0000000000000)))?;',
                'let c1: Any<A> = Any::dot(Array::default().to_any(), c0).end()?;',
                'Any::dot(c1, string_any("x")).end()',
            ]),
        /** Under `?.` the key is a thunk that casts, its operand inside it. */
        optionDot: () => assertStructurallySame(
            scoped(['?.', ['{}', []], ['Number', ['+', 1]]]),
            [
                'let c0 = || {',
                '    let c1: Any<A> = (Any::unary_plus(f64_any(0x3ff0000000000000)))?;',
                '    Any::number(c1)',
                '};',
                'Any::option_dot(Object::default().to_any(), c0).end()',
            ]),
        /** A literal operand is a thunk over the cast alone, named once it is a temporary. */
        optionDotLiteral: () => assertStructurallySame(
            scoped(['?.', ['{}', []], ['Number', 1]]),
            [
                'let c0 = || Any::number(f64_any(0x3ff0000000000000));',
                'Any::option_dot(Object::default().to_any(), c0).end()',
            ]),
        /** A `|.` step's key is lazy too. */
        step: () => assertStructurallySame(
            scoped(['?.', ['{}', []], 'a', ['|.', ['Number', ['+', 2]]]]),
            [
                'let c0 = || {',
                '    let c1: Any<A> = (Any::unary_plus(f64_any(0x4000000000000000)))?;',
                '    Any::number(c1)',
                '};',
                'Any::option_dot(Object::default().to_any(), || Ok(string_any("a"))).dot(c0).end()',
            ]),
    },
    throw: {
        /** An operation the printer has no `nanvm-lib` spelling for. */
        unknownOperation: () => printed(/** @type {Exp} */ (/** @type {unknown} */ (['==', 1, 2]))),
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
                printed(['.', ['{}', []], 'b', ['|()', []]]),
                'Any::dot(Object::default().to_any(), string_any("b")).end_call(&runtime, || Ok(Array::default().to_any()))')
        },
        /** `a.b?.(...c)`: `|?.()` opens a region the chain goes on inside, and `.end()` closes. */
        propertyOptionCall: () => {
            assertEq(
                printed(['.', ['{}', []], 'b', ['|?.()', []]]),
                'Any::dot(Object::default().to_any(), string_any("b")).option_call(&runtime, || Ok(Array::default().to_any())).end()')
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
            assertEq(printed(['?.', ['{}', []], 'b', ['|()', []]]), `${open}.call(&runtime, ${args}).end()`)
            assertEq(printed(['?.', ['{}', []], 'b', ['|?.()', []]]), `${open}.option_call(&runtime, ${args}).end()`)
            assertEq(printed(['?.', ['{}', []], 'b', ['|!()', []]]), `${open}.end_call(&runtime, ${args})`)
        },
        /**
         * `a?.(...c)`, `a?.(...c).d`, `a?.(...c)(...d)`, and the README's
         * `a?.b(...c).d(...e)`: the steps `optionLambda` admits, and a
         * chain through three states.
         */
        optionCall: () => {
            const open = 'Any::option_call(Nullish::Undefined.to_any(), || Ok(Array::default().to_any()))'
            const args = '|| Ok(Array::default().to_any())'
            assertEq(printed(['?.()', ['undefined'], []]), `${open}.end()`)
            assertEq(printed(['?.()', ['undefined'], [], ['|.', 'd']]), `${open}.dot(|| Ok(string_any("d"))).end()`)
            assertEq(printed(['?.()', ['undefined'], [], ['|()', []]]), `${open}.call(${args}).end()`)
            assertEq(
                printed(['?.', ['{}', []], 'b', ['|()', [], ['|.', 'd', ['|()', []]]]]),
                `Any::option_dot(Object::default().to_any(), || Ok(string_any("b"))).call(&runtime, ${args}).dot(|| Ok(string_any("d"))).call(&runtime, ${args}).end()`)
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
                printed(['.', ['.', ['{}', []], 'y', ['|()', []]], 'z']),
                'Any::dot(Any::dot(Object::default().to_any(), string_any("y")).end_call(&runtime, || Ok(Array::default().to_any())), string_any("z")).end()')
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
                printed(['?.()', ['undefined'], []]),
                'Any::option_call(Nullish::Undefined.to_any(), || Ok(Array::default().to_any())).end()')
            assertEq(
                printed(['.', null, 'a', ['|()', []]]),
                'Any::dot(Nullish::Null.to_any(), string_any("a")).end_call(&runtime, || Ok(Array::default().to_any()))')
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
                printed(['.', ['{}', []], 'b', ['|()', [['/', 1n, 0n]]]]),
                `Any::dot(Object::default().to_any(), string_any("b")).end_call(&runtime, ${thunk})`)
            assertStructurallySame(
                scoped(['.', ['{}', []], 'b', ['|()', [['/', 1n, 0n]]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (bigint_any(1) / bigint_any(0))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::dot(Object::default().to_any(), string_any("b")).end_call(&runtime, c0)',
                ])
            assertStructurallySame(
                scoped(['?.()', ['undefined'], [['-', 1]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::option_call(Nullish::Undefined.to_any(), c0).end()',
                ])
            assertStructurallySame(
                scoped(['?.', ['{}', []], 'b', ['|.', 'c', ['|()', [['-', 1]]]]]),
                [
                    'let c0 = || {',
                    '    let c1: Any<A> = (-(f64_any(0x3ff0000000000000)))?;',
                    '    Ok([c1].to_array().to_any())',
                    '};',
                    'Any::option_dot(Object::default().to_any(), || Ok(string_any("b"))).dot(|| Ok(string_any("c"))).call(&runtime, c0).end()',
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
         * binds in the block of the one thunk that owns it, or has no block
         * that may bind it — the same rule a node reached only through lazy
         * operands follows, an atom excepted as there — where one reached
         * eagerly as well is a temporary of the scope, and the thunk
         * answers its name.
         */
        sharing: () => {
            /** @type {Exp} */
            const one = ['[]', [1]]
            assertStructurallySame(scoped(['?.()', ['undefined'], [one, one]]), [
                'let c0 = || {',
                '    let c1: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
                '    Ok([c1.clone(), c1.clone()].to_array().to_any())',
                '};',
                'Any::option_call(Nullish::Undefined.to_any(), c0).end()',
            ])
            assert(scope(['[]', [['?.()', ['undefined'], [one]], ['?.()', ['undefined'], [one]]]])[0] === 'error')
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['?.()', ['undefined'], [c, c]]), [
                'let c0: Any<A> = Array::default().to_any();',
                'let c1 = || Ok([c0.clone(), c0.clone()].to_array().to_any());',
                'Any::option_call(Nullish::Undefined.to_any(), c1).end()',
            ])
            assertStructurallySame(
                scoped(['[]', [c, ['?.()', ['undefined'], [c]]]]),
                [
                    'let c0: Any<A> = Array::default().to_any();',
                    'let c1 = || Ok([c0.clone()].to_array().to_any());',
                    'let c2: Any<A> = Any::option_call(Nullish::Undefined.to_any(), c1).end()?;',
                    'Ok([c0.clone(), c2].to_array().to_any())',
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
            assertEq(eagerNodesOf(['.', c, 'a', ['|()', []]]).includes(c), true)
            assertEq(eagerNodesOf(['?.', c, 'a']).includes(c), true)
            assertEq(eagerNodesOf(['?.()', c, []]).includes(c), true)
            assertEq(eagerNodesOf(['.', ['{}', []], 'a', ['|()', [c]]]).includes(c), false)
            assertEq(eagerNodesOf(['?.()', ['undefined'], [c]]).includes(c), false)
            assertEq(eagerNodesOf(['?.', ['{}', []], 'a', ['|.', 'b', ['|()', [c]]]]).includes(c), false)
        },
        /**
         * A terminal step handed a continuation: the schema spells none,
         * and the printer refuses rather than dropping it.
         */
        refusedTerminalWithContinuation: () => {
            /** @type {readonly unknown[]} */
            const k = ['|()', [], ['|.', 'c']]
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
    },
    /**
     * Refusals met one step into a chain, each the inner node's own — an
     * object spread the printer cannot spell — surfacing
     * with the inner node's reason when it is printed, and never a reason
     * about the base's value, which the printer does not predict.
     */
    /**
     * A spread, in an array or a call's arguments, prints through the
     * `vm::unstable` helpers over `get_iterator`. It can throw, so the list
     * holding it is an operation: `spread_array(…)` or `spread_call(…)`, a
     * `Result` bound with `?` where it is a temporary, and an argument
     * list's thunk answers `spread_array`'s own `Result`.
     */
    spread: {
        array: () => {
            assertEq(
                printed(['[]', [1, ['...', 'ab']]]),
                'spread_array([value_item(f64_any(0x3ff0000000000000)), spread_item(string_any("ab"))])')
            assertStructurallySame(scoped(['[]', [['[]', [['...', 'ab']]], 3]]), [
                'let c0: Any<A> = spread_array([spread_item(string_any("ab"))])?;',
                'Ok([c0, f64_any(0x4008000000000000)].to_array().to_any())',
            ])
        },
        call: () => {
            assertEq(
                printed(['()', ['args'], [0, ['...', 'ab']]]),
                'spread_call(args.clone().to_any(), [value_item(f64_any(0x0000000000000000)), spread_item(string_any("ab"))])')
        },
        /** A call step's and an optional call's arguments are a thunk, answering `spread_array`'s `Result`. */
        thunks: () => {
            assertStructurallySame(scoped(['.', ['args'], 'at', ['|()', [['...', 'ab']]]]), [
                'let c0 = || spread_array([spread_item(string_any("ab"))]);',
                'Any::dot(args.clone().to_any(), string_any("at")).end_call(&runtime, c0)',
            ])
            assertEq(
                printed(['?.()', ['undefined'], [['...', 'ab']]]),
                'Any::option_call(Nullish::Undefined.to_any(), || spread_array([spread_item(string_any("ab"))])).end()')
        },
        /** Without a spread, nothing changes: the array is a value and the call `Any::call`. */
        noSpread: () => {
            assertEq(printed(['[]', ['...']]), '[string_any("...")].to_array().to_any()')
            assertEq(
                printed(['()', ['args'], ['...']]),
                'Any::call(args.clone().to_any(), [string_any("...")].to_array().to_any())')
        },
        /**
         * An object's spread is `spread_entries` beside `property_item`s,
         * through `object_spread`, which never throws: the object stays a
         * value, nested in a corpus expression as any value is.
         */
        object: () => {
            assertEq(
                printed(['{}', [[':', 'a', 1], ['...', 'bc']]]),
                'spread_object([property_item(string_key("a"), f64_any(0x3ff0000000000000)), spread_entries(string_any("bc"))])')
            assertEq(nestsOperation([])(['[]', [['{}', [['...', 'bc']]]]]), false)
            assertEq(printed(['{}', [[':', 'a', 1]]]), '[(string_key("a"), f64_any(0x3ff0000000000000))].to_object().to_any()')
        },
        /**
         * One pair object standing twice in a list reaches its operand twice:
         * a pair is no node, so its operand is counted per occurrence, a
         * temporary, and never moved twice — a spread in an array and in an
         * argument list's thunk, and a property in an object.
         */
        sharedPair: () => {
            /** @type {Exp} */
            const a = ['.', ['args'], 'a']
            /** @type {Spread} */
            const s = ['...', a]
            assertStructurallySame(scoped(['[]', [s, s]]), [
                'let c0: Any<A> = Any::dot(args.clone().to_any(), string_any("a")).end()?;',
                'spread_array([spread_item(c0.clone()), spread_item(c0.clone())])',
            ])
            assertStructurallySame(scoped(['.', ['args'], 'at', ['|()', [s, s]]]), [
                'let c0 = || {',
                '    let c1: Any<A> = Any::dot(args.clone().to_any(), string_any("a")).end()?;',
                '    spread_array([spread_item(c1.clone()), spread_item(c1.clone())])',
                '};',
                'Any::dot(args.clone().to_any(), string_any("at")).end_call(&runtime, c0)',
            ])
            /** @type {Property} */
            const p = [':', 'k', a]
            assertStructurallySame(scoped(['{}', [p, p]]), [
                'let c0: Any<A> = Any::dot(args.clone().to_any(), string_any("a")).end()?;',
                'Ok([(string_key("k"), c0.clone()), (string_key("k"), c0.clone())].to_object().to_any())',
            ])
        },
        /** A spread array nested in a corpus expression is an operation, as an operator is. */
        nestsOperation: () => {
            assertEq(nestsOperation([])(['[]', [['[]', [['...', 'ab']]]]]), true)
            assertEq(nestsOperation([])(['[]', [['[]', ['ab']]]]), false)
        },
    },
    chainRefusals: {
        /** An entry that is neither a property nor a spread is refused where the object is printed, the same one `notAProperty` (`fjs/nanvm/rust/proof.f.mjs`) pins. */
        dotOnObjectWithMalformedEntry: () => {
            assertStructurallySame(
                refusalReason(['.', ['.', ['{}', [/** @type {any} */ (['?', 'x'])]], 'y'], 'z']),
                ['not a property', ['?', 'x']])
        },
    },
}
