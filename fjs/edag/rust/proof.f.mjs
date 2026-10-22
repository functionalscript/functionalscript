/**
 * Proofs for EDAG admission through common FAST preparation and Rust spelling.
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

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { ok, unwrap } from '../../types/result/module.f.js'
import { bindingLine, braced, expExpr, expExprTagged, holdsFunction, needsRuntime, nodeExpr, readsArgs, readsFrame, readsSelf, restLine, scope, scopeTagged, statementsOf, useLines, useLinesTagged, helperExpr } from './module.f.mjs'
import { fromTagged, toText, untagged } from '../../text/marked/module.f.mjs'
import { unmarkedWords } from './unmarked/module.f.js'
import { conditional } from '../testlib.f.js'

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
        assertStructurallySame(scoped(loop), ["let _b2: Any<A> = A::static_function(|_self, _args| { Any::call(Function::new(_self.clone()).to_any(), Array::default().to_any()) }, 0, Array::default(), Some(\"(function $0(){return $0();})\")).to_any();","Ok(_b2.clone())"])
    },
    /**
     * The common converter recognizes `r => COND ? self(NEXT) : r` as a
     * normalized loop. Preparation supplies its state binding and test
     * region; Rust spells those as a `while`, preserving each condition
     * evaluation, required round value and state transition. The function
     * reads `_self` only for captures when recursion has become a loop.
     */
    loops: {
        counting: () => {
            assertStructurallySame(scoped(counting), ["Ok(A::static_function(|_self, _args| {","    let mut _b357: Any<A> = _args.argument(0);","    '_loop8: while Any::<A>::to_boolean({","        let _b358: Any<A> = _b357.clone();","        (Any::lt(_b358.clone(), f64_any(0x4024000000000000)))?","    }) {","        let _b355: Any<A> = _b357.clone();","        let _b359: Any<A> = (_b355.clone() + f64_any(0x3ff0000000000000))?;","        _b357 = _b359.clone();","    }","    let _b356: Any<A> = _b357;","    Ok(_b356.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+1;$1=$4;}return $1;}\")).to_any())"])
            assertStructurallySame(usedBy(counting), { vm: ['Array', 'ToAny'], unstable: ['f64_any'] })
            // the same closure where it stands as an expression
            assertEq(printed(counting).split('\n')[2], "    '_loop8: while Any::<A>::to_boolean({")
        },
        // the asserts are the round's discarded temporaries, the next
        // value being the variable, no assignment — and no `mut`, which
        // `rustc` would warn of; the condition's own temporaries precede
        // the test, a comma's included
        asserts: () => {
            assertStructurallySame(scoped(loop(true, [',', [['+', 1, 2], ['[]', [['arg', 0]]], call(['arg', 0])]])), ["Ok(A::static_function(|_self, _args| {","    let _b432: Any<A> = _args.argument(0);","    '_loop9: while Any::<A>::to_boolean({","        let _b433: Any<A> = _b432.clone();","        true.to_any()","    }) {","        let _b406: Any<A> = _b432.clone();","        let _b430: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;","        let _b431: Any<A> = [_b406.clone()].to_array().to_any();","    }","    let _b407: Any<A> = _b432;","    Ok(_b407.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return true;})()){const $3=$1;const $4=1+2;const $5=[$3];}return $1;}\")).to_any())"])
            assertStructurallySame(scoped(loop([',', [['+', 1, 2], true]], call(1))), ["Ok(A::static_function(|_self, _args| {","    let mut _b281: Any<A> = _args.argument(0);","    '_loop6: while Any::<A>::to_boolean({","        let _b282: Any<A> = _b281.clone();","        let _b280: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;","        true.to_any()","    }) {","        let _b259: Any<A> = _b281.clone();","        let _b283: Any<A> = f64_any(0x3ff0000000000000);","        _b281 = _b283.clone();","    }","    let _b260: Any<A> = _b281;","    Ok(_b260.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;const $3=1+2;return true;})()){const $4=$1;const $5=1;$1=$5;}return $1;}\")).to_any())"])
        },
        // a next value that throws is assigned as any is: the `Err` the
        // round's `?` returns, so the loop throws where the recursion threw
        throwing: () => {
            assertStructurallySame(scoped(loop(true, call(['throw', 1]))), ["Ok(A::static_function(|_self, _args| {","    let mut _b216: Any<A> = _args.argument(0);","    '_loop5: while Any::<A>::to_boolean({","        let _b217: Any<A> = _b216.clone();","        true.to_any()","    }) {","        let _b214: Any<A> = _b216.clone();","        let _b218: Any<A> = (Err::<Any<A>, Any<A>>(f64_any(0x3ff0000000000000)))?;","        _b216 = _b218.clone();","    }","    let _b215: Any<A> = _b216;","    Ok(_b215.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return true;})()){const $3=$1;const $4=(()=>{throw 1;})();$1=$4;}return $1;}\")).to_any())"])
        },
        // a frame read is the one read of `self_`; the argument read twice
        // is one temporary of the round, as any shared atom is; an argument
        // past the length is read as any argument is
        reads: () => {
            assertEq(scope(['=>', 1, [], ['?:', ['arg', 1], call(['arg', 1]), ['arg', 0]]])[0], 'error')
            assertStructurallySame(scoped(['=>', 1, [1, 2], ['?:', ['frame', 0], call(['frame', 1]), ['arg', 0]]]), ["Ok(A::static_function(|_self, _args| {","    let mut _b275: Any<A> = _args.argument(0);","    '_loop6: while Any::<A>::to_boolean({","        let _b276: Any<A> = _b275.clone();","        A::frame(_self)[0].clone()","    }) {","        let _b259: Any<A> = _b275.clone();","        let _b277: Any<A> = A::frame(_self)[1].clone();","        _b275 = _b277.clone();","    }","    let _b260: Any<A> = _b275;","    Ok(_b260.clone())","}, 1, [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array(), Some(\"($2)=>{let $3=$2;while((()=>{const $4=$3;return $0;})()){const $5=$3;const $6=$1;$3=$6;}return $3;}\")).to_any())"])
            /** @type {Exp} */
            const a = ['arg', 0]
            assertStructurallySame(scoped(['=>', 1, [], ['?:', ['<', a, 10], call(['+', a, a]), a]]), ["Ok(A::static_function(|_self, _args| {","    let mut _b261: Any<A> = _args.argument(0);","    '_loop6: while Any::<A>::to_boolean({","        let _b262: Any<A> = _b261.clone();","        (Any::lt(_b262.clone(), f64_any(0x4024000000000000)))?","    }) {","        let _b259: Any<A> = _b261.clone();","        let _b263: Any<A> = (_b259.clone() + _b259.clone())?;","        _b261 = _b263.clone();","    }","    let _b260: Any<A> = _b261;","    Ok(_b260.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+$3;$1=$4;}return $1;}\")).to_any())"])
        },
        // the recognizer is asked of the function's own table: a fragment
        // that has none — a slot shared with the body, across the
        // function's own boundary — is no loop, and a comma around the
        // body holding the `?:` alone is the loop's body
        table: () => {
            /** @type {Exp} */
            const s = ['[]', [1]]
            assertEq(scope(['=>', 1, [s], ['?:', s, call(1), ['arg', 0]]])[0], 'error')
            assertEq(scoped(['=>', 1, [], [',', [['?:', true, call(1), ['arg', 0]]]]])[2], "    '_loop5: while Any::<A>::to_boolean({")
        },
        /** Calling a recognized loop function preserves the function boundary. */
        calls: {
            // The callee contains the prepared loop; the scope answers its call.
            root: () => {
                assertStructurallySame(scoped(['()', counting, [0]]), ["let _b8: Any<A> = A::static_function(|_self, _args| {","    let mut _b366: Any<A> = _args.argument(0);","    '_loop8: while Any::<A>::to_boolean({","        let _b367: Any<A> = _b366.clone();","        (Any::lt(_b367.clone(), f64_any(0x4024000000000000)))?","    }) {","        let _b364: Any<A> = _b366.clone();","        let _b368: Any<A> = (_b364.clone() + f64_any(0x3ff0000000000000))?;","        _b366 = _b368.clone();","    }","    let _b365: Any<A> = _b366;","    Ok(_b365.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+1;$1=$4;}return $1;}\")).to_any();","Any::call(_b8.clone(), [f64_any(0x0000000000000000)].to_array().to_any())"])
                assertStructurallySame(usedBy(['()', counting, [0]]), {"vm":["Array","ToAny","ToArray"],"unstable":["f64_any"]})
            },
            // a temporary referenced twice, cloned as any is; and one in a
            // thunk's block, bound there
            referenced: () => {
                /** @type {Exp} */
                const c = ['()', counting, [0]]
                assertEq(scoped(['[]', [c, c]]).at(-1), "Ok([_b9.clone(), _b9.clone()].to_array().to_any())")
                assertStructurallySame(scoped(conditional('&&', true, ['[]', [c]])), ["if Any::<A>::to_boolean(true.to_any()) {","    let _b8: Any<A> = A::static_function(|_self, _args| {","        let mut _b384: Any<A> = _args.argument(0);","        '_loop8: while Any::<A>::to_boolean({","            let _b385: Any<A> = _b384.clone();","            (Any::lt(_b385.clone(), f64_any(0x4024000000000000)))?","        }) {","            let _b382: Any<A> = _b384.clone();","            let _b386: Any<A> = (_b382.clone() + f64_any(0x3ff0000000000000))?;","            _b384 = _b386.clone();","        }","        let _b383: Any<A> = _b384;","        Ok(_b383.clone())","    }, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+1;$1=$4;}return $1;}\")).to_any();","    Ok([(Any::call(_b8.clone(), [f64_any(0x0000000000000000)].to_array().to_any()))?].to_array().to_any())","} else { Ok(true.to_any()) }"])
            },
            // a slot is a temporary of the scope around, an atom too, bound
            // once as a frame is built once, and cloned at every read; a
            // primitive slot is read as its literal; a slot shared with the
            // scope is the one temporary
            slots: () => {
                assertStructurallySame(scoped(['()', ['=>', 1, [['[]', []], 5], ['?:', ['frame', 0], call(['frame', 1]), ['arg', 0]]], [1]]), ["let _b0: Any<A> = Array::default().to_any();","let _b7: Any<A> = A::static_function(|_self, _args| {","    let mut _b330: Any<A> = _args.argument(0);","    '_loop7: while Any::<A>::to_boolean({","        let _b331: Any<A> = _b330.clone();","        A::frame(_self)[0].clone()","    }) {","        let _b314: Any<A> = _b330.clone();","        let _b332: Any<A> = A::frame(_self)[1].clone();","        _b330 = _b332.clone();","    }","    let _b315: Any<A> = _b330;","    Ok(_b315.clone())","}, 1, [_b0.clone(), f64_any(0x4014000000000000)].to_array(), Some(\"($2)=>{let $3=$2;while((()=>{const $4=$3;return $0;})()){const $5=$3;const $6=$1;$3=$6;}return $3;}\")).to_any();","Any::call(_b7.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any())"])
                /** @type {Exp} */
                const shared = ['+', 1, 2]
                assertStructurallySame(scoped(['[]', [shared, ['()', ['=>', 1, [shared], ['?:', ['frame', 0], call(['frame', 0]), ['arg', 0]]], [1]]]]), ["let _b0: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;","let _b7: Any<A> = A::static_function(|_self, _args| {","    let mut _b337: Any<A> = _args.argument(0);","    '_loop7: while Any::<A>::to_boolean({","        let _b338: Any<A> = _b337.clone();","        A::frame(_self)[0].clone()","    }) {","        let _b322: Any<A> = _b337.clone();","        let _b339: Any<A> = A::frame(_self)[0].clone();","        _b337 = _b339.clone();","    }","    let _b323: Any<A> = _b337;","    Ok(_b323.clone())","}, 1, [_b0.clone()].to_array(), Some(\"($1)=>{let $2=$1;while((()=>{const $3=$2;return $0;})()){const $4=$2;const $5=$0;$2=$5;}return $2;}\")).to_any();","Ok([_b0.clone(), (Any::call(_b7.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any()))?].to_array().to_any())"])
            },
            // A nested helper captures its enclosing function's argument.
            body: () => {
                assertStructurallySame(scoped(['=>', 1, [], ['()', ['=>', 1, [['arg', 0]], ['?:', ['<', ['arg', 0], ['frame', 0]], call(['+', ['arg', 0], 1]), ['arg', 0]]], [0]]]), ["Ok(A::static_function(|_self, _args| {","    let _b10: Any<A> = A::static_function(|_self, _args| {","        let mut _b554: Any<A> = _args.argument(0);","        '_loop10: while Any::<A>::to_boolean({","            let _b555: Any<A> = _b554.clone();","            (Any::lt(_b555.clone(), A::frame(_self)[0].clone()))?","        }) {","            let _b481: Any<A> = _b554.clone();","            let _b556: Any<A> = (_b481.clone() + f64_any(0x3ff0000000000000))?;","            _b554 = _b556.clone();","        }","        let _b482: Any<A> = _b554;","        Ok(_b482.clone())","    }, 1, [_args.argument(0)].to_array(), Some(\"($1)=>{let $2=$1;while((()=>{const $3=$2;return $3<$0;})()){const $4=$2;const $5=$4+1;$2=$5;}return $2;}\")).to_any();","    Any::call(_b10.clone(), [f64_any(0x0000000000000000)].to_array().to_any())","}, 1, Array::default(), Some(\"($0)=>{const $1=($2)=>{let $3=$2;while((()=>{const $4=$3;return $4<$0;})()){const $5=$3;const $6=$5+1;$3=$6;}return $3;};return $1(0);}\")).to_any())"])
            },
            // An inner loop function captures the outer round's current
            // value; prepared identities keep their bindings distinct.
            nested: () => {
                /** @type {Exp} */
                const inner = ['=>', 1, [['arg', 0]], ['?:', ['<', ['arg', 0], ['+', ['frame', 0], 1]], call(['+', ['arg', 0], 1]), ['arg', 0]]]
                assertStructurallySame(scoped(['()', loop(['<', ['arg', 0], 10], call(['()', inner, [['arg', 0]]])), [0]]), ["let _b20: Any<A> = A::static_function(|_self, _args| {","    let mut _b1122: Any<A> = _args.argument(0);","    '_loop20: while Any::<A>::to_boolean({","        let _b1123: Any<A> = _b1122.clone();","        (Any::lt(_b1123.clone(), f64_any(0x4024000000000000)))?","    }) {","        let _b1120: Any<A> = _b1122.clone();","        let _b14: Any<A> = A::static_function(|_self, _args| {","            let mut _b1124: Any<A> = _args.argument(0);","            '_loop14: while Any::<A>::to_boolean({","                let _b1125: Any<A> = _b1124.clone();","                (Any::lt(_b1125.clone(), (A::frame(_self)[0].clone() + f64_any(0x3ff0000000000000))?))?","            }) {","                let _b796: Any<A> = _b1124.clone();","                let _b1126: Any<A> = (_b796.clone() + f64_any(0x3ff0000000000000))?;","                _b1124 = _b1126.clone();","            }","            let _b797: Any<A> = _b1124;","            Ok(_b797.clone())","        }, 1, [_b1120.clone()].to_array(), Some(\"($1)=>{let $2=$1;while((()=>{const $3=$2;return $3<$0+1;})()){const $4=$2;const $5=$4+1;$2=$5;}return $2;}\")).to_any();","        let _b1127: Any<A> = (Any::call(_b14.clone(), [_b1120.clone()].to_array().to_any()))?;","        _b1122 = _b1127.clone();","    }","    let _b1121: Any<A> = _b1122;","    Ok(_b1121.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=($5)=>{let $6=$5;while((()=>{const $7=$6;return $7<$3+1;})()){const $8=$6;const $9=$8+1;$6=$9;}return $6;};const $10=$4($3);$1=$10;}return $1;}\")).to_any();","Any::call(_b20.clone(), [f64_any(0x0000000000000000)].to_array().to_any())"])
                // and in the round of a loop held as a value
                assertStructurallySame(scoped(loop(['<', ['arg', 0], 10], call(['()', inner, [['arg', 0]]]))), ["Ok(A::static_function(|_self, _args| {","    let mut _b1101: Any<A> = _args.argument(0);","    '_loop20: while Any::<A>::to_boolean({","        let _b1102: Any<A> = _b1101.clone();","        (Any::lt(_b1102.clone(), f64_any(0x4024000000000000)))?","    }) {","        let _b1099: Any<A> = _b1101.clone();","        let _b14: Any<A> = A::static_function(|_self, _args| {","            let mut _b1103: Any<A> = _args.argument(0);","            '_loop14: while Any::<A>::to_boolean({","                let _b1104: Any<A> = _b1103.clone();","                (Any::lt(_b1104.clone(), (A::frame(_self)[0].clone() + f64_any(0x3ff0000000000000))?))?","            }) {","                let _b781: Any<A> = _b1103.clone();","                let _b1105: Any<A> = (_b781.clone() + f64_any(0x3ff0000000000000))?;","                _b1103 = _b1105.clone();","            }","            let _b782: Any<A> = _b1103;","            Ok(_b782.clone())","        }, 1, [_b1099.clone()].to_array(), Some(\"($1)=>{let $2=$1;while((()=>{const $3=$2;return $3<$0+1;})()){const $4=$2;const $5=$4+1;$2=$5;}return $2;}\")).to_any();","        let _b1106: Any<A> = (Any::call(_b14.clone(), [_b1099.clone()].to_array().to_any()))?;","        _b1101 = _b1106.clone();","    }","    let _b1100: Any<A> = _b1101;","    Ok(_b1100.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=($5)=>{let $6=$5;while((()=>{const $7=$6;return $7<$3+1;})()){const $8=$6;const $9=$8+1;$6=$9;}return $6;};const $10=$4($3);$1=$10;}return $1;}\")).to_any())"])
            },
            // An out-of-range fixed binding is refused by admission. A
            // transition to the current value needs no assignment or mut.
            arguments: () => {
                assertEq(scope(['()', ['=>', 1, [], ['?:', ['arg', 1], call(['arg', 1]), ['arg', 0]]], [1]])[0], 'error')
                assertStructurallySame(scoped(['()', loop(true, [',', [['+', 1, 2], call(['arg', 0])]]), [1]]), ["let _b7: Any<A> = A::static_function(|_self, _args| {","    let _b379: Any<A> = _args.argument(0);","    '_loop7: while Any::<A>::to_boolean({","        let _b380: Any<A> = _b379.clone();","        true.to_any()","    }) {","        let _b314: Any<A> = _b379.clone();","        let _b378: Any<A> = (f64_any(0x3ff0000000000000) + f64_any(0x4000000000000000))?;","    }","    let _b315: Any<A> = _b379;","    Ok(_b315.clone())","}, 1, Array::default(), Some(\"($0)=>{let $1=$0;while((()=>{const $2=$1;return true;})()){const $3=$1;const $4=1+2;}return $1;}\")).to_any();","Any::call(_b7.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any())"])
            },
            // Different argument lists, spreads, sharing and guarded call
            // positions use the same prepared function construction path.
            closure: () => {
                /** @type {Exp} */
                const held = counting
                /** @type {readonly Exp[]} */
                const cases = [
                    ['()', counting, [1, 2]],
                    ['()', counting, []],
                    ['()', counting, [['...', ['[]', []]]]],
                    ['[]', [held, ['()', held, [1]]]],
                    ['()', ['=>', 1, [], ['?:', ['rest'], call(1), ['arg', 0]]], [1]],
                    ['()', ['=>', 1, [], ['arg', 0]], [1]],
                    conditional('&&', true, ['()', counting, [1]]),
                    [',', [['()', counting, [1]], 1]],
                ]
                for (const e of cases) { assert(scoped(e).some(line => line.includes('A::static_function(')), JSON.stringify(e)) }
                const emitted = printed(['()', counting, [0]])
                assert(emitted.includes('A::static_function(') && emitted.includes('Any::call('))
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
            assertStructurallySame(scoped(loop(['.', minted, 0], call(['.', minted, 'length']))), ["let _b8: Any<A> = A::static_function(|_self, _args| {","    let _b1: Any<A> = [_args.argument(0)].to_array().to_any();","    if Any::<A>::to_boolean((Any::dot(_b1.clone(), f64_any(0x0000000000000000)).end())?) { Any::call(Function::new(_self.clone()).to_any(), [(Any::dot(_b1.clone(), string_any(\"length\")).end())?].to_array().to_any()) } else { Ok(_args.argument(0)) }","}, 1, Array::default(), Some(\"(function $0($1){const $2=[$1];return $2[0]?$0($2.length):$1;})\")).to_any();","Ok(_b8.clone())"])
            /** @type {Exp} */
            const n = ['+', ['arg', 0], 1]
            assertStructurallySame(scoped(loop(['<', n, 10], call(n))).slice(2, 8), ["    '_loop7: while Any::<A>::to_boolean({","        let _b309: Any<A> = _b308.clone();","        (Any::lt((_b309.clone() + f64_any(0x3ff0000000000000))?, f64_any(0x4024000000000000)))?","    }) {","        let _b306: Any<A> = _b308.clone();","        let _b310: Any<A> = (_b306.clone() + f64_any(0x3ff0000000000000))?;"])
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
            assertStructurallySame(usedBy(['()', ['args'], [['...', ['args']]]]), {"vm":["ToAny"],"unstable":["spread_array","spread_item"]})
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
            assertStructurallySame(usedBy(['=>', 1, [], ['[]', [['arg', 0], ['rest']]]]), {
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
        assert(text.includes('_args.rest(3).to_any()'))
        assert(text.includes('}, 3, Array::default(), Some("($0,$1,$2,...$3)=>[$0,$2,$3]")).to_any()'))
    },
    /**
     * Common preparation supplies a Result scope over the caller's names.
     * An external binding is read directly, while an unbound nested operation
     * propagates failure where it executes.
     */
    preparedScopes: () => {
        /** @type {Exp} */
        const inner = ['*', 2, 3]
        assertStructurallySame(unwrap(statementsOf([])(['+', inner, 1])), ["(f64_any(0x4000000000000000) * f64_any(0x4008000000000000))? + f64_any(0x3ff0000000000000)"])
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
        assertEq(printed(['-', 1]), "<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000))")
        assertEq(printed(['+', 1]), 'Any::unary_plus(f64_any(0x3ff0000000000000))')
        assertEq(
            printed(['?:', true, 1, 2]),
            "if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { Ok(f64_any(0x4000000000000000)) }")
        assertEq(printed(['=>', 0, [], ['undefined']]), "A::static_function(|_self, _args| { Ok(Nullish::Undefined.to_any()) }, 0, Array::default(), Some(\"()=>undefined\")).to_any()")
        assertEq(printed(['*', 1, 2]), 'f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)')
    },
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
    /**
     * The `entry` helper as a value: the static function every function
     * is, its body `Any::entry` of its two fixed arguments, under the text
     * the writer gives the helper.
     */
    entry: () => {
        assertEq(printed(['entry']), "A::static_function(|_self, _args| Any::entry(_args.argument(0), _args.argument(1)), 2, Array::default(), Some(\"($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}\")).to_any()")
        assertEq(printed(['()', ['entry'], [1, 2]]), "{\n    let _b0: Any<A> = A::static_function(|_self, _args| Any::entry(_args.argument(0), _args.argument(1)), 2, Array::default(), Some(\"($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}\")).to_any();\n    Any::call(_b0.clone(), [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array().to_any())\n}")
        // `hasEntry` the same, its `bool` made an `Any`
        assertEq(printed(['hasEntry']), "A::static_function(|_self, _args| Any::has_entry(_args.argument(0), _args.argument(1)).map(|v| v.to_any()), 2, Array::default(), Some(\"($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;}\")).to_any()")
        // an intrinsic: the closure answering the member call of the name
        // on its first argument with the rest, the library's call step
        assertEq(printed(['charCodeAt']), "A::static_function(|_self, _args| Any::dot(_args.argument(0), string_any(\"charCodeAt\")).end_call_native(|| Ok([_args.argument(1)].to_array().to_any())), 2, Array::default(), Some(\"($0,$1)=>$0.charCodeAt($1)\")).to_any()")
        assertEq(printed(['slice']), "A::static_function(|_self, _args| Any::dot(_args.argument(0), string_any(\"slice\")).end_call_native(|| Ok([_args.argument(1), _args.argument(2)].to_array().to_any())), 3, Array::default(), Some(\"($0,$1,$2)=>$0.slice($1,$2)\")).to_any()")
    },
    /**
     * A shared operation established inside a lazy region — read eagerly
     * there, in a condition, and again as an arm of that condition — is a
     * temporary of the region's block, bound once before the condition
     * as the `const` it lowers from is, and the arm answers it by name;
     * a region nested in that one reads the same binding and binds nothing
     * again. At the scope's own level the same shape binds the same way.
     * A body's early return leaves this shape: everything after the
     * return is one arm, and a `const` after it is established inside.
     */
    sharedInRegion: () => {
        /** @type {Exp} */
        const x = ['-', 5, 2]
        assertStructurallySame(scoped(['?:', true, ['?:', ['<', x, 1], x, 2], 3]), ["if Any::<A>::to_boolean(true.to_any()) {","    let _b0: Any<A> = (f64_any(0x4014000000000000) - f64_any(0x4000000000000000))?;","    if Any::<A>::to_boolean((Any::lt(_b0.clone(), f64_any(0x3ff0000000000000)))?) { Ok(_b0.clone()) } else { Ok(f64_any(0x4000000000000000)) }","} else { Ok(f64_any(0x4008000000000000)) }"])
        /** @type {Exp} */
        const y = ['-', 7, 1]
        assertStructurallySame(scoped(['?:', true, ['?:', ['<', y, 1], ['?:', ['>', y, 0], y, 4], 2], 3]), ["if Any::<A>::to_boolean(true.to_any()) {","    let _b0: Any<A> = (f64_any(0x401c000000000000) - f64_any(0x3ff0000000000000))?;","    if Any::<A>::to_boolean((Any::lt(_b0.clone(), f64_any(0x3ff0000000000000)))?) { if Any::<A>::to_boolean((Any::gt(_b0.clone(), f64_any(0x0000000000000000)))?) { Ok(_b0.clone()) } else { Ok(f64_any(0x4010000000000000)) } } else { Ok(f64_any(0x4000000000000000)) }","} else { Ok(f64_any(0x4008000000000000)) }"])
        /** @type {Exp} */
        const z = ['-', 9, 1]
        assertStructurallySame(scoped(['?:', ['<', z, 1], z, 2]), ["let _b0: Any<A> = (f64_any(0x4022000000000000) - f64_any(0x3ff0000000000000))?;","if Any::<A>::to_boolean((Any::lt(_b0.clone(), f64_any(0x3ff0000000000000)))?) { Ok(_b0.clone()) } else { Ok(f64_any(0x4000000000000000)) }"])
    },
    /**
     * A static function as a value — `Object.is` — is read from the
     * runtime value by its path, `static_read(&runtime, "Object.is")?`,
     * the one closure the value holds, so every read is the same
     * function. An atom with a `?` of its own: a thunk over it is
     * `|| Ok(…)`; shared, it is one temporary.
     */
    objectIs: () => {
        assertEq(printed(['Object.is']), "(static_read(&runtime, \"Object.is\"))?")
        assertStructurallySame(scoped(['()', ['Object.is'], [1, 2]]), ["let _b0: Any<A> = (static_read(&runtime, \"Object.is\"))?;","Any::call(_b0.clone(), [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array().to_any())"])
        /** @type {Exp} */
        const is = ['Object.is']
        assertStructurallySame(scoped(['[]', [is, is]]), ["let _b0: Any<A> = (static_read(&runtime, \"Object.is\"))?;","Ok([_b0.clone(), _b0.clone()].to_array().to_any())"])
        assertStructurallySame(usedBy(['()', ['Object.is'], [1, 2]]), { vm: ['ToAny', 'ToArray'], unstable: ['f64_any', 'static_read'] })
        assertStructurallySame(scoped(['Object.is']), ['static_read(&runtime, "Object.is")'])
        // a function reading a static holds the runtime in its frame, one
        // slot after its own, and reads the static through it
        assertStructurallySame(scoped(['=>', 0, [], ['Object.is']]), ["Ok(A::static_function(|_self, _args| { static_read(&A::frame(_self)[0], \"Object.is\") }, 0, [runtime.clone()].to_array(), Some(\"()=>Object.is\")).to_any())"])
        assertStructurallySame(scoped(conditional('&&', true, ['Object.is'])), ["if Any::<A>::to_boolean(true.to_any()) { static_read(&runtime, \"Object.is\") } else { Ok(true.to_any()) }"])
        // a thunk's answer is the static's read where the scope binds
        // nothing, or binds other temporaries; a shared static bound before
        // the thunk is read once, and the thunk answers the temporary
        assertStructurallySame(scoped(conditional('&&', ['Object.is'], conditional('&&', true, ['Number.isNaN']))), ["let _b0: Any<A> = (static_read(&runtime, \"Object.is\"))?;","if Any::<A>::to_boolean(_b0.clone()) { if Any::<A>::to_boolean(true.to_any()) { static_read(&runtime, \"Number.isNaN\") } else { Ok(true.to_any()) } } else { Ok(_b0.clone()) }"])
        assertStructurallySame(scoped(conditional('&&', is, conditional('&&', true, is))), ["let _b0: Any<A> = (static_read(&runtime, \"Object.is\"))?;","if Any::<A>::to_boolean(_b0.clone()) { if Any::<A>::to_boolean(true.to_any()) { Ok(_b0.clone()) } else { Ok(true.to_any()) } } else { Ok(_b0.clone()) }"])
        // with no runtime in scope, the runtime module's own, a static is
        // refused, and a member call with it: the core may not use what it
        // defines. The one native static the core lists as itself,
        // `Object.entries`, is the closure over `Any::entries`, under the
        // built-in's text.
        assertStructurallySame(printedWithout(['Object.is']), ['error', ['a static function read with no runtime in scope; the core may not use what it defines', 'Object.is']])
        assertStructurallySame(printedWithout(['.', ['{}', []], 'b', ['|()', []]]), ['error', ['a member call with no runtime in scope; the core may not use what it defines', ['|()', []]]])
        assertStructurallySame(printedWithout(['Object.entries']), ok('A::static_function(|_self, _args| Any::entries(_args.argument(0)), 1, Array::default(), Some("function entries() { [native code] }")).to_any()'))
        // every static is its accessor, named as Rust spells the name
        assertEq(printed(['Number.isSafeInteger']), "(static_read(&runtime, \"Number.isSafeInteger\"))?")
        assertStructurallySame(scoped(['()', ['Number.isInteger'], [1]]), ["let _b0: Any<A> = (static_read(&runtime, \"Number.isInteger\"))?;","Any::call(_b0.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any())"])
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
     * Canonical conditional regions become Rust `if` expressions.
     * Nested operations propagate their Result only
     * within the selected region, including inside returned containers.
     */
    lazy: () => {
        assertEq(
            printed(conditional('&&', false, 1)),
            "if Any::<A>::to_boolean(false.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { Ok(false.to_any()) }")
        assertEq(
            printed(conditional('||', true, 1)),
            "if Any::<A>::to_boolean(true.to_any()) { Ok(true.to_any()) } else { Ok(f64_any(0x3ff0000000000000)) }")
        assertEq(
            printed(conditional('??', null, 1)),
            "if Any::<A>::to_boolean(if Any::<A>::to_boolean((strict_eq(Nullish::Null.to_any(), Nullish::Null.to_any()))?) { true.to_any() } else { (strict_eq(Nullish::Null.to_any(), Nullish::Undefined.to_any()))? }) { Ok(f64_any(0x3ff0000000000000)) } else { Ok(Nullish::Null.to_any()) }")
        // `false && (1n / 0n)`: the throwing operation stays inside the
        // unselected branch, whether the statement is bare or propagating.
        assertEq(
            printed(conditional('&&', false, ['/', 1n, 0n])),
            "if Any::<A>::to_boolean(false.to_any()) { bigint_any(1) / bigint_any(0) } else { Ok(false.to_any()) }")
        // The right operand remains in its selected conditional region.
        assertStructurallySame(
            scoped(conditional('&&', false, ['/', 1n, 0n])),
            ["if Any::<A>::to_boolean(false.to_any()) { bigint_any(1) / bigint_any(0) } else { Ok(false.to_any()) }"])
        // Nested expressions propagate failure only inside their branch,
        // whether that branch returns an operation or a container.
        const nestedRegion = '(f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))? * f64_any(0x4008000000000000)'
        assertEq(
            printed(conditional('&&', false, ['*', ['*', 1, 2], 3])),
            `if Any::<A>::to_boolean(false.to_any()) { ${nestedRegion} } else { Ok(false.to_any()) }`)
        assertStructurallySame(
            scoped(conditional('&&', false, ['*', ['*', 1, 2], 3])),
            ["if Any::<A>::to_boolean(false.to_any()) { (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))? * f64_any(0x4008000000000000) } else { Ok(false.to_any()) }"])
        const arrayRegion = 'Ok([(bigint_any(1) / bigint_any(0))?].to_array().to_any())'
        assertEq(
            printed(conditional('&&', false, ['[]', [['/', 1n, 0n]]])),
            `if Any::<A>::to_boolean(false.to_any()) { ${arrayRegion} } else { Ok(false.to_any()) }`)
        assertStructurallySame(
            scoped(conditional('&&', false, ['[]', [['/', 1n, 0n]]])),
            ["if Any::<A>::to_boolean(false.to_any()) { Ok([(bigint_any(1) / bigint_any(0))?].to_array().to_any()) } else { Ok(false.to_any()) }"])
        // A `.` read is an operation too, and a container is a value.
        assertStructurallySame(
            scoped(conditional('||', true, ['.', ['{}', []], 'a'])),
            ["if Any::<A>::to_boolean(true.to_any()) { Ok(true.to_any()) } else { Any::dot(Object::default().to_any(), string_any(\"a\")).end() }"])
        assertEq(
            printed(conditional('||', true, ['[]', [['-', 1]]])),
            "if Any::<A>::to_boolean(true.to_any()) { Ok(true.to_any()) } else { Ok([(<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?].to_array().to_any()) }")
        // Each conditional arm keeps its own Result boundary, including
        // another conditional nested inside that arm.
        assertStructurallySame(
            scoped(['?:', true, 1, ['/', 1n, 0n]]),
            ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { bigint_any(1) / bigint_any(0) }"])
        // A throw is the selected arm's Err, or the scope's own Err.
        assertStructurallySame(
            scoped(['?:', true, 1, ['throw', 2]]),
            ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { Err(f64_any(0x4000000000000000)) }"])
        // The thrown value is evaluated before constructing the failure.
        assertStructurallySame(scoped(['throw', ['[]', [1]]]), ["Err([f64_any(0x3ff0000000000000)].to_array().to_any())"])
        assertEq(
            printed(['?:', conditional('&&', true, false), conditional('||', false, 1), 2]),
            "if Any::<A>::to_boolean(if Any::<A>::to_boolean(true.to_any()) { false.to_any() } else { true.to_any() }) { if Any::<A>::to_boolean(false.to_any()) { Ok(false.to_any()) } else { Ok(f64_any(0x3ff0000000000000)) } } else { Ok(f64_any(0x4000000000000000)) }")
        assertStructurallySame(
            scoped(['?:', conditional('&&', true, false), conditional('||', false, ['[]', [['-', 1]]]), 2]),
            ["if Any::<A>::to_boolean(if Any::<A>::to_boolean(true.to_any()) { false.to_any() } else { true.to_any() }) { if Any::<A>::to_boolean(false.to_any()) { Ok(false.to_any()) } else { Ok([(<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?].to_array().to_any()) } } else { Ok(f64_any(0x4000000000000000)) }"])
        // The first operand is eager, and composed where its rendering
        // would otherwise re-associate — exactly as an eager operator's.
        assertEq(
            printed(conditional('&&', ['*', 1, 2], 3)),
            "{\n    let _b0: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;\n    if Any::<A>::to_boolean(_b0.clone()) { Ok(f64_any(0x4008000000000000)) } else { Ok(_b0.clone()) }\n}")
        assertStructurallySame(
            scoped(conditional('&&', ['*', 1, 2], 3)),
            ["let _b0: Any<A> = (f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?;","if Any::<A>::to_boolean(_b0.clone()) { Ok(f64_any(0x4008000000000000)) } else { Ok(_b0.clone()) }"])
    },
    /** A composed operand keeps its parentheses; an atomic one does not. */
    nesting: () => {
        assertEq(
            printed(['*', 1, ['*', 2, 3]]),
            "f64_any(0x3ff0000000000000) * (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))?")
        assertEq(printed(['-', ['undefined']]), "<Any<A> as core::ops::Neg>::neg(Nullish::Undefined.to_any())")
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
            "<Any<A> as core::ops::Neg>::neg((Any::dot(Object::default().to_any(), string_any(\"b\")).end())?)")
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
            "Any::dot((Any::dot(Object::default().to_any(), string_any(\"missing\")).end())?, string_any(\"x\")).end()")
        // A function's `length` is a number, and a read on a number is
        // `undefined`: `f.length.x` prints, as the VM answers it.
        assertEq(
            printed(['.', ['.', ['=>', 0, [], 1], 'length'], 'x']),
            "Any::dot((Any::dot(A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some(\"()=>1\")).to_any(), string_any(\"length\")).end())?, string_any(\"x\")).end()")
    },
    /**
     * `,` — new relative to the operator-test printer, whose corpus has no
     * anchored, unreached roots. Every operand is established, in the order
     * `fjs/compiler/edag/module.f.mjs`'s `resolve` puts them in (imports, then
     * unreached `const`s, then the export), and the last one's value is the
     * whole node's.
     */
    comma: () => {
        assertEq(printed([',', [1, 2]]), "{\n    let _b34: Any<A> = f64_any(0x3ff0000000000000);\n    Ok(f64_any(0x4000000000000000))\n}")
        assertEq(
            printed([',', [1, 2, 3]]),
            "{\n    let _b34: Any<A> = f64_any(0x3ff0000000000000);\n    let _b35: Any<A> = f64_any(0x4000000000000000);\n    Ok(f64_any(0x4008000000000000))\n}")
        // Atomic as an operand, the same as `.`: a brace-delimited block
        // needs no parentheses wherever it stands.
        assertEq(
            printed(['-', [',', [1, 2]]]),
            "<Any<A> as core::ops::Neg>::neg({\n    let _b70: Any<A> = f64_any(0x3ff0000000000000);\n    f64_any(0x4000000000000000)\n})")
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
            printedWith(shared)(conditional('??', null, base)),
            "if Any::<A>::to_boolean(if Any::<A>::to_boolean((strict_eq(Nullish::Null.to_any(), Nullish::Null.to_any()))?) { true.to_any() } else { (strict_eq(Nullish::Null.to_any(), Nullish::Undefined.to_any()))? }) { Ok(x.clone()) } else { Ok(Nullish::Null.to_any()) }")
        /** @type {Exp} */
        const op = ['*', 1, 2]
        assertEq(
            printedWith([[op, 'y.clone()']])(conditional('??', null, op)),
            "if Any::<A>::to_boolean(if Any::<A>::to_boolean((strict_eq(Nullish::Null.to_any(), Nullish::Null.to_any()))?) { true.to_any() } else { (strict_eq(Nullish::Null.to_any(), Nullish::Undefined.to_any()))? }) { Ok(y.clone()) } else { Ok(Nullish::Null.to_any()) }")
        // A bound operation is its name as an operand too, atomic as
        // written, where the operation would be composed.
        assertEq(printedWith([[op, 'y.clone()']])(['-', op]), "<Any<A> as core::ops::Neg>::neg(y.clone())")
        assertEq(printed(['-', op]), "<Any<A> as core::ops::Neg>::neg((f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?)")
        // A node inside a lazy operand is a temporary of the thunk's block
        // in the bare mode too, over the bindings around it.
        assertEq(
            printedWith(shared)(conditional('??', null, ['[]', [base, ['-', base]]])),
            "if Any::<A>::to_boolean(if Any::<A>::to_boolean((strict_eq(Nullish::Null.to_any(), Nullish::Null.to_any()))?) { true.to_any() } else { (strict_eq(Nullish::Null.to_any(), Nullish::Undefined.to_any()))? }) { Ok([x.clone(), (<Any<A> as core::ops::Neg>::neg(x.clone()))?].to_array().to_any()) } else { Ok(Nullish::Null.to_any()) }")
        // A node reached eagerly and lazily prints where it stands in the
        // bare mode, in the thunk too — a comma as its block expression.
        /** @type {Exp} */
        const comma = [',', [1, 2]]
        assertEq(
            printed(['[]', [comma, conditional('&&', true, comma)]]),
            "{\n    let _b0: Any<A> = {\n        let _b108: Any<A> = f64_any(0x3ff0000000000000);\n        f64_any(0x4000000000000000)\n    };\n    [_b0.clone(), if Any::<A>::to_boolean(true.to_any()) { _b0.clone() } else { true.to_any() }].to_array().to_any()\n}")
    },
    /**
     * The lines of a prepared scope preserve shared identity, lazy evaluation
     * and abrupt completion. The root supplies the enclosing function's
     * Result; required and memoized declarations come from preparation.
     */
    scope: {
        /** A shared atom is a temporary, cloned at each reference. */
        statements: () => {
            /** @type {Exp} */
            const x = ['[]', []]
            assertStructurallySame(scoped(['[]', [x, x]]), ["let _b0: Any<A> = Array::default().to_any();","Ok([_b0.clone(), _b0.clone()].to_array().to_any())"])
        },
        operationRoot: () => {
            assertStructurallySame(
                scoped(['.', ['{}', []], 'a']),
                ['Any::dot(Object::default().to_any(), string_any("a")).end()'])
        },
        /**
         * Unshared values remain expressions, including nested containers
         * and operations; shared values receive explicit prepared bindings.
         */
        temporaries: () => {
            assertStructurallySame(
                scoped(['[]', [['*', 1, 2], ['{}', [[':', 'k', ['[]', [1]]]]], ['[]', []], ['undefined'], null]]),
                ["Ok([(f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000))?, [(string_key(\"k\"), [f64_any(0x3ff0000000000000)].to_array().to_any())].to_object().to_any(), Array::default().to_any(), Nullish::Undefined.to_any(), Nullish::Null.to_any()].to_array().to_any())"])
        },
        /**
         * Nested operations propagate their failure with `?`; the root
         * operation answers its own Result. A value root is wrapped in Ok.
         */
        operations: () => {
            assertStructurallySame(scoped(['*', 1, 2]), ['f64_any(0x3ff0000000000000) * f64_any(0x4000000000000000)'])
            assertStructurallySame(scoped(['*', 1, ['*', 2, 3]]), ["f64_any(0x3ff0000000000000) * (f64_any(0x4000000000000000) * f64_any(0x4008000000000000))?"])
            assertStructurallySame(scoped(['-', ['undefined']]), ["<Any<A> as core::ops::Neg>::neg(Nullish::Undefined.to_any())"])
            assertStructurallySame(scoped(['.', ['.', ['{}', [[':', 'a', ['{}', []]]]], 'a'], 'b']), ["Any::dot((Any::dot([(string_key(\"a\"), Object::default().to_any())].to_object().to_any(), string_any(\"a\")).end())?, string_any(\"b\")).end()"])
            assertStructurallySame(scoped(['[]', [['()', ['args'], [1]]]]), ["let _b0: Any<A> = args.clone().to_any();","Ok([(Any::call(_b0.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any()))?].to_array().to_any())"])
            // A literal root is `Ok` of the literal.
            assertStructurallySame(scoped(1), ['Ok(f64_any(0x3ff0000000000000))'])
        },
        /**
         * A comma root establishes its preceding operands in required
         * prepared bindings, then answers its last operand. The last
         * operand's operation Result can be the scope's own Result.
         */
        commaRoot: () => {
            assertStructurallySame(scoped([',', [['-', 1], ['[]', []], 2]]), ["let _b108: Any<A> = (<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?;","let _b109: Any<A> = Array::default().to_any();","Ok(f64_any(0x4000000000000000))"])
            assertStructurallySame(scoped([',', [['-', 1], ['*', 2, 3]]]), ["let _b108: Any<A> = (<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?;","f64_any(0x4000000000000000) * f64_any(0x4008000000000000)"])
            // A last operand shared with a discarded one is a temporary,
            // and the comma answers its name.
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped([',', [['[]', [c]], c]]), ["let _b0: Any<A> = Array::default().to_any();","let _b108: Any<A> = [_b0.clone()].to_array().to_any();","Ok(_b0.clone())"])
        },
        /**
         * A comma below the root becomes an expression block, establishing
         * its discarded operands before producing its last value.
         */
        commaTemporary: () => {
            assertStructurallySame(scoped(['.', [',', [['-', 1], ['{}', [[':', 'a', 1]]]]], 'a']), ["Any::dot({","    let _b148: Any<A> = (<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?;","    [(string_key(\"a\"), f64_any(0x3ff0000000000000))].to_object().to_any()","}, string_any(\"a\")).end()"])
        },
        sharedOnlyThroughLazyOperands: () => {
            /** @type {Exp} */
            const c = ['[]', [1]]
            // two thunks reach it, and neither may bind it for the other
            assert(scoped(['[]', [conditional('&&', true, c), conditional('&&', false, c)]]).some(line => line.includes('RefCell')))
            // it is the thunk, twice
            assert(scoped(['?:', true, c, c]).some(line => line.includes('RefCell')))
            // and one thunk reaches it only through its own lazy operands
            assert(scoped(['?:', true, 1, ['[]', [conditional('&&', 1, c), conditional('&&', 2, c)]]]).some(line => line.includes('RefCell')))
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
            assertStructurallySame(scoped(['?:', true, 1, ['[]', [c, c]]]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else {","    let _b0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();","    Ok([_b0.clone(), _b0.clone()].to_array().to_any())","}"])
            /** @type {Exp} */
            const d = ['[]', [2]]
            assertStructurallySame(scoped(['?:', true, 1, conditional('&&', 2, ['[]', [d, d]])]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { if Any::<A>::to_boolean(f64_any(0x4000000000000000)) {","    let _b0: Any<A> = [f64_any(0x4000000000000000)].to_array().to_any();","    Ok([_b0.clone(), _b0.clone()].to_array().to_any())","} else { Ok(f64_any(0x4000000000000000)) } }"])
            // one the scope's root reaches eagerly as well is the scope's
            // temporary, as ever
            assertStructurallySame(scoped(['[]', [c, ['?:', true, 1, ['[]', [c, c]]]]]), ["let _b0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();","Ok([_b0.clone(), if Any::<A>::to_boolean(true.to_any()) { f64_any(0x3ff0000000000000) } else { [_b0.clone(), _b0.clone()].to_array().to_any() }].to_array().to_any())"])
        },
        /**
         * Invocation inputs are already established, so lazy references
         * clone them directly. A container shared within one selected arm
         * is bound inside that arm and retains one identity there.
         */
        sharedAtomOnlyThroughLazyOperands: () => {
            /** @type {Exp} */
            const args = ['args']
            assertStructurallySame(scoped(['?:', true, args, args]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(args.clone().to_any()) } else { Ok(args.clone().to_any()) }"])
            assertStructurallySame(scoped(['?:', true, ['[]', [args]], ['[]', [args]]]), ["if Any::<A>::to_boolean(true.to_any()) { Ok([args.clone().to_any()].to_array().to_any()) } else { Ok([args.clone().to_any()].to_array().to_any()) }"])
            assertStructurallySame(scoped(conditional('||', conditional('&&', true, args), args)), ["let _b1: Any<A> = if Any::<A>::to_boolean(true.to_any()) { args.clone().to_any() } else { true.to_any() };","if Any::<A>::to_boolean(_b1.clone()) { Ok(_b1.clone()) } else { Ok(args.clone().to_any()) }"])
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['?:', true, 1, ['[]', [c, c]]]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else {","    let _b0: Any<A> = Array::default().to_any();","    Ok([_b0.clone(), _b0.clone()].to_array().to_any())","}"])
        },
        /**
         * An eager reach establishes the shared lazy operation once. Its
         * later guarded use reads that prepared binding; the operation's
         * own argument still remains lazy.
         */
        sharedLazyOperation: () => {
            /** @type {Exp} */
            const x = conditional('||', 1n, ['/', 1n, 0n])
            assertStructurallySame(scoped([',', [x, conditional('&&', true, x)]]), ["let _b1: Any<A> = if Any::<A>::to_boolean(bigint_any(1)) { bigint_any(1) } else { (bigint_any(1) / bigint_any(0))? };","if Any::<A>::to_boolean(true.to_any()) { Ok(_b1.clone()) } else { Ok(true.to_any()) }"])
        },
        /** An empty sequence supplies undefined, including when nested. */
        emptyComma: () => {
            assertStructurallySame(scoped([',', []]), ['Ok(Nullish::Undefined.to_any())'])
            assertEq(scope(['[]', [[',', []]]])[0], "ok")
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
                    ['error', ['a function length above 16', ['=>', length, [], 1]]])
            }
        },
        args: () => {
            assertEq(printed(['args']), 'args.clone().to_any()')
        },
        call: () => {
            /** @type {Exp} */
            const e = ['()', ['args'], [1]]
            assertEq(printed(e), "{\n    let _b0: Any<A> = args.clone().to_any();\n    Any::call(_b0.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any())\n}")
            assertStructurallySame(scoped(e), ["let _b0: Any<A> = args.clone().to_any();","Any::call(_b0.clone(), [f64_any(0x3ff0000000000000)].to_array().to_any())"])
            // The arguments are a list by position, so a first item that
            // spells a tag is a string, eager or in a thunk.
            assertEq(
                printed(['()', ['args'], [',', 'args']]),
                "{\n    let _b0: Any<A> = args.clone().to_any();\n    Any::call(_b0.clone(), [string_any(\",\"), string_any(\"args\")].to_array().to_any())\n}")
            assertStructurallySame(scoped(['?.()', ['undefined'], [',', 'args']]), ["Any::option_call(Nullish::Undefined.to_any(), || Ok([string_any(\",\"), string_any(\"args\")].to_array().to_any())).end()"])
        },
        /**
         * A body that reads its arguments names the parameter; one that
         * never does leaves it `_args`, unused. The last argument is the
         * function's text, `tryFunctionText`'s.
         */
        closure: () => {
            assertEq(
                printed(['=>', 0, [], ['rest']]),
                "A::static_function(|_self, _args| {\n    let _b52: Any<A> = _args.rest(0).to_any();\n    Ok(_b52.clone())\n}, 0, Array::default(), Some(\"(...$0)=>$0\")).to_any()")
            assertEq(
                printed(['=>', 0, [], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some("()=>1")).to_any()')
        },
        /** A nested function's `args` are its own: the outer body reads none. */
        nested: () => {
            assertEq(
                printed(['=>', 0, [], ['=>', 0, [], ['rest']]]),
                "A::static_function(|_self, _args| { Ok(A::static_function(|_self, _args| {\n    let _b54: Any<A> = _args.rest(0).to_any();\n    Ok(_b54.clone())\n}, 0, Array::default(), Some(\"(...$0)=>$0\")).to_any()) }, 0, Array::default(), Some(\"()=>(...$0)=>$0\")).to_any()")
        },
        /** A body whose root is an operation answers that operation's own `Result`, as a thunk does. */
        operationBody: () => {
            assertEq(
                printed(['=>', 0, [], ['.', ['rest'], 0]]),
                "A::static_function(|_self, _args| {\n    let _b89: Any<A> = _args.rest(0).to_any();\n    Any::dot(_b89.clone(), f64_any(0x0000000000000000)).end()\n}, 0, Array::default(), Some(\"(...$0)=>$0[0]\")).to_any()")
        },
        /**
         * A body's temporaries are the body's own: bound in the closure,
         * named by its prepared binding identity, its block one line under another — a shared
         * read cloned at each reference, two reads each moved.
         */
        sharingInside: () => {
            /** @type {Exp} */
            const first = ['.', ['rest'], 0]
            assertEq(
                printed(['=>', 0, [], ['[]', [first, first]]]),
                "A::static_function(|_self, _args| {\n    let _b128: Any<A> = _args.rest(0).to_any();\n    let _b1: Any<A> = (Any::dot(_b128.clone(), f64_any(0x0000000000000000)).end())?;\n    Ok([_b1.clone(), _b1.clone()].to_array().to_any())\n}, 0, Array::default(), Some(\"(...$0)=>{const $1=$0[0];return [$1,$1];}\")).to_any()")
            assertStructurallySame(
                scoped(['=>', 0, [], ['[]', [['.', ['rest'], 0], ['.', ['rest'], 1]]]]),
                ["Ok(A::static_function(|_self, _args| {","    let _b212: Any<A> = _args.rest(0).to_any();","    Ok([(Any::dot(_b212.clone(), f64_any(0x0000000000000000)).end())?, (Any::dot(_b212.clone(), f64_any(0x3ff0000000000000)).end())?].to_array().to_any())","}, 0, Array::default(), Some(\"(...$0)=>[$0[0],$0[1]]\")).to_any())"])
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
                "A::static_function(|_self, _args| { Ok(A::frame(_self)[0].clone()) }, 0, [f64_any(0x3ff0000000000000)].to_array(), Some(\"()=>$0\")).to_any()")
            assertEq(
                printed(['=>', 0, [['[]', []], ['{}', []]], ['[]', [['frame', 1], ['frame', 0]]]]),
                "{\n    let _b0: Any<A> = Array::default().to_any();\n    let _b1: Any<A> = Object::default().to_any();\n    A::static_function(|_self, _args| { Ok([A::frame(_self)[1].clone(), A::frame(_self)[0].clone()].to_array().to_any()) }, 0, [_b0.clone(), _b1.clone()].to_array(), Some(\"()=>[$1,$0]\")).to_any()\n}")
            assertEq(
                printed(['=>', 0, [], 1]),
                'A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, Array::default(), Some("()=>1")).to_any()')
            // A frame's items are the scope's temporaries, moved where the
            // frame is their only reference and cloned where it is not.
            /** @type {Exp} */
            const read = ['.', ['{}', []], 'a']
            assertStructurallySame(
                scoped(['[]', [['=>', 0, [read], ['frame', 0]], read]]),
                ["let _b1: Any<A> = (Any::dot(Object::default().to_any(), string_any(\"a\")).end())?;","Ok([A::static_function(|_self, _args| { Ok(A::frame(_self)[0].clone()) }, 0, [_b1.clone()].to_array(), Some(\"()=>$0\")).to_any(), _b1.clone()].to_array().to_any())"])
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
                "{\n    let _b0: Any<A> = Array::default().to_any();\n    A::static_function(|_self, _args| { Ok(A::static_function(|_self, _args| { Ok(A::frame(_self)[0].clone()) }, 0, [A::frame(_self)[0].clone()].to_array(), Some(\"()=>$0\")).to_any()) }, 0, [_b0.clone()].to_array(), Some(\"()=>()=>$0\")).to_any()\n}")
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
            ])) { assertEq(refusalReason(e)[0], "invalid frame slot index or scope") }
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
                ["let _b0: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();","Ok([A::static_function(|_self, _args| { Ok(f64_any(0x3ff0000000000000)) }, 0, [_b0.clone()].to_array(), Some(\"()=>1\")).to_any(), _b0.clone()].to_array().to_any())"])
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
            assertEq(holdsFunction(['charCodeAt']), true)
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
     * The nodes a root establishes unconditionally: through every eager
     * position, and a lazy operation's first operand, never its others —
     * however a node is also reached lazily.
     */
    preparedRegions: () => {
        /** @type {Exp} */
        const c = ['[]', []]
        // Through an array item, an object value, a comma operand, an eager
        // operator's operands, a `.` base, and a lazy operation's first
        // operand.
        assertStructurallySame(scoped(['[]', [c]]), ["Ok([Array::default().to_any()].to_array().to_any())"])
        assertStructurallySame(scoped(['{}', [[':', 'k', c]]]), ["Ok([(string_key(\"k\"), Array::default().to_any())].to_object().to_any())"])
        assertStructurallySame(scoped([',', [c, 1]]), ["let _b70: Any<A> = Array::default().to_any();","Ok(f64_any(0x3ff0000000000000))"])
        assertStructurallySame(scoped(['*', 1, c]), ["f64_any(0x3ff0000000000000) * Array::default().to_any()"])
        assertStructurallySame(scoped(['.', c, 'length']), ["Any::dot(Array::default().to_any(), string_any(\"length\")).end()"])
        assertStructurallySame(scoped(conditional('&&', c, 1)), ["let _b0: Any<A> = Array::default().to_any();","if Any::<A>::to_boolean(_b0.clone()) { Ok(f64_any(0x3ff0000000000000)) } else { Ok(_b0.clone()) }"])
        assertStructurallySame(scoped(['?:', c, 1, 2]), ["if Any::<A>::to_boolean(Array::default().to_any()) { Ok(f64_any(0x3ff0000000000000)) } else { Ok(f64_any(0x4000000000000000)) }"])
        // Not through a function's body, established only when it is called.
        assertStructurallySame(scoped(['=>', 0, [], ['[]', [c]]]), ["Ok(A::static_function(|_self, _args| { Ok([Array::default().to_any()].to_array().to_any()) }, 0, Array::default(), Some(\"()=>[[]]\")).to_any())"])
        // Not through a lazy operand, at any depth below it.
        assertStructurallySame(scoped(conditional('&&', true, c)), ["if Any::<A>::to_boolean(true.to_any()) { Ok(Array::default().to_any()) } else { Ok(true.to_any()) }"])
        assertStructurallySame(scoped(conditional('||', true, c)), ["if Any::<A>::to_boolean(true.to_any()) { Ok(true.to_any()) } else { Ok(Array::default().to_any()) }"])
        assertStructurallySame(scoped(conditional('??', true, c)), ["if Any::<A>::to_boolean(if Any::<A>::to_boolean((strict_eq(true.to_any(), Nullish::Null.to_any()))?) { true.to_any() } else { (strict_eq(true.to_any(), Nullish::Undefined.to_any()))? }) { Ok(Array::default().to_any()) } else { Ok(true.to_any()) }"])
        assertStructurallySame(scoped(['?:', true, c, 2]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(Array::default().to_any()) } else { Ok(f64_any(0x4000000000000000)) }"])
        assertStructurallySame(scoped(['?:', true, 1, ['[]', [c, c]]]), ["if Any::<A>::to_boolean(true.to_any()) { Ok(f64_any(0x3ff0000000000000)) } else {","    let _b0: Any<A> = Array::default().to_any();","    Ok([_b0.clone(), _b0.clone()].to_array().to_any())","}"])
        // One eager reach is enough, wherever the lazy ones are.
        assertStructurallySame(scoped(['[]', [conditional('&&', true, c), c]]), ["let _b0: Any<A> = Array::default().to_any();","Ok([if Any::<A>::to_boolean(true.to_any()) { _b0.clone() } else { true.to_any() }, _b0.clone()].to_array().to_any())"])
        // A list whose first item spells a lazy tag is a list: both `c`s
        // are items, reached.
        assertStructurallySame(scoped(['[]', ['&&', c, conditional('&&', true, c)]]), ["let _b0: Any<A> = Array::default().to_any();","Ok([string_any(\"&&\"), _b0.clone(), if Any::<A>::to_boolean(true.to_any()) { _b0.clone() } else { true.to_any() }].to_array().to_any())"])
        // The root comes first, and a primitive root reaches nothing.
        assertStructurallySame(scoped(c), ["Ok(Array::default().to_any())"])
        assertStructurallySame(scoped(1), ["Ok(f64_any(0x3ff0000000000000))"])
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
     * Corpus cases use this same Result scope, including computed keys.
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
        corpusScopes: () => {
            assert(scoped(['{}', [[':', ['undefined'], 1]]]).join('\n').includes('computed_item'))
            assert(scoped(['typeof', ['{}', [[':', 1, 2]]]]).join('\n').includes('computed_item'))
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
            ["Any::dot(Object::default().to_any(), (Any::number((Any::unary_plus(f64_any(0x3ff0000000000000)))?))?).end()"]),
        /** A literal operand needs no binding of its own. */
        literalOperand: () => assertStructurallySame(
            scoped(['.', ['{}', []], ['Number', 1]]),
            ["Any::dot(Object::default().to_any(), (Any::number(f64_any(0x3ff0000000000000)))?).end()"]),
        /** One step into a chain, the inner read's key is cast as it is outside one. */
        dotOfDot: () => assertStructurallySame(
            scoped(['.', ['.', ['[]', []], ['Number', 1]], 'x']),
            ["Any::dot((Any::dot(Array::default().to_any(), (Any::number(f64_any(0x3ff0000000000000)))?).end())?, string_any(\"x\")).end()"]),
        /** Under `?.` the key is a thunk that casts, its operand inside it. */
        optionDot: () => assertStructurallySame(
            scoped(['?.', ['{}', []], ['Number', ['+', 1]]]),
            ["Any::option_dot(Object::default().to_any(), || Ok((Any::number((Any::unary_plus(f64_any(0x3ff0000000000000)))?))?)).end()"]),
        /** A literal operand is a thunk over the cast alone, named once it is a temporary. */
        optionDotLiteral: () => assertStructurallySame(
            scoped(['?.', ['{}', []], ['Number', 1]]),
            ["Any::option_dot(Object::default().to_any(), || Ok((Any::number(f64_any(0x3ff0000000000000)))?)).end()"]),
        /** A `|.` step's key is lazy too. */
        step: () => assertStructurallySame(
            scoped(['?.', ['{}', []], 'a', ['|.', ['Number', ['+', 2]]]]),
            ["Any::option_dot(Object::default().to_any(), || Ok(string_any(\"a\"))).dot(|| Ok((Any::number((Any::unary_plus(f64_any(0x4000000000000000)))?))?)).end()"]),
    },
    /** Empty EDAG sequences retain the evaluator's undefined result. */
    emptySequence: () => assertEq(printed([',', []]), 'Ok(Nullish::Undefined.to_any())'),
    fragmentBoundary: () => {
        assertEq(printedWith([[['[]', []], 'unused']])(1), 'f64_any(0x3ff0000000000000)')
        assertEq(printed(['arg', 2]), 'args.argument(2)')
        assertEq(printed(['frame', 1]), 'A::frame(self_)[1].clone()')
        assertEq(printed(['rest']), 'rest.clone().to_any()')
        assertEq(printed(['self']), 'Function::new(self_.clone()).to_any()')
        assert(readsSelf(['self']))
        assert(!readsSelf(['=>', 0, [], ['self']]))
        assertEq(untagged(restLine(2)[0]), 'let rest = args.rest(2);')
        assertEq(unwrap(bindingLine([], 'value')(['[]', []])), 'let value: Any<A> = Array::default().to_any();')
        const text = unwrap(scopeTagged(['=>', 0, [], 1], () => 'custom callable')).lines.map(untagged).join('\n')
        assert(text.includes('Some("custom callable")'))
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
                "<Any<A> as core::ops::Neg>::neg((Any::option_dot(Object::default().to_any(), || Ok(string_any(\"b\"))).end())?)")
        },
        /** A `.` node with a continuation as a base: the outer read prints over the chain's own text. */
        opaqueBase: () => {
            assertEq(
                printed(['.', ['.', ['{}', []], 'y', ['|()', []]], 'z']),
                "Any::dot((Any::dot(Object::default().to_any(), string_any(\"y\")).end_call(&runtime, || Ok(Array::default().to_any())))?, string_any(\"z\")).end()")
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
            const thunk = '|| Ok([(bigint_any(1) / bigint_any(0))?].to_array().to_any())'
            assertEq(
                printed(['.', ['{}', []], 'b', ['|()', [['/', 1n, 0n]]]]),
                `Any::dot(Object::default().to_any(), string_any("b")).end_call(&runtime, ${thunk})`)
            assertStructurallySame(
                scoped(['.', ['{}', []], 'b', ['|()', [['/', 1n, 0n]]]]),
                ["Any::dot(Object::default().to_any(), string_any(\"b\")).end_call(&runtime, || Ok([(bigint_any(1) / bigint_any(0))?].to_array().to_any()))"])
            assertStructurallySame(
                scoped(['?.()', ['undefined'], [['-', 1]]]),
                ["Any::option_call(Nullish::Undefined.to_any(), || Ok([(<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?].to_array().to_any())).end()"])
            assertStructurallySame(
                scoped(['?.', ['{}', []], 'b', ['|.', 'c', ['|()', [['-', 1]]]]]),
                ["Any::option_dot(Object::default().to_any(), || Ok(string_any(\"b\"))).dot(|| Ok(string_any(\"c\"))).call(&runtime, || Ok([(<Any<A> as core::ops::Neg>::neg(f64_any(0x3ff0000000000000)))?].to_array().to_any())).end()"])
        },
        /** An unshared chain remains nested, with `?` propagating its failure. */
        temporary: () => {
            assertStructurallySame(
                scoped(['[]', [['?.', ['{}', []], 'a']]]),
                ["Ok([(Any::option_dot(Object::default().to_any(), || Ok(string_any(\"a\"))).end())?].to_array().to_any())"])
        },
        /**
         * Lazy chain arguments use the common prepared memoized bindings
         * when sharing crosses argument regions. They retain one identity
         * without initializing before the chain guard demands them. An
         * eager reach instead establishes a required binding beforehand.
         */
        sharing: () => {
            /** @type {Exp} */
            const one = ['[]', [1]]
            assertStructurallySame(scoped(['?.()', ['undefined'], [one, one]]), ["let _b2 = std::cell::RefCell::new(None::<Any<A>>);","let _b1 = || -> Result<Any<A>, Any<A>> {","    if let Some(value) = _b2.borrow().as_ref() { return Ok(value.clone()); }","    let value: Any<A> = { [f64_any(0x3ff0000000000000)].to_array().to_any() };","    *_b2.borrow_mut() = Some(value.clone());","    Ok(value)","};","Any::option_call(Nullish::Undefined.to_any(), || Ok([(_b1())?, (_b1())?].to_array().to_any())).end()"])
            assert(scoped(['[]', [['?.()', ['undefined'], [one]], ['?.()', ['undefined'], [one]]]]).some(line => line.includes('RefCell')))
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['?.()', ['undefined'], [c, c]]), ["let _b2 = std::cell::RefCell::new(None::<Any<A>>);","let _b1 = || -> Result<Any<A>, Any<A>> {","    if let Some(value) = _b2.borrow().as_ref() { return Ok(value.clone()); }","    let value: Any<A> = { Array::default().to_any() };","    *_b2.borrow_mut() = Some(value.clone());","    Ok(value)","};","Any::option_call(Nullish::Undefined.to_any(), || Ok([(_b1())?, (_b1())?].to_array().to_any())).end()"])
            assertStructurallySame(
                scoped(['[]', [c, ['?.()', ['undefined'], [c]]]]),
                ["let _b0: Any<A> = Array::default().to_any();","Ok([_b0.clone(), (Any::option_call(Nullish::Undefined.to_any(), || Ok([_b0.clone()].to_array().to_any())).end())?].to_array().to_any())"])
        },
        /**
         * The eager positions per tag: a `.` node's receiver and key, a
         * `?.` or `?.()` node's first operand; nothing inside a
         * continuation, at any depth, nor a `?.()` node's arguments.
         */
        preparedRegions: () => {
            /** @type {Exp} */
            const c = ['[]', []]
            assertStructurallySame(scoped(['.', c, 'a', ['|()', []]]), ["Any::dot(Array::default().to_any(), string_any(\"a\")).end_call(&runtime, || Ok(Array::default().to_any()))"])
            assertStructurallySame(scoped(['?.', c, 'a']), ["Any::option_dot(Array::default().to_any(), || Ok(string_any(\"a\"))).end()"])
            assertStructurallySame(scoped(['?.()', c, []]), ["let _b0: Any<A> = Array::default().to_any();","Any::option_call(_b0.clone(), || Ok(Array::default().to_any())).end()"])
            assertStructurallySame(scoped(['.', ['{}', []], 'a', ['|()', [c]]]), ["Any::dot(Object::default().to_any(), string_any(\"a\")).end_call(&runtime, || Ok([Array::default().to_any()].to_array().to_any()))"])
            assertStructurallySame(scoped(['?.()', ['undefined'], [c]]), ["Any::option_call(Nullish::Undefined.to_any(), || Ok([Array::default().to_any()].to_array().to_any())).end()"])
            assertStructurallySame(scoped(['?.', ['{}', []], 'a', ['|.', 'b', ['|()', [c]]]]), ["Any::option_dot(Object::default().to_any(), || Ok(string_any(\"a\"))).dot(|| Ok(string_any(\"b\"))).call(&runtime, || Ok([Array::default().to_any()].to_array().to_any())).end()"])
        },
    },
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
            assertStructurallySame(scoped(['[]', [['[]', [['...', 'ab']]], 3]]), ["Ok([(spread_array([spread_item(string_any(\"ab\"))]))?, f64_any(0x4008000000000000)].to_array().to_any())"])
        },
        call: () => {
            assertEq(
                printed(['()', ['args'], [0, ['...', 'ab']]]),
                "{\n    let _b0: Any<A> = args.clone().to_any();\n    Any::call(_b0.clone(), (spread_array([value_item(f64_any(0x0000000000000000)), spread_item(string_any(\"ab\"))]))?)\n}")
        },
        /** A call step's and an optional call's arguments are a thunk, answering `spread_array`'s `Result`. */
        thunks: () => {
            assertStructurallySame(scoped(['.', ['args'], 'at', ['|()', [['...', 'ab']]]]), ["Any::dot(args.clone().to_any(), string_any(\"at\")).end_call(&runtime, || spread_array([spread_item(string_any(\"ab\"))]))"])
            assertEq(
                printed(['?.()', ['undefined'], [['...', 'ab']]]),
                'Any::option_call(Nullish::Undefined.to_any(), || spread_array([spread_item(string_any("ab"))])).end()')
        },
        /** Without a spread, nothing changes: the array is a value and the call `Any::call`. */
        noSpread: () => {
            assertEq(printed(['[]', ['...']]), '[string_any("...")].to_array().to_any()')
            assertEq(
                printed(['()', ['args'], ['...']]),
                "{\n    let _b0: Any<A> = args.clone().to_any();\n    Any::call(_b0.clone(), [string_any(\"...\")].to_array().to_any())\n}")
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
            assertStructurallySame(scoped(['[]', [s, s]]), ["let _b1: Any<A> = (Any::dot(args.clone().to_any(), string_any(\"a\")).end())?;","spread_array([spread_item(_b1.clone()), spread_item(_b1.clone())])"])
            assertStructurallySame(scoped(['.', ['args'], 'at', ['|()', [s, s]]]), ["let _b2: Any<A> = (Any::dot(args.clone().to_any(), string_any(\"a\")).end())?;","Any::dot(args.clone().to_any(), string_any(\"at\")).end_call(&runtime, || spread_array([spread_item(_b2.clone()), spread_item(_b2.clone())]))"])
            /** @type {Property} */
            const p = [':', 'k', a]
            assertStructurallySame(scoped(['{}', [p, p]]), ["let _b1: Any<A> = (Any::dot(args.clone().to_any(), string_any(\"a\")).end())?;","Ok([(string_key(\"k\"), _b1.clone()), (string_key(\"k\"), _b1.clone())].to_object().to_any())"])
        },
        /** A spread array nested in a corpus expression is an operation, as an operator is. */
        preparedScopes: () => {
            assertStructurallySame(scoped(['[]', [['[]', [['...', 'ab']]]]]), ["Ok([(spread_array([spread_item(string_any(\"ab\"))]))?].to_array().to_any())"])
            assertStructurallySame(scoped(['[]', [['[]', ['ab']]]]), ["Ok([[string_any(\"ab\")].to_array().to_any()].to_array().to_any())"])
        },
    },
}
