/**
 * Prepared FAST fixes evaluation regions and transfers before Rust spelling.
 * These fixtures use that public IR directly, including source-free loops.
 * @import { Value, Block, Function as PreparedFunction } from '../../js/ast/prepare/types.ts'
 * @import { BindingId, LoopTarget, Step } from '../../js/ast/types.ts'
 * @import { Options } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { unwrap } from '../../types/result/module.f.js'
import { untagged } from '../../text/marked/module.f.mjs'
import { bindingTagged, braced, op1Rust, scope, scopeTagged, useLines, useLinesTagged, valueTagged } from './module.f.mjs'

/** @type {Options} */
const options = { runtime: 'runtime', text: fn => `function${fn.target.index}` }
/** @type {(v: Value, result?: boolean) => string} */
const text = (v, result = false) => untagged(unwrap(valueTagged(v, options, [], result))[0])
/** @type {(values: readonly Value[]) => Block} */
const yielding = values => ({ statements: [], exit: ['yield', values] })
/** @type {BindingId} */
const x = { index: 0 }
/** @type {BindingId} */
const y = { index: 1 }
/** @type {BindingId} */
const rest = { index: 2 }
/** @type {PreparedFunction} */
const fn = { target: { kind: 'function', index: 0 }, parameters: [x], rest, self: y, captures: [], body: { statements: [], exit: ['return', { kind: 'function', index: 0 }, ['array', [['ref', x], ['ref', y], ['ref', rest]]]] } }

export const proof = {
    primitives: () => {
        for (const value of [undefined, null, true, false, 0, -0, 1, NaN, Infinity, -Infinity, '', 'a\ud800b', '\u{1f600}', 0n, -(2n ** 63n), 2n ** 64n]) {
            assert(text(value).length > 0)
            assert(text(value, true).startsWith('Ok('))
        }
    },
    operators: () => {
        /** @type {readonly Value[]} */
        const values = [
            ['!', true], ['~', 0], ['-', 1], ['typeof', 1], ['Number', '1'], ['String', 1],
            ['+', 1, 2], ['-', 1, 2], ['*', 1, 2], ['/', 1, 2], ['%', 1, 2], ['**', 1, 2],
            ['&', 1, 2], ['|', 1, 2], ['^', 1, 2], ['<<', 1, 2], ['>>', 1, 2], ['>>>', 1, 2],
            ['===', 1, 2], ['!==', 1, 2], ['<', 1, 2], ['<=', 1, 2], ['>', 1, 2], ['>=', 1, 2],
            ['?:', true, 1, 2],
            ['instanceof', ['array', []], 'Array'],
            ['in', 'x', ['object', []]],
        ]
        for (const value of values) {
            assert(text(value).endsWith('?'))
            assert(text(value, true).length > 0)
        }
        // the entry check is the runtime's `in` body called with the key
        // and the value, the naive spelling a VM may substitute; with no
        // runtime in scope it is refused, as a member call is
        assert(text(['in', 'x', 1], true).startsWith('Any::call((Any::dot(runtime.clone(), string_any("in")).end())?, [string_any("x"), '))
        assertEq(valueTagged(['in', 'x', 1], { ...options, runtime: null }, [], false)[0], 'error')
        assertEq(op1Rust['+']?.('v'), 'Any::unary_plus(v)')
        assertEq(op1Rust.throw?.('v'), 'Err(v)')
    },
    containers: () => {
        assertEq(text(['array', [0, -0]]), '[f64_any(0x0000000000000000), f64_any(0x8000000000000000)].to_array().to_any()')
        /** @type {readonly Value[]} */
        const values = [
            ['array', []], ['array', [1, 2]], ['array', [1, ['...', ['array', [2]]]]],
            ['object', []], ['object', [[':', 'a', 1]]], ['object', [[':', 1, 2]]],
            ['object', [['...', ['object', []]], [':', 'a', 1]]],
            ['()', ['entry'], [['object', []], 'a']], ['()', ['entry'], [['...', ['array', [1]]]]],
            [',', []], [',', [1, 2, 3]],
        ]
        for (const value of values) {
            assert(text(value).length > 0)
            assert(text(value, true).length > 0)
        }
    },
    /** Key evaluation and conversion finish before the property value starts. */
    computedKeyOrder: () => {
        /** @type {Value} */
        const key = ['()', ['ref', x], []]
        /** @type {Value} */
        const value = ['()', ['ref', y], []]
        /** @type {Value} */
        const object = ['object', [[':', key, value]]]
        /** @type {string} */
        const converted = 'property_item(((Any::call(_b0.clone(), Array::default().to_any()))?).to_string()?, (Any::call(_b1.clone(), Array::default().to_any()))?)'
        assertEq(text(object, true), `Ok(spread_object([${converted}]))`)
        assertEq(text(object), `spread_object([${converted}])`)
        assertStructurallySame(unwrap(scope(yielding([object]), options)).uses, {
            vm: ['Array', 'ToAny'], unstable: ['property_item', 'spread_object'],
        })
    },
    /** Parentheses make conversion consume the entire conditional or block. */
    computedKeyGrouping: () => {
        /** @type {readonly Value[]} */
        const keys = [
            ['if', true, yielding([1]), yielding([2])],
            ['?:', false, 1, 2],
            ['block', { statements: [['define', x, 1]], exit: ['yield', [['ref', x]]] }],
            ['Number', ['ref', x]],
        ]
        for (const key of keys) {
            assertEq(text(['object', [[':', key, ['ref', y]]]]),
                `spread_object([property_item((${text(key)}).to_string()?, _b1.clone())])`)
        }
    },
    /** Entry order, selected regions and established value references stay intact. */
    computedKeyRegionsAndIdentity: () => {
        /** @type {Value} */
        const object = ['object', [
            [':', ['ref', x], ['ref', y]], ['...', ['object', []]], [':', 1, ['ref', y]],
        ]]
        /** @type {string} */
        const expected = 'spread_object([property_item((_b0.clone()).to_string()?, _b1.clone()), spread_entries(Object::default().to_any()), property_item((f64_any(0x3ff0000000000000)).to_string()?, _b1.clone())])'
        assertEq(text(object), expected)
        assertEq(text(['if', true, yielding([object]), yielding([['object', []]])]),
            `if Any::<A>::to_boolean(true.to_any()) { ${expected} } else { Object::default().to_any() }`)
        assertEq(text(['object', [[':', 'plain', ['ref', y]]]]),
            '[(string_key("plain"), _b1.clone())].to_object().to_any()')
        const uses = unwrap(scope(yielding([object]), options)).uses
        assertEq(uses.unstable.includes('computed_item'), false)
        assertEq(uses.vm.includes('ToString'), false)
        assert(uses.unstable.includes('property_item'))
    },
    /** Each reached iterator is established before the next operand runs. */
    spreadExpansion: () => {
        /** @type {Value} */
        const later = ['()', ['ref', x], []]
        const values = /** @type {const} */ ([['...', null], later])
        /** @type {string} */
        const expanded = 'spread_array([spread_item(Nullish::Null.to_any())?, value_item((Any::call(_b0.clone(), Array::default().to_any()))?)])'
        assertEq(text(['array', values], true), expanded)
        assertEq(text(['array', values]), `(${expanded})?`)
        // The callee is the first Rust call argument; expansion belongs to
        // the following argument array, before its later operand call.
        assertEq(text(['()', later, values], true), `Any::call((Any::call(_b0.clone(), Array::default().to_any()))?, (${expanded})?)`)
        // Failure of the spread operand itself propagates before iterator
        // admission, which has its own question mark at the item boundary.
        assertEq(text(['array', [['...', ['Number', null]], 1]], true),
            'spread_array([spread_item((Any::number(Nullish::Null.to_any()))?)?, value_item(f64_any(0x3ff0000000000000))])')
        // Repeated references retain the established element identity; every
        // spread is established independently at its original list position.
        assertEq(text(['array', [['ref', x], ['...', ['ref', y]], ['ref', x], ['...', ['array', []]]]], true),
            'spread_array([value_item(_b0.clone()), spread_item(_b1.clone())?, value_item(_b0.clone()), spread_item(Array::default().to_any())?])')
        const used = unwrap(valueTagged(['array', values], options))[1]
        assertStructurallySame(used.filter(([module, name]) => module === 'unstable' && name === 'spread_item'), [['unstable', 'spread_item']])
    },
    /** Selected chain argument thunks contain expansion; lookup stays outside. */
    selectedSpreadRegions: () => {
        const args = /** @type {const} */ ([['...', null], ['()', ['ref', x], []]])
        /** @type {string} */
        const items = 'spread_array([spread_item(Nullish::Null.to_any())?, value_item((Any::call(_b0.clone(), Array::default().to_any()))?)])'
        assertEq(text(['.', ['()', ['ref', y], []], 'slice', ['|()', args]], true),
            `Any::dot((Any::call(_b1.clone(), Array::default().to_any()))?, string_any("slice")).end_call(&runtime, || ${items})`)
        assertEq(text(['.', 'abc', 'slice', ['|?.()', args]], true),
            `Any::dot(string_any("abc"), string_any("slice")).option_call(&runtime, || ${items}).end()`)
        assertEq(text(['?.', null, 'slice', ['|()', args]], true),
            `Any::option_dot(Nullish::Null.to_any(), || Ok(string_any("slice"))).call(&runtime, || ${items}).end()`)
        assertEq(text(['?.()', undefined, args], true),
            `Any::option_call(Nullish::Undefined.to_any(), || ${items}).end()`)
        assertEq(text(['?.', null, 'slice', ['|!()', args]], true),
            `Any::option_dot(Nullish::Null.to_any(), || Ok(string_any("slice"))).end_call(&runtime, || ${items})`)
    },
    memberPresence: () => {
        assertEq(text(['memberPresent', ['array', []], 'at'], true), 'Any::member_present(Array::default().to_any(), string_any("at"), &runtime)')
        assertEq(text(['memberPresent', ['array', []], 0]), '(Any::member_present(Array::default().to_any(), f64_any(0x0000000000000000), &runtime))?')
        assertEq(text(['memberPresent', ['array', [1]], ['Number', '0']], true), 'Any::member_present([f64_any(0x3ff0000000000000)].to_array().to_any(), (Any::number(string_any("0")))?, &runtime)')
        const captured = text(['function', { ...fn, rest: null, self: null, body: yielding([['memberPresent', ['array', []], 'at']]) }])
        assert(captured.includes('runtime.clone()'))
        assert(captured.includes('&A::frame(_self)[0]'))
        assertStructurallySame(valueTagged(['memberPresent', null, 'a'], { ...options, runtime: null }), ['error', ['a member presence query with no runtime in scope; the core may not use what it defines', ['memberPresent', null, 'a']]])
    },
    regions: () => {
        assertEq(text(['block', yielding([1])]), text(1))
        assert(text(['if', true, yielding([1]), yielding([2])]).includes('else'))
        assert(text(['block', { statements: [], exit: ['throw', 1] }]).includes('Err::<'))
        assert(unwrap(scope({ statements: [], exit: ['throw', 1] }, options)).lines[0].startsWith('Err('))
        const failing = /** @type {Block} */ ({ statements: [['define', x, 1]], exit: ['throw', 2] })
        assert(text(['block', failing]).includes('Err::<'))
        assert(unwrap(scope({ statements: [['if', true, failing, yielding([])]], exit: ['yield', [0]] }, options)).lines.join('\n').includes('return Err'))
        assert(text(['block', { statements: [], exit: ['return', fn.target, 1] }]).includes('return Ok'))
        const conditional = /** @type {Value} */ (['if', true, yielding([1]), yielding([2])])
        assert(text(['+', conditional, 3], true).startsWith('(if '))
        assert(text(['String', conditional], true).startsWith('(if '))
        assert(text(['+', ['block', { statements: [['define', x, 1]], exit: ['yield', [['ref', x]]] }], 3], true).startsWith('({'))
        assert(text(['+', [',', [1, 2]], 3], true).startsWith('({'))
        assertEq(unwrap(scope({ statements: [], exit: ['return', fn.target, ['block', yielding([1])]] }, options)).lines[0], 'return Ok(f64_any(0x3ff0000000000000));')
        assertEq(unwrap(scope({ statements: [], exit: ['return', fn.target, ['block', { statements: [], exit: ['throw', 2] }]] }, options)).lines[0], 'Err(f64_any(0x4000000000000000))')
        const body = { statements: /** @type {const} */ ([['define', x, 1], ['block', yielding([])], ['if', true, yielding([]), yielding([])]]), exit: /** @type {const} */ (['yield', [['ref', x]]]) }
        const plain = unwrap(scope(body, options))
        const marked = unwrap(scopeTagged(body, options))
        assertStructurallySame(plain.lines, marked.lines.map(untagged))
        assert(plain.lines.join('\n').includes('let _b0'))
        assert(unwrap(scope(yielding([['ref', y]]), options, [{ binding: y, text: 'other.clone()' }])).lines[0].includes('other.clone()'))
        assertStructurallySame(unwrap(scope(yielding([['ref', y]]), options, [{ binding: y, text: 'other.clone()', uses: [['vm', 'ToAny']] }])).uses.vm, ['ToAny'])
    },
    names: () => {
        assertEq(text(['ref', x]), '_b0.clone()')
        assertEq(untagged(unwrap(valueTagged(['ref', x], options, [{ binding: x, text: 'external.clone()' }]))[0]), 'external.clone()')
        assertEq(unwrap(valueTagged(['ref', x], options, [{ binding: x, text: 'external.clone()', uses: [['vm', 'ToAny']] }]))[1].length, 1)
        assertEq(text(['demand', x]), '(_b0())?')
        assertEq(text(['demand', x], true), '_b0()')
        assert(text(['function', fn]).includes('A::static_function'))
        assert(text(['function', { ...fn, rest: null, self: null }]).includes('runtime.clone()'))
        const capture = { binding: { index: 9 }, value: /** @type {Value} */ (['array', []]) }
        assert(text(['function', { ...fn, captures: [capture] }]).includes('[Array::default()'))
        assert(untagged(unwrap(valueTagged(['function', { ...fn, parameters: [], rest: null, self: null, body: yielding([1]) }], { ...options, runtime: null }))[0]).includes('Array::default()'))
        assert(untagged(unwrap(bindingTagged('named', 1, options))[0]).startsWith('let named: Any<A>'))
    },
    identityNames: () => {
        const first = { index: 0 }
        const second = { index: 0 }
        const invalidDebug = { index: -1 }
        /** @type {Block} */
        const b = {
            statements: [['define', first, 1], ['define', second, 2], ['define', invalidDebug, 3]],
            exit: ['yield', [['array', [['ref', first], ['ref', second], ['ref', invalidDebug]]]]],
        }
        const lines = unwrap(scope(b, options)).lines
        assert(lines[0].includes('let _b0:'))
        assert(lines[1].includes('let _b0_1:'))
        assert(lines[2].includes('let _bv2:'))
        assert(lines[3].includes('[_b0.clone(), _b0_1.clone(), _bv2.clone()]'))
        /** @type {LoopTarget} */
        const outer = { kind: 'loop', index: 0 }
        /** @type {LoopTarget} */
        const inner = { kind: 'loop', index: 0 }
        /** @type {Block} */
        const control = {
            statements: [['loop', outer, {
                statements: [['loop', inner, {
                    statements: [['if', false, { statements: [], exit: ['break', outer] }, { statements: [], exit: ['break', inner] }]],
                    exit: ['yield', []],
                }]],
                exit: ['break', outer],
            }]],
            exit: ['yield', [1]],
        }
        const code = unwrap(scope(control, options)).lines.join('\n')
        assert(code.includes("'_loop0: loop"))
        assert(code.includes("'_loop0_1: loop"))
        assert(code.includes("break '_loop0;"))
        assert(code.includes("break '_loop0_1;"))
    },
    memoAndSlots: () => {
        const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        const body = {
            statements: [
                ['slot', x, 0, true],
                ['memo', { binding: y, valueSlot: { index: 3 }, doneSlot: { index: 4 }, initializer: yielding([['array', []]]) }],
                ['loop', loop, {
                    statements: [['if', ['<', ['ref', x], 2], { statements: [['write', x, ['+', ['ref', x], 1]]], exit: ['continue', loop] }, { statements: [], exit: ['break', loop] }]],
                    exit: ['yield', []],
                }],
            ],
            exit: ['yield', [['array', [['demand', y], ['demand', y], ['ref', x], ['?:', true, ['demand', y], false], ['?:', true, ['block', yielding([['demand', y]])], false]]]]],
        }
        const rendered = unwrap(scope(body, options)).lines.join('\n')
        assert(rendered.includes('RefCell::new'))
        assert(rendered.includes(': &dyn Fn() -> Result<Any<A>, Any<A>> = &|| -> Result<Any<A>, Any<A>>'))
        assert(rendered.includes('continue'))
        assert(rendered.includes('break'))
    },
    scalarWhile: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 1 })
        for (const mutable of [false, true]) {
            /** @type {Block} */
            const body = {
                statements: [['while', { target, slot: x, initial: 0, condition: false, body: yielding([]), result: y, mutable }]],
                exit: ['yield', [['ref', y]]],
            }
            assert(unwrap(scope(body, options)).lines.join('\n').includes('while'))
        }
    },
    chains: () => {
        /** @type {readonly Value[]} */
        const values = [
            ['.', ['object', []], 'a'], ['.', ['array', []], 0], ['.', ['array', []], ['Number', '0']],
            ['?.', null, 'a'], ['?.()', undefined, []],
            ['.', ['array', []], 'slice', ['|()', [0]]],
            ['?.', ['array', []], 'slice', ['|?.()', [0], ['|.', 'a', ['|!()', []]]]],
            ['?.()', undefined, [], ['|()', [], ['|.', ['Number', 0]]]],
        ]
        for (const value of values) { assert(text(value).includes('Any::')) }
    },
    helpers: () => {
        for (const tag of /** @type {const} */ (['entry', 'hasEntry', 'slice', 'Object.is', 'Number.isInteger'])) { assert(text([tag]).length > 0) }
        const native = unwrap(valueTagged(['Object.entries'], { ...options, runtime: null }))
        assert(untagged(native[0]).includes('Any::entries'))
    },
    layout: () => {
        assertEq(braced(['Ok(v)']), '{ Ok(v) }')
        assert(braced(['let v = 1;', 'Ok(v)']).includes('\n'))
        const uses = { vm: ['ToAny', 'Array'], unstable: ['f64_any'] }
        assertStructurallySame(useLines(uses, 'IVm'), useLinesTagged(uses, 'IVm').map(untagged))
        assert(useLines({ vm: [], unstable: [] }, 'IVm').length > 0)
        const long = Array.from({ length: 30 }, (_, i) => `LongName${i}`)
        assert(useLines({ vm: long, unstable: ['single'] }, 'IVm').length > 3)
    },
    deepInputs: () => {
        /** @type {Value} */
        let unary = 1
        /** @type {Value} */
        let binary = 1
        /** @type {Value} */
        let regions = 1
        /** @type {Value} */
        let required = 1
        /** @type {Step<Value> | undefined} */
        let continuation = undefined
        for (let index = 0; index < 20_000; index += 1) {
            unary = ['-', unary]
            binary = ['+', 1, binary]
            regions = ['block', yielding([regions])]
            required = ['block', { statements: [['define', { index: index + 10 }, index]], exit: ['yield', [required]] }]
            continuation = continuation === undefined ? ['|.', 'x'] : ['|.', 'x', continuation]
        }
        // Prepared input is already admitted; target traversal has no host
        // recursion bound for expression trees, regions or continuation lists.
        for (const value of [unary, binary, required, /** @type {Value} */ (['?.', null, 'root', continuation])]) {
            assert(text(value).length > 20_000)
        }
        assertEq(text(regions), text(1))
    },
    throw: {
        // A value or a statement no case names is refused, not spelled as
        // `undefined`.
        unknownPrimitive: () => valueTagged(/** @type {never} */ ({}), options),
        unknownStatement: () => scope({ statements: [/** @type {never} */ (['bogus'])], exit: ['yield', []] }, options),
        unsupportedStaticWithoutRuntime: () => unwrap(valueTagged(['Object.is'], { ...options, runtime: null })),
        memberWithoutRuntime: () => unwrap(valueTagged(['.', ['array', []], 'slice', ['|()', []]], { ...options, runtime: null })),
    },
}
