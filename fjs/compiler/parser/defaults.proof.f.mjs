/**
 * The proof of the parser's default parameters, `= value` after a fixed
 * parameter ([default parameters](../../../spec/todo/3125-default-parameters.md)),
 * split off `./proof.f.mjs` as `./destructuring.proof.f.mjs` was, that file
 * being at what the website's build accepts in one file. It reads the
 * parser as that proof does, through the helpers it exports; what each
 * output writes, and what a call answers, is the language proof's,
 * `../language.proof.f.mjs`.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { expectModule, expectRefused } from './proof.f.mjs'

export const proof = {
    // The parameters from the first default on are read from the rest
    // array, `$r[k]`, and the function's `length` stops before them, as
    // JavaScript's does; a default makes its parameter
    // `$r[k] === undefined ? value : $r[k]`, the value in the arm alone,
    // and one without is the read itself. Each is an entry of the body,
    // after the ones the parameters before it made, and the rest parameter
    // after them is the slice of the array past them.
    defaults: {
        lowered: () => {
            expectModule('export default (a = 5) => a;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],5,[\".\",[\"rest\"],0]]]]]]")
            expectModule('export default (a, b = a, ...r) => [a, b, r];',
                "[\"{}\",[[\":\",\"default\",[\"=>\",1,[],[\"[]\",[[\"arg\",0],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],[\"arg\",0],[\".\",[\"rest\"],0]],[\".\",[\"rest\"],\"slice\",[\"|()\",[1]]]]]]]]]")
            expectModule('export default (a = 1, b) => [a, b];',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"[]\",[[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],1,[\".\",[\"rest\"],0]],[\".\",[\"rest\"],1]]]]]]]")
            // a block body's statements count from after the parameters' entries
            expectModule('export default (a = 1) => { const b = a; return b; };',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],1,[\".\",[\"rest\"],0]]]]]]")
            // a pattern with a default reads the conditional as its source,
            // and a pattern before the first default its argument, as before
            expectModule('export default ({ a }, [b] = [], { c } = {}) => [a, b, c];',
                "[\"{}\",[[\":\",\"default\",[\"=>\",1,[],[\"[]\",[[\".\",[\"arg\",0],\"a\"],[\".\",[\"[]\",[[\"...\",[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],[\"[]\",[]],[\".\",[\"rest\"],0]]]]],0],[\".\",[\"?:\",[\"===\",[\".\",[\"rest\"],1],[\"undefined\"]],[\"{}\",[]],[\".\",[\"rest\"],1]],\"c\"]]]]]]]")
            // a trailing comma after a default is the list without it
            expectModule('export default (a = 1,) => a;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],1,[\".\",[\"rest\"],0]]]]]]")
            // a list with no default is unchanged
            expectModule('export default (a, ...r) => [a, r];', "[\"{}\",[[\":\",\"default\",[\"=>\",1,[],[\"[]\",[[\"arg\",0],[\"rest\"]]]]]]]")
        },
        // A default is resolved in the function's own scope: a name of the
        // scopes around it is a capture, the function's own name its
        // `self`, and a function written as a default a function of its
        // own, with its own defaults — never the parameter's `self`.
        scope: () => {
            expectModule('const x = 1; export default (a = x) => a;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],1,[\".\",[\"rest\"],0]]]]]]")
            expectModule('const f = (a = f) => a; export default f;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],[\"self\"],[\".\",[\"rest\"],0]]]]]]")
            expectModule('const f = (g = () => f) => g; export default f;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],[\"=>\",0,[[\"self\"]],[\"frame\",0]],[\".\",[\"rest\"],0]]]]]]")
            expectModule('export default (a = (b = 1) => b) => a;',
                "[\"{}\",[[\":\",\"default\",[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],[\"=>\",0,[],[\"?:\",[\"===\",[\".\",[\"rest\"],0],[\"undefined\"]],1,[\".\",[\"rest\"],0]]],[\".\",[\"rest\"],0]]]]]]")
        },
        // A default never reads a later parameter, itself, or the body: in
        // JavaScript each of those reads names the parameter before it is
        // initialized, or the body's binding, where this compiler would
        // read a name of the scopes around it. With none, the name is not
        // found; with one, the parameter or the body `const` that would
        // have been read is refused at its name, `capture shadowed` — a
        // read inside a function the default writes included.
        refused: () => {
            expectRefused('export default (a = b, b) => a;', 'const not found', 21)
            expectRefused('const b = 1; export default (a = b, b) => a;', 'capture shadowed', 37)
            expectRefused('export default (a = a) => a;', 'const not found', 21)
            expectRefused('const a = 1; export default (a = a) => a;', 'capture shadowed', 30)
            expectRefused('const b = 1; export default (a = () => b, b) => a();', 'capture shadowed', 43)
            expectRefused('const r = 1; export default (a = r, ...r) => a;', 'capture shadowed', 40)
            expectRefused('const x = 1; export default (a = x) => { const x = 2; return [a, x]; };', 'capture shadowed', 48)
        },
        // Every name of the list is checked with the list, the ones after a
        // default included, and the limit of 16 counts every fixed
        // parameter written, defaulted or not.
        list: () => {
            expectRefused('export default (a = 1, a) => a;', 'duplicate id', 24)
            expectRefused('export default (a, b = 1, ...a) => a;', 'duplicate id', 30)
            expectRefused('export default (a = 1, { a }) => a;', 'duplicate id', 26)
            expectRefused('export default (a = 1, b) => { const b = 2; return b; };', 'duplicate id', 38)
            expectRefused('export default (a = 1, if) => a;', 'reserved word', 24)
            expectRefused('export default (a = if) => a;', 'reserved word', 21)
            expectRefused('export default (a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16=1)=>1;', 'more than 16 fixed parameters', 71)
            expectRefused('export default (a=0,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16)=>1;', 'more than 16 fixed parameters', 72)
            // the head of a list is a target before it takes a default, a
            // pattern's value is refused where it stands, `(a = 1)` is no
            // group, and the line rule before `=>` holds after a default
            expectRefused('export default ((a) = 1) => a;', 'malformed parameter list', 16)
            expectRefused('export default ([(a)] = []) => a;', 'invalid destructuring target', 18)
            expectRefused('export default (a = 1);', 'unexpected token', 23)
            expectRefused('export default (a = 1)\n=> a;', 'unexpected token', 1)
        },
    },
}
