/**
 * Proofs for the static runtime's printer.
 *
 * @import { Exp } from '../../../edag/types.ts'
 */

import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.mjs'
import { fromTagged } from '../../../text/marked/module.f.mjs'
import runtime from '../../../js/runtime/gen.edag.data.mjs'
import { generateRuntime, generateRuntimeTagged } from './module.f.mjs'

/** A function node. @type {(length: number, slots: readonly Exp[], body: Exp) => Exp} */
const fn = (length, slots, body) => ['=>', length, slots, body]

/** A module exporting `runtime` with the two sections. @type {(sections: readonly (readonly [string, Exp])[]) => Exp} */
const module = sections => ['{}', [[':', 'runtime', ['{}', sections.map(([name, value]) => [':', name, value])]]]]

/** An object literal of named values. @type {(entries: readonly (readonly [string, Exp])[]) => Exp} */
const object = entries => ['{}', entries.map(([key, value]) => [':', key, value])]

/** The reason a module is refused. @type {(root: Exp) => string} */
const refusal = root => assertError(generateRuntime(root))

export const proof = {
    /**
     * The runtime itself, as `npm run gen` prints it: a static function per
     * body, named by its section — a static by its namespace and key, with
     * its accessor; a member by its name, the code alone, bound on
     * `IStaticFunction` since it makes the function of the arguments, a
     * closure over its receiver — the helpers no section names by their
     * index, an import's export object folded to the function it holds,
     * every frame slot a reference to an item, and the two tables, the
     * natives `nanvm-lib` writes listed beside the bodies.
     */
    runtime: () => {
        const rust = assertOk(generateRuntime(/** @type {Exp} */ (/** @type {unknown} */ (runtime))))
        for (const line of [
            'pub fn object_is<A: IVm>() -> &\'static RuntimeFunction<A> {',
            // a helper is the module's own
            '\nfn f0<A: IVm>() -> &\'static RuntimeFunction<A> {',
            '    &RuntimeFunction { name: "Object.is", code: object_is_code::<A>, length: 2 }',
            '/// `startsWith`\n#[rustfmt::skip]\nfn starts_with<A: IStaticFunction>(self_: Any<A>) -> Result<Any<A>, Any<A>> {',
            'name: "Number.isNaN", code: number_is_nan_code::<A>',
            // `isNegativeZero`, imported and captured by `is`: a helper, read
            // off its module's export object and referenced by its item
            'let c1: Any<A> = Function::from(f0::<A>()).to_any();',
            // the member's function of the arguments: a closure over the
            // receiver, which the helpers it calls join in the frame
            'A::static_function(|self_, args| {',
            '        ("Object.is", object_is),',
            '        ("Number.isNaN", number_is_nan),',
            '        ("Object.entries", object_entries),',
            '        ("startsWith", starts_with),',
            'use nanvm_lib::vm::unstable::{f64_any, strict_eq, strict_ne, string_any, string_key};',
            // the runtime as a value, beside the tables: every built-in a
            // closure carrying the NativeFunction text of its path, a
            // helper its body's, `Object.entries` the built-in itself
            'pub fn runtime<A: IStaticFunction>() -> Result<Any<A>, Any<A>> {',
            ', 2, [c2, c3.clone()].to_array(), Some("function is() { [native code] }")).to_any();',
            'Some("function isNaN() { [native code] }")',
            'Some("function startsWith() { [native code] }")',
            'Some("($0)=>$0===0&&1/$0<0")',
            '(string_key("entries"), c5)',
            'Ok([(string_key("static"), c11), (string_key("member"), c19.clone()), (string_key("dot"), c25)].to_object().to_any())',
        ]) {
            assert(rust.includes(line), line)
        }
        // no static evaluates anything or reads a frame: a closure is made
        // in the one member alone — and for the intrinsic `found` captures,
        // `slice`, its value where the slot is read — and no member has a
        // descriptor
        const statics = rust.slice(0, rust.indexOf('/// `startsWith`'))
        assertEq(statics.split('static_function').length, statics.split('A::static_function(|_self, args| Any::dot(args.argument(0), string_any("slice"))').length)
        assert(!statics.includes('A::frame'))
        assert(!rust.includes('String.prototype'))
    },
    /**
     * A small module, whole: a helper the static captures, an argument
     * read, a literal in every atom kind inlined where the slot is read,
     * `self` as the item itself, and a member reading its receiver, the
     * code alone, a `fn` of the receiver. The two tables list the natives
     * after the sections', and the value follows, every built-in a closure
     * under the NativeFunction text of its path.
     */
    small: () => {
        const helper = fn(1, [], ['+', ['arg', 0], 1])
        const inc = fn(1, [helper, 2, ['undefined'], 's'], ['[]', [['()', ['frame', 0], [['arg', 0]]], ['frame', 1], ['frame', 2], ['frame', 3], ['self']]])
        const root = module([
            ['static', object([['Object', object([['inc', inc]])]])],
            ['member', object([['tail', fn(1, [], ['[]', [['arg', 0]]])]])],
        ])
        assertEq(assertOk(generateRuntime(root)), `// @generated by \`npm run gen\` from \`fjs/js/runtime/module.f.js\`. Do not edit: change the runtime and regenerate.

use nanvm_lib::vm::unstable::{f64_any, string_any, string_key};
use nanvm_lib::vm::{
    Accessor, Any, Array, Function, IStaticFunction, IVm, MemberCode, Nullish, RuntimeFunction,
    ToAny, ToArray, ToObject, object_entries,
};

/// \`f0\`
#[rustfmt::skip]
fn f0_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> {
    args.argument(0) + f64_any(0x3ff0000000000000)
}

#[rustfmt::skip]
fn f0<A: IVm>() -> &'static RuntimeFunction<A> {
    &RuntimeFunction { name: "f0", code: f0_code::<A>, length: 1 }
}

/// \`Object.inc\`
#[rustfmt::skip]
fn object_inc_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> {
    let c0: Any<A> = Any::call(Function::from(f0::<A>()).to_any(), [args.argument(0)].to_array().to_any())?;
    Ok([c0, f64_any(0x4000000000000000), Nullish::Undefined.to_any(), string_any("s"), Function::from(object_inc::<A>()).to_any()].to_array().to_any())
}

#[rustfmt::skip]
pub fn object_inc<A: IVm>() -> &'static RuntimeFunction<A> {
    &RuntimeFunction { name: "Object.inc", code: object_inc_code::<A>, length: 1 }
}

/// \`tail\`
#[rustfmt::skip]
fn tail<A: IStaticFunction>(self_: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok([self_.clone()].to_array().to_any())
}

#[rustfmt::skip]
pub(crate) fn statics<A: IVm>() -> [(&'static str, Accessor<A>); 2] {
    [
        ("Object.inc", object_inc),
        ("Object.entries", object_entries),
    ]
}

#[rustfmt::skip]
pub(crate) fn members<A: IStaticFunction>() -> [(&'static str, MemberCode<A>); 1] {
    [
        ("tail", tail),
    ]
}

/// The runtime as a value: the \`runtime\` export of \`fjs/js/runtime\`, its \`static\`, \`member\` and \`dot\`
/// sections, as the ordinary backend prints any module — every built-in a closure carrying the
/// NativeFunction text of its path, \`Object.entries\` the built-in itself. Built once by its caller,
/// and read by nothing yet (\`fjs/js/todo/runtime-value.md\`).
#[rustfmt::skip]
pub fn runtime<A: IStaticFunction>() -> Result<Any<A>, Any<A>> {
    let c0: Any<A> = A::static_function(|_self, args| { args.argument(0) + f64_any(0x3ff0000000000000) }, 1, Array::default(), Some("($0)=>$0+1")).to_any();
    let c1: Any<A> = A::static_function(|self_, args| {
        let c0: Any<A> = Any::call(A::frame(self_)[0].clone(), [args.argument(0)].to_array().to_any())?;
        Ok([c0, A::frame(self_)[1].clone(), A::frame(self_)[2].clone(), A::frame(self_)[3].clone(), Function::new(self_.clone()).to_any()].to_array().to_any())
    }, 1, [c0, f64_any(0x4000000000000000), Nullish::Undefined.to_any(), string_any("s")].to_array(), Some("function inc() { [native code] }")).to_any();
    let c2: Any<A> = [(string_key("inc"), c1)].to_object().to_any();
    let c3: Any<A> = [(string_key("Object"), c2)].to_object().to_any();
    let c4: Any<A> = A::static_function(|_self, args| { Ok([args.argument(0)].to_array().to_any()) }, 1, Array::default(), Some("function tail() { [native code] }")).to_any();
    let c5: Any<A> = [(string_key("tail"), c4)].to_object().to_any();
    Ok([(string_key("static"), c3), (string_key("member"), c5)].to_object().to_any())
}
`)
        // the tagged text resolves, every tag closed
        assertOk(fromTagged(assertOk(generateRuntimeTagged(root))))
    },
    /**
     * Either section may be absent; with none, the tables hold the natives
     * alone and `members` is empty. A body reading no argument takes
     * `_args`, a member's `_self`, a static reading `rest` binds it first,
     * and a body reading a nested thunk keeps the thunk's lines under its
     * `let`.
     */
    sections: () => {
        const one = fn(0, [], 1)
        const statics = assertOk(generateRuntime(module([['static', object([['Number', object([['one', one]])]])]])))
        assert(statics.includes('fn number_one_code<A: IVm>(_args: Array<A>) -> Result<Any<A>, Any<A>> {'))
        assert(statics.includes('pub(crate) fn members<A: IStaticFunction>() -> [(&\'static str, MemberCode<A>); 0] {\n    []\n}'))
        const members = assertOk(generateRuntime(module([['member', object([['one', one]])]])))
        assert(members.includes('pub(crate) fn statics<A: IVm>() -> [(&\'static str, Accessor<A>); 1] {\n    [\n        ("Object.entries", object_entries),\n    ]\n}'))
        assert(members.includes('fn one<A: IStaticFunction>(_self: Any<A>)') && members.includes('("one", one)'))
        assert(!members.includes('RuntimeFunction'))
        const tail = assertOk(generateRuntime(module([['static', object([['Object', object([['tail', fn(1, [], ['rest'])]])]])]])))
        assert(tail.includes('fn object_tail_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> {\n    let rest = args.rest(1);\n    Ok(rest.clone().to_any())\n}'))
        const none = assertOk(generateRuntime(module([])))
        assert(none.includes('Accessor<A>); 1]') && none.includes('MemberCode<A>); 0]'))
        // the `dot` dispatcher is no item, and must be a function: it is
        // in the value alone
        const withDot = assertOk(generateRuntime(module([['dot', fn(2, [], ['undefined'])]])))
        /** @type {(rust: string) => string} */
        const items = rust => rust.slice(rust.indexOf('#[rustfmt::skip]'), rust.indexOf('/// The runtime as a value'))
        assertEq(items(withDot), items(none))
        assert(withDot.includes('(string_key("dot"), c0)') && !none.includes('string_key'))
        assertEq(refusal(module([['dot', 'x']])), 'a `dot` section that is no function: x')
        assertEq(refusal(module([['dot', object([])]])), 'a `dot` section that is no function: {},')
        // and no built-in may name the very function `dot` is: refused by
        // the built-in's name, never a table naming an item that is not there
        const shared = fn(2, [], ['undefined'])
        assertEq(refusal(module([['static', object([['Object', object([['is', shared]])]])], ['dot', shared]])), 'a built-in naming the `dot` dispatcher; the dispatcher is no built-in: Object.is')
        assertEq(refusal(module([['member', object([['startsWith', shared]])], ['dot', shared]])), 'a built-in naming the `dot` dispatcher; the dispatcher is no built-in: startsWith')
        // nor may a built-in's body capture it, directly or through a
        // function it captures: refused, never an item the table lacks
        assertEq(refusal(module([['static', object([['Object', object([['f', fn(0, [shared], ['frame', 0])]])]])], ['dot', shared]])), 'a body capturing the `dot` dispatcher; no built-in reaches it: dot')
        assertEq(refusal(module([['member', object([['startsWith', fn(1, [fn(0, [shared], ['frame', 0])], ['frame', 0])]])], ['dot', shared]])), 'a body capturing the `dot` dispatcher; no built-in reaches it: dot')
        const lazy = assertOk(generateRuntime(module([['static', object([['Number', object([['f', fn(1, [], ['&&', ['arg', 0], ['+', ['arg', 0], 1]])]])]])]])))
        assert(lazy.includes('    let c0 = || args.argument(0) + f64_any(0x3ff0000000000000);\n    Any::logical_and(args.argument(0), c0)\n'))
    },
    /** A built-in's identifier is `builtInIdentifier`'s, `isNaN` as `is_nan`. */
    identifiers: () => {
        const rust = assertOk(generateRuntime(module([['static', object([['Number', object([['isNaN', fn(0, [], 1)]])]])]])))
        assert(rust.includes('pub fn number_is_nan<A: IVm>()'))
    },
    /**
     * A module-level value a body captures that is neither a function nor
     * a literal is refused, naming the node — an array, an operation, an
     * import read off something that is no object literal or has no such
     * key, a read with a continuation — as is a section or a namespace that
     * is no object, a built-in that is no function, and a module without
     * the `runtime` export.
     */
    refusals: () => {
        /** @type {(slot: Exp) => string} */
        const capturing = slot => refusal(module([['static', object([['Object', object([['f', fn(0, [slot], ['frame', 0])]])]])]]))
        const prefix = 'no static Rust for a module-level node; the runtime holds functions and literals: '
        assert(capturing(['[]', []]).startsWith(prefix))
        assert(capturing(['+', 1, 2]).startsWith(prefix))
        assert(capturing(['.', ['[]', []], 'x']).startsWith(prefix))
        assert(capturing(['.', object([['y', 1]]), 'x']).startsWith(prefix))
        assert(capturing(['.', object([['x', 1]]), 0]).startsWith(prefix))
        assert(capturing(/** @type {Exp} */ (/** @type {unknown} */ (['.', object([['x', 1]]), 'x', ['|.', 'y']]))).startsWith(prefix))
        assert(capturing(['{}', [['...', object([])]]]).startsWith(prefix))
        assert(capturing(['{}', [[':', ['+', 1, 2], 1]]]).startsWith(prefix))
        // a helper a body captures — `entry`, `hasEntry`, an intrinsic —
        // prints as its value where the slot is read, never as the
        // `undefined` an unprinted atom would be
        /** @type {(slot: Exp) => string} */
        const captured = slot => assertOk(generateRuntime(module([['static', object([['Object', object([['f', fn(0, [slot], ['frame', 0])]])]])]])))
        assert(captured(['entry']).includes('Ok(A::static_function(|_self, args| Any::entry(args.argument(0), args.argument(1)), 2, Array::default(), Some('))
        assert(captured(['hasEntry']).includes('Any::has_entry(args.argument(0), args.argument(1))'))
        assert(captured(['slice']).includes('Ok(A::static_function(|_self, args| Any::dot(args.argument(0), string_any("slice")).end_call(|| Ok([args.argument(1), args.argument(2)].to_array().to_any())), 3, Array::default(), Some("($0,$1,$2)=>$0.slice($1,$2)")).to_any())'))
        assert(captured(['slice']).includes('use nanvm_lib::vm::unstable::{string_any, string_key};'))
        // an import read off an object that is no literal of named properties
        assert(capturing(['.', ['{}', [['...', object([])]]], 'x']).startsWith(prefix))
        assert(capturing(['.', ['{}', [[':', ['+', 1, 2], 1]]], 'x']).startsWith(prefix))
        // a fold: the key found, its value resolved in turn
        assert(assertOk(generateRuntime(module([['static', object([['Object', object([['f', fn(0, [['.', object([['x', 7]]), 'x']], ['frame', 0])]])]])]]))).includes('Ok(f64_any(0x401c000000000000))'))
        // a literal written twice under one key is its last value
        assert(assertOk(generateRuntime(module([['static', object([['Object', object([['f', fn(0, [['.', object([['x', 1], ['x', 7]]), 'x']], ['frame', 0])]])]])]]))).includes('Ok(f64_any(0x401c000000000000))'))
        // a function written over, in a section or in a namespace, is one
        // no built-in reaches, and an operation at module level is dropped
        // unevaluated: both refused rather than a module meaning something
        // else
        const unreached = 'a function no built-in reaches; a property written twice keeps its last value: '
        assert(refusal(module([
            ['static', object([['Object', object([['f', fn(0, [], 1)]])]])],
            ['static', object([['Object', object([['g', fn(0, [], 7)]])]])],
        ])).startsWith(unreached))
        assert(refusal(module([['static', object([['Object', object([['g', fn(0, [], 1)], ['g', fn(0, [], 7)]])]])]])).startsWith(unreached))
        assert(refusal(module([['static', object([['Object', object([['g', ['+', 1, 2]], ['g', fn(0, [], 7)]])]])]])).startsWith(prefix))
        // an import's read written over is checked all the same: one that
        // would throw is refused, not dropped
        assert(refusal(module([['static', object([['Object', object([['g', ['.', ['undefined'], 'x']], ['g', fn(0, [], 7)]])]])]])).startsWith(prefix))
        // one function under two names is two functions in JavaScript,
        // `isNaN` and `Number.isNaN`; a static and a member print one Rust
        // name where the member's name spells the static's identifier, or
        // the static's with `Code` after it, the static's code being
        // `_code` after its identifier
        const shared = fn(0, [], 1)
        assertEq(refusal(module([['static', object([['Number', object([['isNaN', shared]])], ['Global', object([['isNaN', shared]])]])]])), 'a function two built-ins name; JavaScript keeps them apart: Global.isNaN')
        assertEq(refusal(module([
            ['static', object([['Object', object([['is', fn(0, [], 1)]])]])],
            ['member', object([['objectIs', fn(0, [], 2)]])],
        ])), 'two items of one Rust name: object_is of objectIs')
        assertEq(refusal(module([
            ['static', object([['Object', object([['is', fn(0, [], 1)]])]])],
            ['member', object([['objectIsCode', fn(0, [], 2)]])],
        ])), 'two items of one Rust name: object_is_code of objectIsCode')
        // and so do two statics, one's key the other's with `Code` after it
        assertEq(refusal(module([['static', object([['Object', object([['is', fn(0, [], 1)], ['isCode', fn(0, [], 2)]])]])]])), 'two items of one Rust name: object_is_code of Object.isCode')
        // a helper reached through a helper is an item, once
        const chain = assertOk(generateRuntime(module([['static', object([['Object', object([['f', fn(0, [fn(0, [fn(0, [], 1)], ['frame', 0])], ['frame', 0])]])]])]])))
        assert(chain.includes('fn f0<A') && chain.includes('fn f1<A') && !chain.includes('fn f2<A'))
        assertEq(refusal(module([['static', 1]])), 'a section of the runtime that is no object: 1')
        assertEq(refusal(module([['member', 1]])), 'a section of the runtime that is no object: 1')
        assertEq(refusal(module([['static', object([['String', 1]])]])), 'a namespace of the runtime that is no object: String')
        assertEq(refusal(module([['static', object([['Object', object([['x', 1]])]])]])), 'a built-in that is no function: Object.x')
        // a body under a native path would be NaNVM's alone, the
        // represented executors answering the path natively first
        assertEq(refusal(module([['static', object([['Object', object([['entries', fn(1, [], 1)]])]])]])), 'a body for a static every executor binds natively: Object.entries')
        // the native listed as itself is no built-in of the module's: the
        // table names it once, from `natives`, and the value holds it
        const listed = assertOk(generateRuntime(module([['static', object([['Object', object([['entries', ['Object.entries']]])]])]])))
        assertEq(listed.split('("Object.entries", object_entries)').length, 2)
        assert(listed.includes('let c0: Any<A> = Function::from(object_entries::<A>()).to_any();'))
        // any other static read names what the runtime defines
        assertEq(refusal(module([['static', object([['Object', object([['is', ['Number.isNaN']]])]])]])), 'a static function read in the runtime; the core may not use what it defines: Number.isNaN')
        assertEq(refusal(module([['static', object([['Object', object([['f', fn(0, [['Object.is']], ['frame', 0])]])]])]])), 'a static function read in the runtime; the core may not use what it defines: Object.is')
        assertEq(refusal(module([['member', object([['x', ['.', object([['x', 1]]), 'x']]])]])), 'a built-in that is no function: x')
        assert(refusal(['{}', []]).startsWith('no `runtime` export of objects: '))
        assertEq(refusal(['{}', [[':', 'runtime', object([])], [':', 'x', 1], [':', 'y', ['.', ['undefined'], 'z']]]]), 'the runtime module exports `runtime` alone; the lifting would drop an export: x,y')
        assert(refusal(['{}', [[':', 'runtime', 1]]]).startsWith('no `runtime` export of objects: '))
        assert(refusal(['[]', []]).startsWith('no `runtime` export of objects: '))
    },
    /**
     * A static's body is refused where it makes a function at call time,
     * since a static is bound on `IVm` alone; a member's makes the function
     * of the arguments, a closure over its receiver, and is bound on
     * `IStaticFunction` for it. An invalid body — a fixed read past its
     * function's length — is the ordinary backend's refusal, which prints
     * the value.
     */
    bodies: () => {
        assertEq(refusal(module([['static', object([['Object', object([['f', fn(0, [], fn(0, [], 1))]])]])]])), 'no static Rust for a function a body makes at call time: Object.f')
        const closure = assertOk(generateRuntime(module([['member', object([['g', fn(1, [], fn(0, [['arg', 0]], ['frame', 0]))]])]])))
        assert(closure.includes('fn g<A: IStaticFunction>(self_: Any<A>) -> Result<Any<A>, Any<A>> {\n    Ok(A::static_function(|self_, _args| { Ok(A::frame(self_)[0].clone()) }, 0, [self_.clone()].to_array(), Some("()=>$0")).to_any())\n}'))
        assert(refusal(module([['static', object([['Object', object([['f', fn(0, [], ['arg', 0])]])]])]])).startsWith('invalid fixed parameter index or scope'))
        // a member is a function of its receiver alone: a body reading its
        // arguments as a list, the rest or a second fixed argument is refused
        for (const body of /** @type {readonly Exp[]} */ ([['args'], ['rest'], ['arg', 1], ['[]', [['arg', 0], ['arg', 1]]]])) {
            assertEq(refusal(module([['member', object([['m', fn(1, [], body)]])]])), 'a member body reading past its receiver; a member is a function of its receiver alone: m')
        }
    },
    /**
     * A member is the code a call step calls, with no descriptor to read:
     * a static reading one as a value is refused, and so is a member
     * reading itself.
     */
    members: () => {
        const member = fn(1, [], 1)
        const read = 'a member read as a value; a member is the code a call step calls: m'
        assertEq(refusal(module([
            ['static', object([['Object', object([['f', fn(0, [member], ['frame', 0])]])]])],
            ['member', object([['m', member]])],
        ])), read)
        assertEq(refusal(module([['member', object([['m', fn(1, [], ['self'])]])]])), read)
    },
}
