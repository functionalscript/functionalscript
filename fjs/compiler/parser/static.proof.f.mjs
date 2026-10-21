/**
 * The proof of the parser's reading of the static functions the language
 * admits, `Object.is`, `Object.entries` and the four `Number` predicates
 * ([spec: built-in static functions](../../../spec/built-ins/static-functions/README.md)):
 * each a value, the AST's `['Object.is']`, in either key spelling of the
 * unguarded read, and each namespace refused everywhere else, a guard on
 * it included. It reads the
 * parser as `./proof.f.mjs` does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { expectModule, expectRefused } from './proof.f.mjs'
import { assert } from '../../asserts/module.f.js'
import { isReservedGlobal } from '../../js/keywords/module.f.js'
import { staticIds, staticPath } from '../../edag/module.f.mjs'

/** The module whose default export is `value`, as the proofs pin it. @type {(value: string) => string} */
const exported = value => `[[],[["object",[[":","default",${value}]]]]]`

export const proof = {
    // The read in either spelling of its key is the one node, a value
    // wherever a value stands, and a call of it the ordinary call.
    read: () => {
        for (const source of ['Object.is', 'Object["is"]', '(Object.is)']) {
            expectModule(`export default ${source};`, exported('["Object.is"]'))
        }
        expectModule('export default Object.is(0, -0);', exported('["()",["Object.is"],[0,["-",0]]]'))
        expectModule('export default [Object.is, Object.is.length];', exported('["array",[["Object.is"],[".",["Object.is"],"length"]]]'))
        expectModule('export default x => Object.is(x, x);', exported('["=>",1,[["()",["Object.is"],[["arg",0],["arg",0]]]]]'))
        // an argument is resolved as any is, after the callee
        expectRefused('export default Object.is(missing, 1);', 'const not found', 26)
    },
    // A chain over the read goes on as over any value: a plain step is the
    // plain node, and a guard on the function, a value, is the guarded
    // call, which keeps the steps after it as its own chain.
    chain: () => {
        expectModule('export default Object.is(1)(2);', exported('["()",["()",["Object.is"],[1]],[2]]'))
        expectModule('export default Object.is?.(1, 2);', exported('["?.()",["Object.is"],[1,2]]'))
        expectModule('export default Object["is"]?.(1, 2).x;', exported('["?.()",["Object.is"],[1,2],["|.","x"]]'))
        expectModule('export default Object.is(1)?.x;', exported('["?.",["()",["Object.is"],[1]],"x"]'))
        // a step's key is judged as any access's is
        expectRefused('export default Object.is.call(1);', 'prohibited member function', 26)
    },
    // A guard asks whether a value is nullish, and a namespace is no
    // value, so a guarded read of one asks nothing and is refused at the
    // word — in either key spelling, of each namespace, whatever the chain
    // goes on with.
    guarded: () => {
        for (const source of [
            'Object?.is',
            'Object?.["is"]',
            'Object?.is(1, 2)',
            'Object?.is.length',
            'Object?.is(1)(2)',
            'Object?.["is"]?.(1, 2).x',
            'Object?.is.call(1)',
            'Object?.entries',
            'Number?.isInteger',
            'Number?.["isFinite"](1)',
        ]) { expectRefused(`export default ${source};`, 'reserved word', 16) }
        expectRefused('export default (Object?.is)(1, 2);', 'reserved word', 17)
    },
    // Destructuring is sugar: an object pattern over the namespace reads
    // each key as the access does, so `const { is } = Object` makes the one
    // entry `const is = Object.is` makes — in the module, a body and a
    // loop's block — and a nested pattern reads through it as through any
    // value.
    destructuring: () => {
        expectModule('const { is } = Object; export default is(0, -0);',
            '[[],[["Object.is"],["object",[[":","default",["()",["cref",0],[0,["-",0]]]]]]]]')
        expectModule('const { is: f, "is": g, is: { length } } = Object; export default [f, g, length];',
            '[[],[["Object.is"],["Object.is"],["Object.is"],[".",["cref",2],"length"],["object",[[":","default",["array",[["cref",0],["cref",1],["cref",3]]]]]]]]')
        expectModule('export default x => { const { is } = Object; return is(x, x); };',
            exported('["=>",1,[["Object.is"],["()",["cref",0],[["arg",0],["arg",0]]]]]'))
        expectModule('export default () => { let r = 0; while (r < 1) { const { is } = Object; r = is(r, 0) ? 1 : 2; } return r; };',
            exported('["=>",0,[["()",["=>",1,[["?:",["<",["arg",0],1],["()",["=>",0,[["Object.is"],["?:",["()",["cref",0],[["fref",0],0]],1,2],["()",["fref",1],[["cref",1]]]],[["arg",0],["self"]]],[]],["arg",0]]]],[0]],["cref",0]]]'))
        // an array pattern under a key reads the function as any value
        expectModule('const { is: [a] } = Object; export default a;',
            '[[],[["array",[["...",["Object.is"]]]],[".",["cref",0],0],["object",[[":","default",["cref",1]]]]]]')
        // the empty pattern reads nothing: the namespace is never nullish
        expectModule('const {} = Object; export default 1;', exported('1'))
        // the pattern's own rules hold over the namespace too
        expectRefused('const { is, is } = Object; export default is;', 'duplicate id', 13)
        expectRefused('const { is, ...r } = Object; export default r;', 'rest element not supported', 13)
        expectRefused('const { [k]: a } = Object; export default a;', 'computed key in a binding pattern not supported', 10)
        expectRefused('const { keys } = Object; export default 1;', 'prohibited property name', 9)
    },
    // The four `Number` predicates are read as `Object.is` is, in either
    // key spelling and through destructuring, beside the conversion `Number(x)`,
    // which the namespace leaves as it was; a member it does not admit, a
    // value property included, is refused at the word, and so is a
    // predicate under the other namespace.
    number: () => {
        for (const name of ['isInteger', 'isSafeInteger', 'isNaN', 'isFinite']) {
            for (const source of [`Number.${name}`, `Number["${name}"]`]) {
                expectModule(`export default ${source};`, exported(`["Number.${name}"]`))
            }
        }
        expectModule('export default [Number.isInteger(1), Number.isNaN?.(NaN), Number(1)];',
            exported('["array",[["()",["Number.isInteger"],[1]],["?.()",["Number.isNaN"],[NaN]],["Number",1]]]'))
        expectModule('const { isInteger, isFinite: f } = Number; export default [isInteger, f];',
            '[[],[["Number.isInteger"],["Number.isFinite"],["object",[[":","default",["array",[["cref",0],["cref",1]]]]]]]]')
        for (const source of [
            'export default Number.MAX_SAFE_INTEGER;',
            'export default Number.parseFloat("1");',
            'export default Number.is;',
            'export default Number?.(1);',
        ]) { expectRefused(source, 'reserved word', 16) }
        expectRefused('export default Object.isInteger;', 'reserved word', 16)
        expectRefused('const { foo } = Number; export default 1;', 'reserved word', 17)
    },
    // `Object.entries` is read as `Object.is` is, in either key spelling
    // and through destructuring, though `entries` is a prototype name: the
    // namespace's own list admits it before the key rule, which still
    // refuses the name over any value and under the other namespace.
    entries: () => {
        for (const source of ['Object.entries', 'Object["entries"]']) {
            expectModule(`export default ${source};`, exported('["Object.entries"]'))
        }
        expectModule('export default Object.entries({ a: 1 });', exported('["()",["Object.entries"],[["object",[[":","a",1]]]]]'))
        expectModule('const { entries, "entries": e } = Object; export default [entries, e];',
            '[[],[["Object.entries"],["Object.entries"],["object",[[":","default",["array",[["cref",0],["cref",1]]]]]]]]')
        expectRefused('export default [].entries;', 'prohibited property name', 19)
        expectRefused('const { entries } = []; export default entries;', 'prohibited property name', 9)
        expectRefused('const { entries } = Number; export default 1;', 'prohibited property name', 9)
    },
    // Every namespace is a reserved global, so no scope binds the word a
    // static read is decided by.
    namespaces: () => {
        for (const id of staticIds) { assert(isReservedGlobal(staticPath(id)[0]), id) }
    },
    // Every other read of the word is refused at it: a member the
    // namespace does not admit, in a pattern too, a computed or numeric
    // key, the word alone, any other pattern over it, and a binding of it.
    refused: () => {
        for (const source of [
            'export default Object.keys;',
            'export default Object.keys({});',
            'export default Object[Number(0)];',
            'export default Object[0];',
            'export default Object;',
            'export default Object?.(1);',
            'export default typeof Object;',
        ]) { expectRefused(source, 'reserved word', 16 + source.slice(15).indexOf('Object')) }
        expectRefused('const { foo } = Object; export default 1;', 'reserved word', 17)
        expectRefused('const [a] = Object; export default a;', 'reserved word', 13)
        expectRefused('const o = Object; export default o.is;', 'reserved word', 11)
        expectRefused('const Object = 1; export default 1;', 'reserved word', 7)
        expectRefused('export default (Object) => 1;', 'reserved word', 17)
        // a key and a property of a value are names, as JavaScript has them
        expectModule('export default { Object: 1 }.Object;', exported('[".",["object",[[":","Object",1]]],"Object"]'))
    },
}
