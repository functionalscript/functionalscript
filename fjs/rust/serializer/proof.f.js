/**
 * Prepared FAST fixes evaluation regions and transfers before Rust spelling.
 * These fixtures use that public IR directly, including source-free loops.
 * @import { Value, Block, Function as PreparedFunction } from '../../js/ast/prepare/types.ts'
 * @import { BindingId, LoopTarget, Step } from '../../js/ast/types.ts'
 * @import { Options, Uses } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { unwrap } from '../../types/result/module.f.js'
import { fromTagged, toText, untagged } from '../../text/marked/module.f.js'
import { unmarkedWords } from '../../edag/rust/unmarked/module.f.js'
import { bindingTagged, braced, op1Rust, scope, scopeTagged, useLines, useLinesTagged, valueTagged } from './module.f.js'
import { generate } from '../../types/array/module.f.js'
import { toJson } from '../../media/json/module.f.js'

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

/** @type {(statements: Block['statements'], end: Value) => string} */
const print = (statements, end) => unwrap(scopeTagged({ statements, exit: ['yield', [end]] }, options, [], true)).lines.map(untagged).join('\n')

/** Whether code outside the literal descriptors spells a string literal. @type {(lines: readonly string[]) => boolean} */
const quoted = lines => lines.filter(line => !line.startsWith('static LITERAL_')).join('').includes('\"')

export const proof = {
    groupedClosures: () => {
        const group = [x, y]
        /** @type {(peer: BindingId) => Value} */
        const member = peer => ['function', { ...fn, group, parameters: [], rest: null, self: null,
            captures: [{ binding: rest, value: ['ref', rest] }, { binding: peer, value: ['ref', peer] }],
            body: yielding([['array', [['ref', peer], ['ref', rest]]]]),
        }]
        /** @type {(slot: Value) => Block['statements']} */
        const declarations = slot => [['define', rest, slot], ['define', x, member(y)], ['define', y, member(x)]]
        const constant = print(declarations(42), ['ref', x])
        assert(constant.includes('StaticAny::Function(&FUNCTION_1).load()'))
        assert(constant.includes('StaticAny::Function(&FUNCTION_0).load()'))
        assert(constant.includes('StaticAny::Number(f64::from_bits(0x4045000000000000)).load()'))
        assertEq(constant.split('frame: &StaticArray(&[])').length, 3)
        const generic = unwrap(scopeTagged({ statements: declarations(42), exit: ['yield', [['ref', x]]] },
            { ...options, runtime: null }))
        assert(generic.lines.map(untagged).join('\n').includes('A::function_group([_b2.clone()]'))
        assert(generic.uses.vm.includes('GroupEntry'))
        const dynamic = print(declarations(['+', 1]), ['ref', y])
        assertEq(dynamic.split('A::function_group(').length, 2)
        assert(dynamic.includes('runtime.clone()], [GroupEntry'))
        assert(dynamic.includes('A::group_member(_self, 1).to_any()'))
        assert(dynamic.includes('A::frame(_self)[0].clone()'))
        assert(dynamic.includes('_group_b0.group_member(0)') && dynamic.includes('_group_b0.group_member(1)'))
    },
    nativeOwnership: () => {
        /** @type {Block['statements']} */
        const aliases = [['define', x, ['+', 1]], ['define', y, ['ref', x]]]
        const inspected = print([...aliases, ['define', rest, ['if', ['ref', y], yielding([['ref', x]]), yielding([null])]]], ['ref', rest])
        assert(inspected.includes('if Any::<A>::to_boolean(&_b0) { _b0.clone() }'))
        const once = print([...aliases, ['define', rest, ['array', [['ref', y]]]]], ['ref', rest])
        assert(!once.includes('let _b1:'))
        assert(once.includes('[_b0].to_array()'))
        const closure = print([...aliases, ['define', rest, ['function', { ...fn, captures: [{ binding: { index: 9 }, value: ['ref', y] }] }]]], ['ref', rest])
        assert(closure.includes('[_b0, runtime.clone()]'))
        const chain = print([...aliases, ['define', rest, ['ref', y]]], ['ref', rest])
        assert(!chain.includes('let _b2:'))
        const mixed = print([...aliases, ['define', rest, ['array', [0, ['ref', x]]]]], ['ref', rest])
        assert(mixed.includes(', _b0].to_array()'))
        const twice = print([...aliases, ['define', rest, ['array', [['ref', y], ['ref', x]]]]], ['ref', rest])
        assert(twice.includes('[_b0.clone(), _b0.clone()]'))
        const later = print([...aliases, ['define', rest, ['array', [['ref', y]]]]], ['ref', x])
        assert(later.includes('[_b0.clone()]'))
        const slot = print([['slot', x, 1, true], ['define', y, ['ref', x]], ['write', x, 2]], ['ref', y])
        assert(slot.includes('let _b1: Any<A> = _b0.clone();'))
        const memo = print([['define', x, ['+', 1]], ['memo', { binding: y, valueSlot: { index: 3 }, doneSlot: { index: 4 }, initializer: yielding([['ref', x]]) }], ['define', rest, ['array', [['ref', x]]]]], ['demand', y])
        assert(memo.includes('[_b0.clone()]'))
        const call = print([...aliases, ['define', rest, ['()', ['ref', y], []]]], ['ref', rest])
        assert(call.includes('Any::call(_b0,'))
    },
    nativeStrings: () => {
        const body = yielding([['array', ['hi', 'hi', ['function', fn]]]])
        const output = unwrap(scopeTagged(body, { ...options, text: () => 'hi' }, [], true))
        const lines = output.lines.map(untagged)
        assertEq(lines[0], 'static LITERAL_0: StaticString = ascii("hi");')
        assertEq(lines.join('\n').split('StaticAny::String(&LITERAL_0)').length, 3)
        assert(lines.join('\n').includes('text: Some(&LITERAL_0)'))
        assert(output.uses.vm.includes('StaticFunction'))
        assert(output.uses.vm.includes('StaticString'))
        assertEq(useLines(output.uses, null).join('\n').includes('null'), false)
    },
    nativeFunctions: () => {
        /** @type {(v: Value) => Value} */
        const arrow = v => ['function', { ...fn, body: yielding([v]) }]
        /** @type {readonly Value[]} */
        const reads = [
            ['Object.is'], ['structEq'], ['Boolean', 1], ['in', 'x', 1], ['memberPresent', 1, 'x'],
            ['.', 1, 'a', ['|.', 'b', ['|()', []]]],
        ]
        for (const value of reads) {
            const rust = print([], arrow(arrow(value)))
            assert(!rust.includes('StaticFunction'))
            assert(rust.includes('[runtime.clone()]'))
        }
        const simple = arrow(['.', 1, 'x'])
        const nested = print([], arrow(simple))
        assertEq(nested.split('Function::from_static(&VALUE)').length, 2)
        assert(nested.includes('A::function_with_text'))
        const core = unwrap(scopeTagged(yielding([arrow(['Math.floor'])]), { ...options, runtime: null }, [], true))
        assert(core.uses.vm.includes('StaticFunction'))
    },
    nativeFunctionFrames: () => {
        /** @type {(captures: readonly Value[]) => Value} */
        const arrow = captures => ['function', {
            ...fn, captures: captures.map((value, i) => ({ binding: { index: i + 8 }, value })), body: yielding([1]),
        }]
        /** @type {Block['statements']} */
        const defs = [['define', x, arrow([])], ['define', y, ['ref', x]], ['define', rest, arrow([['ref', y]])]]
        const rust = print(defs, arrow([['ref', rest], ['ref', y]]))
        assert(rust.includes('static FUNCTION_0: StaticFunction<A>'))
        assert(rust.includes('frame: &StaticArray(&[StaticAny::Function(&FUNCTION_0)])'))
        assert(rust.includes('frame: &StaticArray(&[StaticAny::Function(&FUNCTION_2), StaticAny::Function(&FUNCTION_0)])'))
        const mixed = print(defs, arrow([['ref', x], 1]))
        assert(mixed.includes('frame: &StaticArray(&[StaticAny::Function(&FUNCTION_0), StaticAny::Number(f64::from_bits(0x3ff0000000000000))])'))
        const dynamic = print(defs, arrow([['ref', x], ['+', 1]]))
        assert(dynamic.includes('A::function_with_text'))
    },
    nativePrimitiveFrames: () => {
        /** @type {Block['statements']} */
        const defs = [['define', x, undefined], ['define', y, ['ref', x]]]
        /** @type {readonly Value[]} */
        const values = ['very long string', 0x10000000000000002n, ['ref', y], -0, 'very long string', 0x10000000000000002n, null, true]
        const captures = values.map((value, i) => ({ binding: { index: i + 8 }, value }))
        const rust = print(defs, ['function', { ...fn, captures, body: yielding([['ref', captures[0].binding]]) }])
        assert(rust.includes('frame: &StaticArray(&[StaticAny::String(&LITERAL_1), StaticAny::BigInt(&LITERAL_2), StaticAny::Nullish(Nullish::Undefined), StaticAny::Number(f64::from_bits(0x8000000000000000)), StaticAny::String(&LITERAL_1), StaticAny::BigInt(&LITERAL_2), StaticAny::Nullish(Nullish::Null), StaticAny::Boolean(true)])'))
        assert(rust.includes('A::frame(_self)[0].clone()'))
    },
    nativeObjectFrames: () => {
        /** @type {Block['statements']} */
        const defs = [['define', x, ['object', [[':', 'f', 1]]]], ['define', y, ['ref', x]]]
        /** @type {(value: Value) => Value} */
        const wrapper = value => ['function', { ...fn, captures: [{ binding: rest, value: ['ref', y] }], body: yielding([value]) }]
        const own = print(defs, wrapper(['.', ['ref', rest], 'f', ['|()', []]]))
        assert(own.includes('frame: &StaticArray(&[StaticAny::Object(&OBJECT_0)])'))
        assert(own.includes('.end_call_native('))
        const terminal = print(defs, wrapper(['.', ['ref', rest], 'f', ['|!()', []]]))
        assert(terminal.includes('.end_call_native('))
        const guarded = print(defs, wrapper(['.', ['ref', rest], 'f', ['|?.()', []]]))
        assert(!guarded.includes('.end_call_native('))
        const runtimeArg = print(defs, wrapper(['.', ['ref', rest], 'f', ['|()', [['Boolean', 1]]]]))
        assert(runtimeArg.includes('A::function_with_text'))
        const missing = print(defs, wrapper(['.', ['ref', rest], 'missing', ['|()', []]]))
        assert(missing.includes('A::function_with_text'))
        assert(missing.includes('.end_call(&A::frame(_self)[1]'))
    },
    nativeKeys: () => {
        const output = unwrap(scopeTagged(yielding([['object', [[':', 'default', 'default']]]]), options, [], true))
        const lines = output.lines.map(untagged)
        assertEq(lines.filter(line => line.startsWith('static ')).length, 1)
        assert(lines[1].includes('(&LITERAL_0, StaticAny::String(&LITERAL_0))'))
        /** @type {readonly Value[]} */
        const values = [
            ['.', ['object', []], 'a', ['|.', 'b']],
            ['?.', ['object', []], '\ud800'], ['memberPresent', ['object', []], 'a'],
            ['Boolean', 1], ['in', 'b', ['object', []]], ['slice'], ['refMap'], ['structEq'], ['Object.is'],
        ]
        const printed = unwrap(scopeTagged(yielding([['array', values]]), options, [], true))
        assert(printed.uses.unstable.includes('static_read_keys'))
        const rust = printed.lines.map(untagged).join('\n')
        assert(!rust.includes('string_any') && !rust.includes('LITERAL_undefined'))
        assert(rust.includes('utf16(&[55296])'))
        const core = unwrap(scopeTagged(yielding([['Math.abs']]), { ...options, runtime: null }, [], true))
        assert(core.lines.join('').includes('StaticString'))
        // A string literal is spelled only in a descriptor, never built when the module runs.
        assert(rust.includes('StaticString = ascii("a");'))
        assert(!quoted(printed.lines.map(untagged)) && !quoted(core.lines.map(untagged)))
    },
    nativePrimitiveObjects: () => {
        /** @type {Value} */
        const object = ['object', [[':', 'x', 0], [':', '2', true], [':', '1', false], [':', 'x', undefined]]]
        const output = unwrap(scopeTagged(yielding([object]), options, [], true))
        assert(output.lines.map(untagged).join('\n').includes('StaticObject(&[(&LITERAL_2, StaticAny::Boolean(false)), (&LITERAL_1, StaticAny::Boolean(true)), (&LITERAL_0, StaticAny::Nullish(Nullish::Undefined))])'))
        /** @type {readonly Value[]} */
        const dynamic = [['object', [[':', ['ref', x], 1]]], ['object', [['...', ['ref', x]]]], ['object', [[':', 'x', ['ref', x]]]]]
        for (const value of dynamic) {
            assert(!unwrap(scopeTagged(yielding([value]), options, [], true)).uses.vm.includes('StaticObject'))
        }
    },
    nativeFunctionProperties: () => {
        /** @type {Block['statements']} */
        const defs = [['define', x, ['function', fn]], ['define', y, ['ref', x]]]
        /** @type {Value} */
        const table = ['object', [[':', 'f', ['ref', x]], [':', 'alias', ['ref', y]], [':', 'count', 1]]]
        const rust = print(defs, table)
        assert(rust.includes('StaticObject(&['))
        assertEq(rust.split('StaticAny::Function(&FUNCTION_0)').length, 3)
        const mixed = print(defs, ['object', [[':', 'f', ['ref', x]], [':', 'value', ['array', []]]]])
        assert(mixed.includes('StaticAny::Array(&ITEM_0)'))
    },
    nativePrimitiveArrays: () => {
        /** @type {Value} */
        const items = ['array', [null, undefined, false, -0, 'x', 2n]]
        const body = yielding([['array', [items, ['array', []], ['array', []], ['function', { ...fn, body: yielding([items]) }]]]])
        const output = unwrap(scopeTagged(body, options, [], true))
        const rust = output.lines.map(untagged).join('\n')
        assertEq(rust.split(': StaticArray<A>').length - 1, 4)
        assert(rust.includes('StaticArray(&[StaticAny::Nullish(Nullish::Null), StaticAny::Nullish(Nullish::Undefined), StaticAny::Boolean(false), StaticAny::Number(f64::from_bits(0x8000000000000000)), StaticAny::String(&LITERAL_0), StaticAny::BigInt(&LITERAL_1)])'))
        assertEq(rust.split('= StaticArray(&[]);').length - 1, 2)
        assert(output.uses.vm.includes('StaticAny'))
        assert(!unwrap(scopeTagged(body, options)).uses.vm.includes('StaticArray'))
    },
    nativeInlineFunctions: () => {
        const body = yielding([['ref', x]])
        /** @type {(parameters: readonly BindingId[]) => Value} */
        const reader = parameters => ['function', { ...fn, self: null, rest: null, parameters, body }]
        const rust = print([], ['array', [reader([x, y]), reader([y, x])]])
        assert(rust.includes('StaticArray(&[StaticAny::Function(&ITEM_0), StaticAny::Function(&ITEM_1)])'))
        assert(rust.includes('_args.argument(0)') && rust.includes('_args.argument(1)'))
        const dynamic = print([], ['object', [[':', 'f', ['function', { ...fn, body: yielding([['Boolean', 1]]) }]]]])
        assert(dynamic.includes('A::function_with_text') && dynamic.includes('.to_object()'))
    },
    nativeInlineContainers: () => {
        /** @type {Value} */
        const child = ['object', []]
        const pair = print([], ['array', [child, child]])
        assert(pair.includes('StaticArray(&[StaticAny::Object(&ITEM_0), StaticAny::Object(&ITEM_1)])'))
        const dynamic = print([], ['object', [[':', 'x', ['()', ['ref', x], []]], [':', 'x', child]]])
        assert(dynamic.includes('Any::call(') && dynamic.includes('.to_object()'))
        /** @type {Value} */
        let deep = 1
        for (let i = 0; i < 2048; i += 1) { deep = ['array', [deep]] }
        const rust = print([], deep)
        assertEq(rust.split(': StaticArray<A>').length - 1, 2048)
        assert(!rust.includes('.to_array()'))
    },
    nativeNamedArrays: () => {
        /** @type {Block['statements']} */
        const defs = [['define', x, ['array', [1]]], ['define', y, ['ref', x]]]
        const nested = print(defs, ['array', [['ref', x], ['ref', y]]])
        assert(nested.includes('static ARRAY_0: StaticArray<A>'))
        assert(nested.includes('StaticArray(&[StaticAny::Array(&ARRAY_0), StaticAny::Array(&ARRAY_0)])'))
        const record = print(defs, ['object', [[':', 'items', ['ref', y]]]])
        assert(record.includes('StaticObject(&[(&LITERAL_0, StaticAny::Array(&ARRAY_0))])'))
        const read = print(defs, ['function', { ...fn, captures: [{ binding: rest, value: ['ref', y] }], body: yielding([['ref', rest]]) }])
        assert(read.includes('frame: &StaticArray(&[StaticAny::Array(&ARRAY_0)])'))
    },
    nativeRepeatedArraySites: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Value} */
        const array = ['array', []]
        /** @type {Block} */
        const loopBody = { statements: [['define', rest, array]], exit: ['break', target] }
        /** @type {Block} */
        const body = {
            statements: [['while', { target, slot: x, initial: array, condition: array, body: loopBody, result: y, mutable: false }]],
            exit: ['loop', target, loopBody],
        }
        const rust = unwrap(scopeTagged(body, options, [], true)).lines.map(untagged).join('\n')
        assert(!rust.includes('StaticArray'))
        assertEq(rust.split('Array::default().to_any()').length - 1, 4)
    },
    nativeBigInts: () => {
        const wide = /** @type {const} */ (0x1_0000_0000_0000_0002n)
        const body = yielding([['array', [0n, -1n, wide, wide]]])
        const output = unwrap(scopeTagged(body, options, [], true))
        const lines = output.lines.map(untagged)
        assertEq(lines.filter(line => line.startsWith('static ')).length, 3)
        assert(lines.some(line => line.includes('Sign::Positive, words: &[]')))
        assert(lines.some(line => line.includes('Sign::Negative, words: &[0x0000000000000001]')))
        assert(lines.some(line => line.includes('Sign::Positive, words: &[0x0000000000000002, 0x0000000000000001]')))
        assertEq(lines.join('\n').split('StaticAny::BigInt(&LITERAL_2)').length, 3)
    },
    primitives: () => {
        for (const value of [undefined, null, true, false, 0, -0, 1, NaN, Infinity, -Infinity, '', 'a\ud800b', '\u{1f600}', 0n, -(2n ** 63n), 2n ** 64n]) {
            assert(text(value).length > 0)
            assert(text(value, true).startsWith('Ok('))
        }
    },
    operators: () => {
        /** @type {readonly Value[]} */
        const values = [
            ['!', true], ['~', 0], ['-', 1], ['typeof', 1], ['Number', '1'], ['BigInt', '1'], ['String', 1], ['Boolean', 0],
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
    /** Boolean dispatches through the shared body and retains its operand once. */
    booleanRuntime: () => {
        assertEq(text(['Boolean', 0], true),
            '{ let (boolean_value, boolean_body) = (f64_any(0x0), (Any::dot(runtime.clone(), string_any("Boolean")).end())?); Any::call(boolean_body, [boolean_value].to_array().to_any()) }')
        assertEq(text(['Boolean', ['()', ['ref', x], []]], true),
            '{ let (boolean_value, boolean_body) = ((Any::call(_b0.clone(), Array::default().to_any()))?, (Any::dot(runtime.clone(), string_any("Boolean")).end())?); Any::call(boolean_body, [boolean_value].to_array().to_any()) }')
        assertStructurallySame(valueTagged(['Boolean', 0], { ...options, runtime: null }),
            ['error', ['a Boolean operator with no runtime in scope; the core may not use what it defines', ['Boolean', 0]]])
    },
    /** Inspection borrows the complete operand, including fallible and conditional expressions. */
    borrowedInspectionOperands: () => {
        const supplied = unwrap(valueTagged(['typeof', ['ref', x]], options, [{ binding: x, text: 'supplied()', uses: [['vm', 'ToAny']] }], true))
        assertEq(untagged(supplied[0]), 'Any::typeof_(&supplied())')
        assertStructurallySame(supplied[1], [['vm', 'ToAny']])
        assertEq(text(['typeof', ['ref', x]], true), 'Any::typeof_(&_b0)')
        assertEq(text(['typeof', ['Number', null]], true), 'Any::typeof_(&(Any::number(Nullish::Null.to_any()))?)')
        assertEq(text(['typeof', ['if', true, yielding([1]), yielding([2])]], true),
            'Any::typeof_(&if Any::<A>::to_boolean(&true.to_any()) { f64_any(0x3ff0000000000000) } else { f64_any(0x4000000000000000) })')
        assertEq(text(['instanceof', ['Number', null], 'Array'], true),
            'Any::instanceof_(&(Any::number(Nullish::Null.to_any()))?, Constructor::Array)')
    },
    containers: () => {
        assertEq(text(['array', [0, -0]]), '[f64_any(0x0), f64_any(0x8000000000000000)].to_array().to_any()')
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
            `if Any::<A>::to_boolean(&true.to_any()) { ${expected} } else { Object::default().to_any() }`)
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
        assertEq(text(['memberPresent', ['array', []], 0]), '(Any::member_present(Array::default().to_any(), f64_any(0x0), &runtime))?')
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
    statementConditionalsOmitOnlyEmptyAlternates: () => {
        const condition = /** @type {const} */ (['()', ['ref', x], []])
        const yes = /** @type {const} */ ({ statements: [], exit: ['return', fn.target, 7] })
        const empty = yielding([])
        const absent = unwrap(scope({ statements: [['if', condition, yes, empty]], exit: ['yield', [0]] }, options)).lines.join('\n')
        assertEq(absent.includes(' else '), false)
        // Omitting the empty spelling must retain one fallible test evaluation.
        assertEq(absent.split('Any::call(').length - 1, 1)
        assert(absent.includes('Any::<A>::to_boolean(&(Any::call(_b0.clone(), Array::default().to_any()))?)'))
        assert(absent.includes('return Ok(f64_any(0x401c000000000000));'))
        const required = unwrap(scope({ statements: [['if', condition, yes, { statements: [], exit: ['throw', 3] }]], exit: ['yield', [0]] }, options)).lines.join('\n')
        assert(required.includes(' else '))
        assert(required.includes('return Err(f64_any(0x4008000000000000));'))
        // A value conditional always keeps its alternate, including undefined.
        assert(text(['if', condition, yielding([1]), yielding([undefined])]).includes(' else '))
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
    terminalLoopsHaveNoNormalTail: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 3 })
        /** @type {Block} */
        const body = {
            statements: [['define', x, 1]],
            exit: ['loop', target, { statements: [], exit: ['continue', target] }],
        }
        const plain = unwrap(scope(body, options))
        assertStructurallySame(plain.lines, [
            'let _b0: Any<A> = f64_any(0x3ff0000000000000);',
            "'_loop3: loop { continue '_loop3; }",
        ])
        assertStructurallySame(plain.lines, unwrap(scopeTagged(body, options)).lines.map(untagged))
        assertStructurallySame(plain.uses, { vm: [], unstable: ['f64_any'] })
        for (const result of [false, true]) {
            assertEq(text(['block', { statements: [], exit: body.exit }], result),
                "{ '_loop3: loop { continue '_loop3; } }")
        }
    },
    terminalLoopsRetainLexicalTransfers: () => {
        /** @type {LoopTarget} */
        const outer = { kind: 'loop', index: 0 }
        /** @type {LoopTarget} */
        const inner = { kind: 'loop', index: 0 }
        /** @type {Block} */
        const body = {
            statements: [],
            exit: ['loop', outer, {
                statements: [
                    ['define', x, 1],
                    ['loop', inner, {
                        statements: [['if', false,
                            { statements: [], exit: ['continue', outer] },
                            { statements: [], exit: ['break', inner] },
                        ]],
                        exit: ['yield', []],
                    }],
                ],
                exit: ['return', fn.target, ['ref', x]],
            }],
        }
        const code = unwrap(scope(body, options)).lines.join('\n')
        assert(code.startsWith("'_loop0: loop {"))
        assert(code.includes("'_loop0_1: loop {"))
        assert(code.includes("continue '_loop0;"))
        assert(code.includes("break '_loop0_1;"))
        assert(code.includes('return Ok(_b0.clone());'))
        const throws = unwrap(scope({ statements: [], exit: ['loop', outer, { statements: [], exit: ['throw', 2] }] }, options))
        assertEq(throws.lines.join('\n'), "'_loop0: loop { return Err(f64_any(0x4000000000000000)); }")
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
    structuralEquality: () => {
        assert(text(['structEq']).includes('Any::call(A::frame(_self)[0].clone()'))
        assertEq(valueTagged(['structEq'], { ...options, runtime: null })[0], 'error')
    },
    // The empty reference map is NaNVM's own: a new native map wherever
    // the node is established, under the helper's text, with a runtime in
    // scope or with none.
    referenceMap: () => {
        const written = text(['refMap'])
        assert(written.startsWith('ref_map(Some("(()=>{const $0=($1,$2)=>{const $3=new WeakMap();'), written)
        assert(written.endsWith('return $0;})()"))'), written)
        assertEq(untagged(unwrap(valueTagged(['refMap'], { ...options, runtime: null }))[0]), written)
    },
    helpers: () => {
        for (const tag of /** @type {const} */ (['entry', 'hasEntry', 'slice', 'Object.is', 'Number.isInteger', 'Math.trunc', 'Math.floor', 'Math.abs', 'Math.sqrt', 'Math.ceil', 'Math.imul', 'Math.max', 'Math.min'])) { assert(text([tag]).length > 0) }
        const native = unwrap(valueTagged(['Object.entries'], { ...options, runtime: null }))
        assert(untagged(native[0]).includes('Any::entries'))
        const chars = unwrap(valueTagged(['String.fromCharCode'], { ...options, runtime: null }))
        assert(untagged(chars[0]).includes('String::from_char_code(_args)'))
        const trunc = unwrap(valueTagged(['Math.trunc'], { ...options, runtime: null }))
        assertEq(untagged(trunc[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().map(|v| v.trunc().to_any()), 1, Array::default(), Some("function trunc() { [native code] }")).to_any()')
        const floor = unwrap(valueTagged(['Math.floor'], { ...options, runtime: null }))
        assertEq(untagged(floor[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().map(|v| v.floor().to_any()), 1, Array::default(), Some("function floor() { [native code] }")).to_any()')
        const abs = unwrap(valueTagged(['Math.abs'], { ...options, runtime: null }))
        assertEq(untagged(abs[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().map(|v| v.abs().to_any()), 1, Array::default(), Some("function abs() { [native code] }")).to_any()')
        const sqrt = unwrap(valueTagged(['Math.sqrt'], { ...options, runtime: null }))
        assertEq(untagged(sqrt[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().map(|v| v.sqrt().to_any()), 1, Array::default(), Some("function sqrt() { [native code] }")).to_any()')
        const ceil = unwrap(valueTagged(['Math.ceil'], { ...options, runtime: null }))
        assertEq(untagged(ceil[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().map(|v| v.ceil().to_any()), 1, Array::default(), Some("function ceil() { [native code] }")).to_any()')
        const imul = unwrap(valueTagged(['Math.imul'], { ...options, runtime: null }))
        assertEq(untagged(imul[0]), 'A::static_function(|_self, _args| _args.argument(0).to_number().and_then(|a| _args.argument(1).to_number().map(|b| a.imul(b).to_any())), 2, Array::default(), Some("function imul() { [native code] }")).to_any()')
        const max = unwrap(valueTagged(['Math.max'], { ...options, runtime: null }))
        assertEq(untagged(max[0]), 'A::static_function(|_self, _args| _args.into_iter().try_fold(Number::from(f64::NEG_INFINITY), |current, value| value.to_number().map(|value| current.max(value))).map(|value| value.to_any()), 2, Array::default(), Some("function max() { [native code] }")).to_any()')
        const min = unwrap(valueTagged(['Math.min'], { ...options, runtime: null }))
        assertEq(untagged(min[0]), 'A::static_function(|_self, _args| _args.into_iter().try_fold(Number::from(f64::INFINITY), |current, value| value.to_number().map(|value| current.min(value))).map(|value| value.to_any()), 2, Array::default(), Some("function min() { [native code] }")).to_any()')
    },
    layout: () => {
        assertEq(braced(['Ok(v)']), '{ Ok(v) }')
        assert(braced(['let v = 1;', 'Ok(v)']).includes('\n'))
        const uses = { vm: ['ToAny', 'Array'], unstable: ['f64_any'] }
        assertStructurallySame(useLines(uses, 'IVm'), useLinesTagged(uses, 'IVm').map(untagged))
        assert(useLines({ vm: [], unstable: [] }, 'IVm').length > 0)
        const long = generate(30, i => `LongName${i}`)
        assert(useLines({ vm: long, unstable: ['single'] }, 'IVm').length > 3)
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
        assertStructurallySame(useLines({ vm: [], unstable: generate(11, i => `helper_number_${i}`) }, 'IVm'), [
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
            [{ vm: [], unstable: generate(11, i => `helper_number_${i}`) }, 'IVm', 2],
        ]
        for (const [uses, bound, statements] of cases) {
            const marked = unwrap(fromTagged(useLinesTagged(uses, bound).join('\n')))
            assertEq(toJson(marked.filter(([, kind]) => kind === 'keyword').map(([text]) => text)), toJson(generate(statements, () => 'use')))
            assertEq(toText(marked), useLines(uses, bound).join('\n'))
            assertEq(toJson(unmarkedWords(marked)), '[]')
        }
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
