/**
 * The proof of the parser's reading of `Object.is`, the one static function
 * the language admits ([spec: built-in static
 * functions](../../../spec/README.md#built-in-static-functions)): a value,
 * the AST's `['Object.is']`, in every spelling JavaScript reads it in, and
 * the namespace `Object` refused everywhere else. It reads the parser as
 * `./proof.f.mjs` does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { expectModule, expectRefused } from './proof.f.mjs'

/** The module whose default export is `value`, as the proofs pin it. @type {(value: string) => string} */
const exported = value => `[[],[["object",[[":","default",${value}]]]]]`

export const proof = {
    // The read in each spelling of its key, guarded or not — `Object` is a
    // reserved global, never nullish — is the one node, a value wherever a
    // value stands, and a call of it the ordinary call.
    read: () => {
        for (const source of ['Object.is', 'Object["is"]', 'Object?.is', 'Object?.["is"]', '(Object.is)']) {
            expectModule(`export default ${source};`, exported('["Object.is"]'))
        }
        expectModule('export default Object.is(0, -0);', exported('["()",["Object.is"],[0,["-",0]]]'))
        expectModule('export default [Object.is, Object.is.length];', exported('["array",[["Object.is"],[".",["Object.is"],"length"]]]'))
        expectModule('export default x => Object.is(x, x);', exported('["=>",1,[["()",["Object.is"],[["arg",0],["arg",0]]]]]'))
        // an argument is resolved as any is, after the callee
        expectRefused('export default Object.is(missing, 1);', 'const not found', 26)
    },
    // A chain over the read goes on as it would where nothing before the
    // steps short-circuits: a plain step is the plain node, and a guarded
    // call keeps the steps after it as its own chain.
    chain: () => {
        expectModule('export default Object?.is(1, 2);', exported('["()",["Object.is"],[1,2]]'))
        expectModule('export default (Object?.is)(1, 2);', exported('["()",["Object.is"],[1,2]]'))
        expectModule('export default Object?.is.length;', exported('[".",["Object.is"],"length"]'))
        expectModule('export default Object?.is(1)(2);', exported('["()",["()",["Object.is"],[1]],[2]]'))
        expectModule('export default Object.is?.(1, 2);', exported('["?.()",["Object.is"],[1,2]]'))
        expectModule('export default Object?.["is"]?.(1, 2).x;', exported('["?.()",["Object.is"],[1,2],["|.","x"]]'))
        // a step's key is judged as any access's is
        expectRefused('export default Object.is.call(1);', 'prohibited member function', 26)
        expectRefused('export default Object?.is.call(1);', 'prohibited member function', 27)
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
