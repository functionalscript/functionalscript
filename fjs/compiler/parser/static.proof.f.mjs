/**
 * The proof of the parser's reading of the static functions the language
 * admits, `Object.is`, `Object.entries`, `Object.keys`, `Object.fromEntries` and the four
 * `Number` predicates
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
import { assert, assertEq } from '../../asserts/module.f.js'
import { isReservedGlobal } from '../../js/keywords/module.f.js'
import { staticIds, staticPath } from '../../edag/module.f.js'

/** The module whose default export is `value`, as the proofs pin it. @type {(value: string) => string} */
const exported = value => `["{}",[[":","default",${value}]]]`

export const proof = {
    // The read in either spelling of its key is the one node, a value
    // wherever a value stands, and a call of it the ordinary call.
    read: () => {
        for (const source of ['Object.is', 'Object["is"]', '(Object.is)']) {
            expectModule(`export default ${source};`, "[\"{}\",[[\":\",\"default\",[\"Object.is\"]]]]")
        }
        expectModule('export default Object.is(0, -0);', "[\"{}\",[[\":\",\"default\",[\"()\",[\"Object.is\"],[0,-0]]]]]")
        expectModule('export default [Object.is, Object.is.length];', "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"Object.is\"],[\".\",[\"Object.is\"],\"length\"]]]]]]")
        expectModule('export default x => Object.is(x, x);', "[\"{}\",[[\":\",\"default\",[\"=>\",1,[],[\"()\",[\"Object.is\"],[[\"arg\",0],[\"arg\",0]]]]]]]")
        // an argument is resolved as any is, after the callee
        expectRefused('export default Object.is(missing, 1);', 'const not found', 26)
    },
    // A chain over the read goes on as over any value: a plain step is the
    // plain node, and a guard on the function, a value, is the guarded
    // call, which keeps the steps after it as its own chain.
    chain: () => {
        expectModule('export default Object.is(1)(2);', "[\"{}\",[[\":\",\"default\",[\"()\",[\"()\",[\"Object.is\"],[1]],[2]]]]]")
        expectModule('export default Object.is?.(1, 2);', "[\"{}\",[[\":\",\"default\",[\"?.()\",[\"Object.is\"],[1,2]]]]]")
        expectModule('export default Object["is"]?.(1, 2).x;', "[\"{}\",[[\":\",\"default\",[\"?.()\",[\"Object.is\"],[1,2],[\"|.\",\"x\"]]]]]")
        expectModule('export default Object.is(1)?.x;', "[\"{}\",[[\":\",\"default\",[\"?.\",[\"()\",[\"Object.is\"],[1]],\"x\"]]]]")
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
            "[\"{}\",[[\":\",\"default\",[\"()\",[\"Object.is\"],[0,-0]]]]]")
        expectModule('const { is: f, "is": g, is: { length } } = Object; export default [f, g, length];',
            "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"Object.is\"],[\"Object.is\"],[\".\",[\"Object.is\"],\"length\"]]]]]]")
        expectModule('export default x => { const { is } = Object; return is(x, x); };',
            "[\"{}\",[[\":\",\"default\",[\"=>\",1,[],[\"()\",[\"Object.is\"],[[\"arg\",0],[\"arg\",0]]]]]]]")
        expectModule('export default () => { let r = 0; while (r < 1) { const { is } = Object; r = is(r, 0) ? 1 : 2; } return r; };',
            "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"()\",[\"=>\",1,[],[\"?:\",[\"<\",[\"arg\",0],1],[\"()\",[\"self\"],[[\"?:\",[\"()\",[\"Object.is\"],[[\"arg\",0],0]],1,2]]],[\"arg\",0]]],[0]]]]]]")
        // an array pattern under a key reads the function as any value
        expectModule('const { is: [a] } = Object; export default a;',
            "[\"{}\",[[\":\",\"default\",[\".\",[\"[]\",[[\"...\",[\"Object.is\"]]]],0]]]]")
        // the empty pattern reads nothing: the namespace is never nullish
        expectModule('const {} = Object; export default 1;', "[\"{}\",[[\":\",\"default\",1]]]")
        // the pattern's own rules hold over the namespace too
        expectRefused('const { is, is } = Object; export default is;', 'duplicate id', 13)
        expectRefused('const { is, ...r } = Object; export default r;', 'rest element not supported', 13)
        expectRefused('const { [k]: a } = Object; export default a;', 'computed key in a binding pattern not supported', 10)
        expectRefused('const { values } = Object; export default 1;', 'prohibited property name', 9)
    },
    // The four `Number` predicates are read as `Object.is` is, in either
    // key spelling and through destructuring, beside the conversion `Number(x)`,
    // which the namespace leaves as it was; a member it does not admit, a
    // value property other than MAX_SAFE_INTEGER included, is refused at the word, and so is a
    // predicate under the other namespace.
    number: () => {
        for (const name of ['isInteger', 'isSafeInteger', 'isNaN', 'isFinite']) {
            for (const source of [`Number.${name}`, `Number["${name}"]`]) {
                expectModule(`export default ${source};`, exported(`["Number.${name}"]`))
            }
        }
        expectModule('export default [Number.isInteger(1), Number.isNaN?.(NaN), Number(1)];',
            "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"()\",[\"Number.isInteger\"],[1]],[\"?.()\",[\"Number.isNaN\"],[NaN]],[\"Number\",1]]]]]]")
        expectModule('const { isInteger, isFinite: f } = Number; export default [isInteger, f];',
            "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"Number.isInteger\"],[\"Number.isFinite\"]]]]]]")
        for (const source of [
            'export default Number.MAX_VALUE;',
            'export default Number.parseFloat("1");',
            'export default Number.is;',
            'export default Number?.(1);',
        ]) { expectRefused(source, 'reserved word', 16) }
        expectRefused('export default Object.isInteger;', 'reserved word', 16)
        expectRefused('const { foo } = Number; export default 1;', 'reserved word', 17)
    },
    maxSafeInteger: () => {
        // An independent numeric spelling pins the host's value on every engine.
        /** @type {number} */
        const expected = 0x1f_ffff_ffff_ffff
        assertEq(Number.MAX_SAFE_INTEGER, expected)
        for (const source of ['Number.MAX_SAFE_INTEGER', 'Number["MAX_SAFE_INTEGER"]', '(Number.MAX_SAFE_INTEGER)']) {
            expectModule(`export default ${source};`, exported(String(expected)))
        }
        expectModule('const { MAX_SAFE_INTEGER: max } = Number; export default max;', exported(String(expected)))
        expectModule('export default () => { const { MAX_SAFE_INTEGER } = Number; return MAX_SAFE_INTEGER; };',
            exported(`["=>",0,[],${expected}]`))
        expectModule('export default Number.MAX_SAFE_INTEGER - 1;', exported(`["-",${expected},1]`))
        // A call remains a call of a number; lowering does not invent a function.
        expectModule('export default Number.MAX_SAFE_INTEGER?.();', exported(`["?.()",${expected},[]]`))
        for (const source of ['Number?.MAX_SAFE_INTEGER', 'Number?.["MAX_SAFE_INTEGER"]', 'Object.MAX_SAFE_INTEGER', 'Number[Number(0)]']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
        expectRefused('const key = "MAX_SAFE_INTEGER"; export default Number[key];', 'reserved word', 48)
    },
    // `Object.entries` is read as `Object.is` is, in either key spelling
    // and through destructuring, though `entries` is a prototype name: the
    // namespace's own list admits it before the key rule, which still
    // refuses the name over any value and under the other namespace.
    entries: () => {
        for (const source of ['Object.entries', 'Object["entries"]']) {
            expectModule(`export default ${source};`, "[\"{}\",[[\":\",\"default\",[\"Object.entries\"]]]]")
        }
        expectModule('export default Object.entries({ a: 1 });', "[\"{}\",[[\":\",\"default\",[\"()\",[\"Object.entries\"],[[\"{}\",[[\":\",\"a\",1]]]]]]]]")
        expectModule('const { entries, "entries": e } = Object; export default [entries, e];',
            "[\"{}\",[[\":\",\"default\",[\"[]\",[[\"Object.entries\"],[\"Object.entries\"]]]]]]")
        expectRefused('export default [].entries;', 'prohibited property name', 19)
        expectRefused('const { entries } = []; export default entries;', 'prohibited property name', 9)
        expectRefused('const { entries } = Number; export default 1;', 'prohibited property name', 9)
    },
    // Keys use the same static-value and namespace-destructuring path as
    // entries, including its prototype-name exception over Object alone.
    keys: () => {
        for (const source of ['Object.keys', 'Object["keys"]', '(Object.keys)']) {
            expectModule(`export default ${source};`, exported('["Object.keys"]'))
        }
        expectModule('export default Object.keys({ a: 1 });',
            exported('["()",["Object.keys"],[["{}",[[":","a",1]]]]]'))
        expectModule('const { keys, "keys": k, keys: { length } } = Object; export default [keys, k, length];',
            exported('["[]",[["Object.keys"],["Object.keys"],[".",["Object.keys"],"length"]]]'))
        expectModule('export default Object.keys?.({});',
            exported('["?.()",["Object.keys"],[["{}",[]]]]'))
        expectRefused('export default Object?.keys({});', 'reserved word', 16)
        expectRefused('export default [].keys;', 'prohibited property name', 19)
        expectRefused('const { keys } = Number; export default 1;', 'prohibited property name', 9)
    },
    // `Object.fromEntries` is read as `Object.entries` is, in either key
    // spelling and through destructuring; it is no prototype name, so over
    // another namespace it is refused at the word.
    fromEntries: () => {
        for (const source of ['Object.fromEntries', 'Object["fromEntries"]']) {
            expectModule(`export default ${source};`, exported('["Object.fromEntries"]'))
        }
        expectModule('const { fromEntries } = Object; export default fromEntries([["a", 1]]);',
            exported('["()",["Object.fromEntries"],[["[]",[["[]",["a",1]]]]]]'))
        expectRefused('const { fromEntries } = Number; export default 1;', 'reserved word', 25)
    },
    // Math is a namespace: its admitted members are values, while every
    // other member stays closed. The namespace cannot be bound or read.
    mathLog2: () => {
        for (const source of ['Math.log2', 'Math["log2"]', '(Math.log2)']) {
            expectModule(`export default ${source};`, exported('["Math.log2"]'))
        }
        expectModule('export default Math.log2(8);', exported('["()",["Math.log2"],[8]]'))
        expectModule('export default Math.log2?.(8);', exported('["?.()",["Math.log2"],[8]]'))
        expectModule('const { log2: f } = Math; export default [f, f.length];',
            exported('["[]",[["Math.log2"],[".",["Math.log2"],"length"]]]'))
        for (const source of [
            'export default Math;',
            'export default Math.log;',
            'export default Math.cbrt(8);',
            'export default Math?.log2;',
            'export default Math?.["log2"];',
            'export default Math[Number(0)];',
            'const Math = 1; export default Math;',
            'export default (Math) => 1;',
            'import Math from "m"; export default 1;',
            'const { log } = Math; export default 1;',
        ]) { expectRefused(source, 'reserved word', source.indexOf('Math') + 1) }
        expectModule('export default { Math: 1 }.Math;',
            exported('[".",["{}",[[":","Math",1]]],"Math"]'))
    },
    mathTrunc: () => {
        for (const source of ['Math.trunc', 'Math["trunc"]', '(Math.trunc)']) {
            expectModule(`export default ${source};`, exported('["Math.trunc"]'))
        }
        expectModule('export default Math.trunc(3.75);', exported('["()",["Math.trunc"],[3.75]]'))
        expectModule('export default Math["trunc"]?.(3.75);', exported('["?.()",["Math.trunc"],[3.75]]'))
        expectModule('const { trunc: f, "trunc": g, trunc: { length } } = Math; export default [f, g, length];',
            exported('["[]",[["Math.trunc"],["Math.trunc"],[".",["Math.trunc"],"length"]]]'))
        expectModule('export default x => Math.trunc(x);',
            exported('["=>",1,[],["()",["Math.trunc"],[["arg",0]]]]'))
        for (const source of ['Math?.trunc', 'Math?.["trunc"](1)', 'Number.trunc', 'Object.trunc']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
    },
    mathFloor: () => {
        for (const source of ['Math.floor', 'Math["floor"]', '(Math.floor)']) {
            expectModule(`export default ${source};`, exported('["Math.floor"]'))
        }
        expectModule('export default Math.floor(3.75);', exported('["()",["Math.floor"],[3.75]]'))
        expectModule('export default Math["floor"]?.(0.75);', exported('["?.()",["Math.floor"],[0.75]]'))
        expectModule('const { floor: f, "floor": g, floor: { length } } = Math; export default [f, g, length];',
            exported('["[]",[["Math.floor"],["Math.floor"],[".",["Math.floor"],"length"]]]'))
        expectModule('export default x => Math.floor(x);',
            exported('["=>",1,[],["()",["Math.floor"],[["arg",0]]]]'))
        for (const source of ['Math?.floor', 'Math?.["floor"](1)', 'Number.floor', 'Object.floor']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
    },
    mathAbs: () => {
        for (const source of ['Math.abs', 'Math["abs"]', '(Math.abs)']) {
            expectModule(`export default ${source};`, exported('["Math.abs"]'))
        }
        expectModule('export default Math.abs(3.75);', exported('["()",["Math.abs"],[3.75]]'))
        expectModule('export default Math["abs"]?.(0.75);', exported('["?.()",["Math.abs"],[0.75]]'))
        expectModule('const { abs: f, "abs": g, abs: { length } } = Math; export default [f, g, length];',
            exported('["[]",[["Math.abs"],["Math.abs"],[".",["Math.abs"],"length"]]]'))
        expectModule('export default x => Math.abs(x);',
            exported('["=>",1,[],["()",["Math.abs"],[["arg",0]]]]'))
        for (const source of ['Math?.abs', 'Math?.["abs"](1)', 'Number.abs', 'Object.abs']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
    },
    mathSqrtCeilImul: () => {
        for (const [name, args] of [['sqrt', '4'], ['ceil', '0.75'], ['imul', '7,3']]) {
            for (const source of [`Math.${name}`, `Math["${name}"]`, `(Math.${name})`]) {
                expectModule(`export default ${source};`, exported(`["Math.${name}"]`))
            }
            expectModule(`export default Math.${name}(${args});`, exported(`["()",["Math.${name}"],[${args}]]`))
            expectModule(`export default Math["${name}"]?.(${args});`, exported(`["?.()",["Math.${name}"],[${args}]]`))
            expectModule(`const { ${name}: f, "${name}": g, ${name}: { length } } = Math; export default [f, g, length];`,
                exported(`["[]",[["Math.${name}"],["Math.${name}"],[".",["Math.${name}"],"length"]]]`))
            for (const source of [`Math?.${name}`, `Math?.["${name}"](1)`, `Number.${name}`, `Object.${name}`]) {
                expectRefused(`export default ${source};`, 'reserved word', 16)
            }
        }
        expectModule('export default x => Math.sqrt(x);',
            exported('["=>",1,[],["()",["Math.sqrt"],[["arg",0]]]]'))
        expectModule('export default x => Math.ceil(x);',
            exported('["=>",1,[],["()",["Math.ceil"],[["arg",0]]]]'))
        expectModule('export default (x, y) => Math.imul(x, y);',
            exported('["=>",2,[],["()",["Math.imul"],[["arg",0],["arg",1]]]]'))
    },
    mathMax: () => {
        for (const source of ['Math.max', 'Math["max"]', '(Math.max)']) {
            expectModule(`export default ${source};`, exported('["Math.max"]'))
        }
        expectModule('export default Math.max(1, 2, 3);', exported('["()",["Math.max"],[1,2,3]]'))
        expectModule('export default Math["max"]?.();', exported('["?.()",["Math.max"],[]]'))
        expectModule('const { max: f, "max": g, max: { length } } = Math; export default [f, g, length];',
            exported('["[]",[["Math.max"],["Math.max"],[".",["Math.max"],"length"]]]'))
        expectModule('export default (x, y, z) => Math.max(x, y, z);',
            exported('["=>",3,[],["()",["Math.max"],[["arg",0],["arg",1],["arg",2]]]]'))
        for (const source of ['Math?.max', 'Math?.["max"](1)', 'Number.max', 'Object.max', 'Math.cbrt(8)']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
    },
    mathMin: () => {
        for (const source of ['Math.min', 'Math["min"]', '(Math.min)']) {
            expectModule(`export default ${source};`, exported('["Math.min"]'))
        }
        expectModule('export default Math.min(1, 2, 3);', exported('["()",["Math.min"],[1,2,3]]'))
        expectModule('export default Math["min"]?.();', exported('["?.()",["Math.min"],[]]'))
        expectModule('const { min: f, "min": g, min: { length } } = Math; export default [f, g, length];',
            exported('["[]",[["Math.min"],["Math.min"],[".",["Math.min"],"length"]]]'))
        expectModule('export default (x, y, z) => Math.min(x, y, z);',
            exported('["=>",3,[],["()",["Math.min"],[["arg",0],["arg",1],["arg",2]]]]'))
        for (const source of ['Math?.min', 'Math?.["min"](1)', 'Number.min', 'Object.min', 'Math.cbrt(8)']) {
            expectRefused(`export default ${source};`, 'reserved word', 16)
        }
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
            'export default Object.values;',
            'export default Object.values({});',
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
        expectModule('export default { Object: 1 }.Object;', "[\"{}\",[[\":\",\"default\",[\".\",[\"{}\",[[\":\",\"Object\",1]]],\"Object\"]]]]")
    },
}
