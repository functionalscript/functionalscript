/** @import { Exp } from '../../../edag/types.ts' */
import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { fromTagged } from '../../../text/marked/module.f.mjs'
import { occurrences } from '../../../types/string/module.f.mjs'
import runtime from '../../../js/runtime/gen.edag.data.js'
import { generateRuntime, generateRuntimeTagged } from './module.f.mjs'

/** A function node: its length, slots and body. @type {(length: number, slots: readonly Exp[], body: Exp) => Exp} */
const fn = (length, slots, body) => ['=>', length, slots, body]

/** An object literal node. @type {(entries: readonly (readonly [string, Exp])[]) => Exp} */
const object = entries => ['{}', entries.map(([key, value]) => [':', key, value])]

/** `id => entry(table, id)`, the runtime's `static` over a table. @type {(table: Exp) => Exp} */
const over = table => fn(1, [table], ['()', ['entry'], [['frame', 0], ['arg', 0]]])

/** A runtime module: its `statics` table, and the `runtime` export, by default `static` over the table. @type {(statics: Exp, value?: Exp) => Exp} */
const module = (statics, value = object([['static', over(statics)]])) => ['{}', [[':', 'statics', statics], [':', 'runtime', value]]]

/** The refusal of a module, as text. @type {(root: Exp) => string} */
const refusal = root => assertError(generateRuntime(root))

/** The value item alone, after the header and the `use` lines. @type {(rust: string) => string} */
const item = rust => rust.slice(rust.indexOf('/// The runtime as a value'))

/** Required initializers appear in the order the export object evaluates them. @type {(rust: string, fragments: readonly string[]) => void} */
const inOrder = (rust, fragments) => {
    const positions = fragments.map(fragment => rust.indexOf(fragment))
    assert(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])))
}

export const proof = {
    unusedStaticsPreserveThrows: () => {
        /** @type {readonly (readonly [number, string])[]} */
        const cases = [[123, '0x405ec00000000000'], [7, '0x401c000000000000']]
        for (const [value, bits] of cases) {
            /** @type {Exp} */
            const statics = [',', [['throw', value], object([])]]
            const rust = assertOk(generateRuntime(module(statics, object([]))))
            inOrder(rust, [`Err::<Any<A>, Any<A>>(f64_any(${bits}))`, '\n    Ok('])
        }
    },
    unusedStaticsKeepNestedAndImportedInitializers: () => {
        const body = fn(0, [], 7)
        /** @type {Exp} */
        const imported = [',', [['.', null, 'imported'], object([['f', body]])]]
        /** @type {Exp} */
        const entry = [',', [['.', null, 'entry'], ['.', imported, 'f']]]
        /** @type {Exp} */
        const statics = [',', [['.', null, 'outer'], [',', [['.', null, 'inner'], object([['Object.f', entry]])]]]]
        const rust = assertOk(generateRuntime(module(statics, object([]))))
        inOrder(rust, ['string_any("outer")', 'string_any("inner")', 'string_any("entry")', 'string_any("imported")', 'Some("function f() { [native code] }")', '\n    Ok('])
    },
    exportInitializationKeepsRawOrder: () => {
        /** @type {Exp} */
        const runtimeFirst = [',', [['throw', 7], object([])]]
        /** @type {Exp} */
        const staticsSecond = [',', [['throw', 123], object([])]]
        /** @type {Exp} */
        const source = [',', [['.', null, 'module'], object([['runtime', runtimeFirst], ['statics', staticsSecond]])]]
        const rust = assertOk(generateRuntime(source))
        inOrder(rust, ['string_any("module")', 'Err::<Any<A>, Any<A>>(f64_any(0x401c000000000000))', 'Err::<Any<A>, Any<A>>(f64_any(0x405ec00000000000))', '\n    Ok('])
    },
    duplicateExportsKeepEarlierInitializationAndLastMetadata: () => {
        /** @type {Exp} */
        const earlierStatics = [',', [['throw', 7], 1]]
        /** @type {Exp} */
        const earlierRuntime = [',', [['throw', 123], true]]
        const statics = object([['Object.last', fn(0, [], 2)]])
        const source = object([['statics', earlierStatics], ['runtime', earlierRuntime], ['statics', statics], ['runtime', object([['last', 3]])]])
        const rust = assertOk(generateRuntime(source))
        inOrder(rust, ['Err::<Any<A>, Any<A>>(f64_any(0x401c000000000000))', 'Err::<Any<A>, Any<A>>(f64_any(0x405ec00000000000))', 'Some("function last() { [native code] }")', 'string_key("last")', '\n    Ok('])
    },
    sharedInitializersAndNativeFunctionIdentity: () => {
        const body = fn(0, [], 7)
        /** @type {Exp} */
        const statics = [',', [['.', null, 'once'], object([['Object.f', body]])]]
        /** @type {Exp} */
        const value = ['[]', [statics, body, body]]
        const rust = assertOk(generateRuntime(module(statics, value)))
        assertEq(occurrences('string_any("once")')(rust), 1)
        assertEq(occurrences('Some("function f() { [native code] }")')(rust), 1)
        assertEq(occurrences('string_key("Object.f")')(rust), 1)
        assert(!rust.includes('Some("()=>7")'))
    },
    initializationPrefixesRemainBeforeTheRuntimeValue: () => {
        const first = /** @type {Exp} */ (['.', null, 'first'])
        const second = /** @type {Exp} */ (['.', null, 'second'])
        const source = /** @type {Exp} */ ([',', [first, [',', [second, module(object([]), object([]))]]]])
        const rust = assertOk(generateRuntime(source))
        const firstAt = rust.indexOf('string_any("first")')
        const secondAt = rust.indexOf('string_any("second")')
        const resultAt = rust.indexOf('\n    Ok(')
        assert(firstAt >= 0 && secondAt > firstAt && resultAt > secondAt)
        assert(refusal([',', []]).startsWith('the runtime module is no object of exports: '))
    },
    metadataFollowsSequencedImportsWithoutDroppingTheirWork: () => {
        const body = fn(0, [], 7)
        const imported = /** @type {Exp} */ ([',', [['.', null, 'imported'], object([['f', body]])]])
        const statics = /** @type {Exp} */ ([',', [['.', null, 'table'], object([['Object.f', ['.', imported, 'f']]])]])
        const rust = assertOk(generateRuntime(module(statics)))
        assert(rust.includes('Some("function f() { [native code] }")'))
        assert(rust.includes('string_any("imported")') && rust.includes('string_any("table")'))
        const direct = /** @type {Exp} */ ([',', [['.', null, 'direct'], body]])
        const directRust = assertOk(generateRuntime(module(object([['Object.f', direct]]))))
        assert(directRust.includes('Some("function f() { [native code] }")') && directRust.includes('string_any("direct")'))
        const native = /** @type {Exp} */ ([',', [['.', null, 'native'], ['Object.entries']]])
        const nativeRust = assertOk(generateRuntime(module(object([['Object.entries', native]]))))
        assert(nativeRust.includes('Any::entries(') && nativeRust.includes('string_any("native")'))
        assertEq(refusal(module(object([['Object.f', [',', []]]]))), 'a built-in that is no function: Object.f')
    },
    /**
     * The repository's runtime, from its compiled EDAG: one item, the
     * value, under the generated header and the `use` lines it spells.
     * Every static body carries the NativeFunction text of its id;
     * `Object.entries` is the closure over `Any::entries` under its own; a
     * member body keeps its own text, as every other function does; the
     * intrinsics `found` and `codePointAt` call ask no runtime; and the
     * value is the two functions. No static is read and no member called:
     * the module has no runtime in scope, and the printer would refuse
     * either.
     */
    runtime: () => {
        const rust = assertOk(generateRuntime(/** @type {Exp} */ (/** @type {unknown} */ (runtime))))
        for (const line of [
            '// @generated by `npm run gen` from `fjs/js/runtime/module.f.js`. Do not edit: change the runtime and regenerate.',
            '#[rustfmt::skip]\n#[allow(clippy::if_same_then_else)]\npub fn runtime<A: IStaticFunction>() -> Result<Any<A>, Any<A>> {',
            'Some("function is() { [native code] }")',
            'Some("function isNaN() { [native code] }")',
            'Some("function isInteger() { [native code] }")',
            'A::static_function(|_self, _args| Any::entries(_args.argument(0)), 1, Array::default(), Some("function entries() { [native code] }")).to_any()',
            'Some("($0)=>{const $1=$0===0;return $1?1/$0<0:$1;}")',
            'string_any("slice")).end_call_native(|| Ok([_args.argument(1), _args.argument(2)].to_array().to_any()))',
            'string_any("charCodeAt")).end_call_native(|| Ok([_args.argument(1)].to_array().to_any()))',
            '(string_key("Object.is"), ',
            '(string_key("startsWith"), ',
            '(string_key("static"), ',
            '(string_key("dot"), ',
        ]) {
            assert(rust.includes(line), line)
        }
        assert(!rust.includes('function startsWith()') && !rust.includes('function codePointAt()') && !rust.includes('string_key("member")'))
        assert(!rust.includes('static_read') && !rust.includes('end_call(&') && !rust.includes('IVm'))
        assertEq(occurrences('pub fn ')(rust), 1)
        // the tagged text resolves, every tag closed
        assertOk(fromTagged(assertOk(generateRuntimeTagged(/** @type {Exp} */ (/** @type {unknown} */ (runtime))))))
    },
    /**
     * A small module, whole: a helper a static body captures, the body a
     * closure in the table under the NativeFunction text of its id, the
     * helper under its body's, and `static` over the table, in one
     * `runtime` item.
     */
    small: () => {
        const helper = fn(1, [], ['+', ['arg', 0], 1])
        const inc = fn(1, [helper, 2, ['undefined'], 's'], ['[]', [['()', ['frame', 0], [['arg', 0]]], ['frame', 1], ['frame', 2], ['frame', 3], ['self']]])
        assertEq(assertOk(generateRuntime(module(object([['Object.inc', inc]])))), "// @generated by `npm run gen` from `fjs/js/runtime/module.f.js`. Do not edit: change the runtime and regenerate.\n\nuse nanvm_lib::vm::unstable::{f64_any, string_any, string_key};\nuse nanvm_lib::vm::{Any, Array, Function, IStaticFunction, Nullish, ToAny, ToArray, ToObject};\n\n/// The runtime as a value: the `runtime` export of `fjs/js/runtime`, its `static`, `dot` and `in`\n/// functions, the first two over the tables they close over, as the ordinary backend prints any module — every\n/// static body a closure carrying the NativeFunction text of its id, `Object.entries` the built-in\n/// itself. Built once by whoever runs compiled modules and handed to each as its parameter\n/// (`fjs/js/runtime/README.md`).\n#[rustfmt::skip]\n#[allow(clippy::if_same_then_else)]\npub fn runtime<A: IStaticFunction>() -> Result<Any<A>, Any<A>> {\n    let _b2: Any<A> = A::static_function(|_self, _args| { _args.argument(0) + f64_any(0x3ff0000000000000) }, 1, Array::default(), Some(\"($0)=>$0+1\")).to_any();\n    let _b12: Any<A> = A::static_function(|_self, _args| { Ok([(Any::call(A::frame(_self)[0].clone(), [_args.argument(0)].to_array().to_any()))?, A::frame(_self)[1].clone(), A::frame(_self)[2].clone(), A::frame(_self)[3].clone(), Function::new(_self.clone()).to_any()].to_array().to_any()) }, 1, [_b2.clone(), f64_any(0x4000000000000000), Nullish::Undefined.to_any(), string_any(\"s\")].to_array(), Some(\"function inc() { [native code] }\")).to_any();\n    let _b13: Any<A> = [(string_key(\"Object.inc\"), _b12.clone())].to_object().to_any();\n    let _b19: Any<A> = [(string_key(\"static\"), A::static_function(|_self, _args| {\n        let _b14: Any<A> = A::static_function(|_self, _args| Any::entry(_args.argument(0), _args.argument(1)), 2, Array::default(), Some(\"($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}\")).to_any();\n        Any::call(_b14.clone(), [A::frame(_self)[0].clone(), _args.argument(0)].to_array().to_any())\n    }, 1, [_b13.clone()].to_array(), Some(\"($1)=>{const $2=($3,$4)=>{const $5=Object.getOwnPropertyDescriptor($3,$4);return $5?.enumerable?$5.value:undefined;};return $2($0,$1);}\")).to_any())].to_object().to_any();\n    Ok(_b19.clone())\n}\n")
    },
    /**
     * The `runtime` export is printed whatever it holds: the empty object,
     * a `dot` beside `static`, which keeps its body's text. A built-in is
     * found through an import's read of its export object, `{ f }.f`, and
     * a module-level value a body captures that is no function — data the
     * runtime holds — is printed as the ordinary backend prints it. An
     * export beside the two, `member`, is the module's own.
     */
    shape: () => {
        const one = fn(0, [], 1)
        const none = assertOk(generateRuntime(module(object([]), object([]))))
        assert(item(none).includes('pub fn runtime<A: IVm>() -> Result<Any<A>, Any<A>> {\n'))
        assert(none.endsWith('    let _b1: Any<A> = Object::default().to_any();\n    Ok(_b1.clone())\n}\n'))
        const withDot = assertOk(generateRuntime(module(object([]), object([['dot', fn(2, [], ['undefined'])]]))))
        assert(withDot.includes('(string_key("dot"), A::static_function(') && withDot.includes('Some("($0,$1)=>undefined")') && !withDot.includes('"static"'))
        const imported = assertOk(generateRuntime(module(object([['Object.f', ['.', object([['f', one]]), 'f']]]))))
        assert(imported.includes('Some("function f() { [native code] }")'))
        const data = assertOk(generateRuntime(module(object([['Object.f', fn(0, [['[]', [1, 2]]], ['frame', 0])]]))))
        assert(data.includes('[f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)].to_array().to_any()'))
        const table = object([['Object.f', one]])
        const beside = assertOk(generateRuntime(['{}', [[':', 'member', object([['x', one]])], [':', 'statics', table], [':', 'runtime', object([['static', over(table)]])]]]))
        assert(beside.includes('Some("function f() { [native code] }")') && !beside.includes('"x"'))
    },
    /**
     * The core may not use what it defines: a body calling a member
     * function, or reading a static function the runtime defines, is
     * refused by the backend, naming the step or the static, since the
     * module has no runtime in scope — where the native static
     * `Object.entries`, which the table lists as itself, is the closure
     * over `Any::entries`, and an intrinsic's call step asks no runtime.
     */
    core: () => {
        const member = module(object([['Object.f', fn(1, [], ['.', ['arg', 0], 'slice', ['|()', [1]]])]]))
        assert(refusal(member).startsWith('a member call with no runtime in scope; the core may not use what it defines: '))
        const guarded = module(object([['Object.f', fn(1, [], ['?.', ['arg', 0], 'slice', ['|?.()', [1]]])]]))
        assert(refusal(guarded).startsWith('a member call with no runtime in scope; the core may not use what it defines: '))
        const nested = module(object([['Object.f', fn(0, [], fn(1, [], ['.', ['arg', 0], 'slice', ['|()', [1]]]))]]))
        assert(refusal(nested).startsWith('a member call with no runtime in scope; the core may not use what it defines: '))
        assertEq(refusal(module(object([['Object.f', fn(0, [], ['Number.isNaN'])]]))), 'a static function read with no runtime in scope; the core may not use what it defines: Number.isNaN')
        assertEq(refusal(module(object([['Object.f', fn(0, [['Object.is']], ['frame', 0])]]))), 'a static function read with no runtime in scope; the core may not use what it defines: Object.is')
        const listed = assertOk(generateRuntime(module(object([['Object.entries', ['Object.entries']]]))))
        assert(listed.includes('Any::entries('))
        const read = assertOk(generateRuntime(module(object([['Object.f', fn(0, [['Object.entries']], ['frame', 0])]]))))
        assert(read.includes('Any::entries('))
        const slice = assertOk(generateRuntime(module(object([['Object.f', fn(1, [['slice']], ['()', ['frame', 0], [['arg', 0], 1]])]]))))
        assert(slice.includes('.end_call_native('))
    },
    /**
     * Refused before the backend sees the module: a module that is no
     * object of exports, one without the `runtime` export or without a
     * `statics` export that is an object literal, an entry that is no
     * function, a body under a path every executor binds natively, and one
     * function two ids name, which JavaScript keeps apart and which could
     * carry only one text.
     */
    refusals: () => {
        assert(refusal(['[]', []]).startsWith('the runtime module is no object of exports: '))
        assert(refusal(['{}', [['...', object([])]]]).startsWith('the runtime module is no object of exports: '))
        assert(refusal(['{}', [[':', 1, object([])]]]).startsWith('the runtime module is no object of exports: '))
        assert(refusal(['{}', []]).startsWith('no `runtime` export: '))
        assert(refusal(['{}', [[':', 'statics', object([])]]]).startsWith('no `runtime` export: '))
        assert(refusal(['{}', [[':', 'runtime', object([])]]]).startsWith('no `statics` export of an object literal: '))
        assertEq(refusal(module(1)), 'no `statics` export of an object literal: 1')
        assert(refusal(module(['{}', [['...', object([])]]])).startsWith('no `statics` export of an object literal: '))
        assert(refusal(module(['{}', [[':', 1, fn(0, [], 1)]]])).startsWith('no `statics` export of an object literal: '))
        assertEq(refusal(module(object([['Object.x', 1]]))), 'a built-in that is no function: Object.x')
        assertEq(refusal(module(object([['Object.x', ['.', object([['y', 1]]), 'x']]]))), 'a built-in that is no function: Object.x')
        assertEq(refusal(module(object([['Object.x', ['.', ['[]', []], 'x']]]))), 'a built-in that is no function: Object.x')
        assertEq(refusal(module(object([['Object.is', ['Object.is']]]))), 'a built-in that is no function: Object.is')
        assertEq(refusal(module(object([['Object.entries', fn(1, [], 1)]]))), 'a body for a static every executor binds natively: Object.entries')
        const shared = fn(0, [], 1)
        assertEq(refusal(module(object([['Number.isNaN', shared], ['Global.isNaN', shared]]))), 'a function two built-ins name; JavaScript keeps them apart: Global.isNaN')
        // a property written twice keeps its last value, as the EDAG means
        // it, and is one built-in
        assert(assertOk(generateRuntime(module(object([['Object.g', fn(0, [], 1)], ['Object.g', fn(0, [], 7)]])))).includes('f64_any(0x401c000000000000)'))
    },
}
