/**
 * The language's constructs, each compiled through every output: what
 * [`./proof.f.mjs`](./proof.f.mjs) proves of the command — its arguments,
 * its outputs by extension, its errors and its laws — this proves of the
 * source, one section per construct, from the guard to the spread, each
 * observed as `.f.js`, EDAG, Rust and the value outputs write it. The
 * helpers are the command proof's own, imported from it, so a construct is
 * compiled exactly as the command compiles one.
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { _errorLocation, compile } from './module.f.mjs'
import { transpile } from './transpiler/module.f.mjs'
import { parse } from './source/module.f.mjs'
import { read } from '../edag/value/property/module.f.mjs'
import { virtual, emptyState, nodeProgramOptions } from '../effects/node/virtual/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { isObject } from '../types/object/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { outputs } from './demo.f.mjs'
import { compileSource, defaultValue, fjsRoundTrip, importing, jsonOf, jsonRefused, moduleRefused, protoValue, readOutput, runtime, stderrOf, withCfg, withSelected } from './proof.f.mjs'

const { getPrototypeOf, is, prototype: objectPrototype } = Object

export const proof = {
    // A guard is written back as what it lowers to: the conditional, an arm
    // that holds a `const` or a `throw` in a block opened at the operand, an
    // arm with nothing to hold bare — `if` itself is never written — and the
    // Rust output binds an arm's `const` in the arm's own block. The value
    // outputs refuse a function as ever.
    guards: () => {
        assertEq(compileSource('export default (a) => { if (a) { return 1; } return 2; };')('output.js'), 'export default ($0)=>$0?1:2;')
        assertEq(compileSource('export default (a) => { if (a) { const x = [1]; return [x, x]; } return 0; };')('output.js'), 'export default ($0)=>$0?(()=>{const $1=[1];return [$1,$1];})():0;')
        assertEq(compileSource('export default (m) => { const a = [1]; if (m) { return a; } return 0; };')('output.js'), 'export default ($0)=>{const $1=[1];return $0?$1:0;};')
        assertEq(compileSource('export default (a) => { if (a) { throw 1; } const y = [2]; return y; };')('output.js'), 'export default ($0)=>$0?(()=>{throw 1;})():[2];')
        assertEq(compileSource('export default (a) => { if (a) { throw 1; } const z = [2]; return 1; };')('output.js'), 'export default ($0)=>$0?(()=>{throw 1;})():(()=>{const $1=[2];return 1;})();')
        assertEq(compileSource('export default (v, msg) => { if (v) { return undefined; } throw msg ?? "assertion failed"; };')('output.js'), 'export default ($0,$1)=>$0?undefined:(()=>{throw $1??"assertion failed";})();')
        assertEq(compileSource('export default (a) => { if (a) { throw 1; } const z = [2]; return 1; };')('output.edag.data.js'), 'export default ["{}",[[":","default",["=>",1,[],["?:",["arg",0],["throw",1],[",",[["[]",[2]],1]]]]]]];')
        assert(compileSource('export default (a) => { if (a) { const x = [1]; return [x, x]; } return 0; };')('output.rs').includes([
            '        let c0 = || {',
            '            let c1: Any<A> = [f64_any(0x3ff0000000000000)].to_array().to_any();',
            '            Ok([c1.clone(), c1.clone()].to_array().to_any())',
            '        };',
            '        Any::conditional(args.clone().into_iter().next().unwrap_or_else(|| Nullish::Undefined.to_any()), c0, || Ok(f64_any(0x0000000000000000)))',
        ].join('\n')))
        assertEq(jsonRefused('export default (a) => { if (a) { return 1; } return 2; };'), 'output.json - error: callable materialization requires a target compile/load boundary')
    },
    // JSON denotes a tree, so a node the export reaches twice is written
    // where each reference reaches it, as `JSON.stringify` writes it — a
    // container `const`, an alias of one, or an import, along any route and
    // however deep. The DataJS output keeps the node; `outputRoute` pins
    // that side.
    sharing: {
        constTwice: () => { assertEq(compileSource('const a = [1]; export default [a, a];')('output.json'), '[[1],[1]]') },
        // an access on a literal selects the item the key names, and the
        // rest of the literal is not part of the value
        literal: () => {
            assertEq(compileSource('const x = []; export default [[x, x], 0][0];')('output.json'), '[[],[]]')
            assertEq(compileSource('const x = []; export default { a: [x, x], b: 1 }.a;')('output.json'), '[[],[]]')
            assertEq(compileSource('const x = []; export default [[x, x], 0][1];')('output.json'), '0')
            assertEq(compileSource('const x = []; export default [[x, x], 0][0][1];')('output.json'), '[]')
            assertEq(compileSource('const x = []; export default [x, [x]][1];')('output.json'), '[[]]')
            assertEq(compileSource('const x = []; export default { a: [x, x], a: 1 }.a;')('output.json'), '1')
            assertEq(compileSource('const x = []; export default [[x, x]].length;')('output.json'), '1')
            // an item selected from a literal may be an access itself, on a
            // literal or on a reference, and is read on to what it names
            assertEq(compileSource('const x = []; const z = [x, x]; export default [{ a: z }.a][0];')('output.json'), '[[],[]]')
            assertEq(compileSource('const x = []; export default [[{ a: [x, x] }.a]][0][0];')('output.json'), '[[],[]]')
            assertEq(compileSource('const x = []; const z = { a: [x, x], b: 2 }; export default [z.b][0];')('output.json'), '2')
            assertEq(compileSource('const x = []; const a = { a: [x, x], b: x }.a; export default [a[0], x];')('output.json'), '[[],[]]')
            assertEq(compileSource('const a = [[1, 2]][0]; export default [a[0], a[1]];')('output.json'), '[1,2]')
            assertEq(compileSource('const x = []; const a = [{ b: [x, 1] }.b][0]; export default [a[1], x];')('output.json'), '[1,[]]')
        },
        leafTwice: () => { assertEq(compileSource('const a = 1; export default [a, a];')('output.json'), '[1,1]') },
        unreachable: () => { assertEq(compileSource('const a = []; const b = [a, a]; export default [a];')('output.json'), '[[]]') },
        alias: () => { assertEq(compileSource('const a = []; const b = a; export default [a, b];')('output.json'), '[[],[]]') },
        nested: () => { assertEq(compileSource('const a = []; export default [a, [a]];')('output.json'), '[[],[[]]]') },
        member: () => { assertEq(compileSource('const a = {}; export default {"x": a, "y": {"z": a}};')('output.json'), '{"x":{},"y":{"z":{}}}') },
        literals: () => { assertEq(compileSource('export default [[1], [1], {"a": {}}];')('output.json'), '[[1],[1],{"a":{}}]') },
        // a member a later duplicate shadows is not in the value: `{x: a,
        // x: 0, y: a}` holds `a` once, and `{a: s, a: s}` once
        shadowed: () => {
            assertEq(compileSource('const a = {}; export default {"x": a, "x": 0, "y": a};')('output.json'), '{"x":0,"y":{}}')
            assertEq(compileSource('const s = [1]; export default {"a": s, "a": s};')('output.json'), '{"a":[1]}')
            assertEq(compileSource('const a = {}; export default {"x": 0, "x": a, "y": a};')('output.json'), '{"x":{},"y":{}}')
        },
        // one module reached along two import edges is one node, written
        // where each edge reaches it, however the edges are spelled: two
        // imports of one module, two import statements, two spellings of
        // one path, or a diamond through a third module
        importTwice: () => {
            const m = { 'm.f.js': [utf8('export default [1];')] }
            assertEq(jsonOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m, m];')] }), '[[1],[1]]')
            assertEq(jsonOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; import m2 from "./m.f.js"; export default [m, m2];')] }), '[[1],[1]]')
            assertEq(jsonOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; import m2 from "./sub/../m.f.js"; export default [m, m2];')] }), '[[1],[1]]')
            const shared = { 'c.f.js': [utf8('const a = []; export default [a, a];')] }
            assertEq(jsonOf({ ...shared, 'a.f.js': [utf8('import c from "./c.f.js"; export default [c];')] }), '[[[],[]]]')
        },
        diamond: () => {
            const root = {
                'm.f.js': [utf8('export default [1];')],
                'b.f.js': [utf8('import m from "./m.f.js"; export default [m];')],
                'a.f.js': [utf8('import m from "./m.f.js"; import b from "./b.f.js"; export default [m, b];')],
            }
            assertEq(jsonOf(root), '[[1],[[1]]]')
            assertEq(jsonOf({ ...root, 'c.f.js': [utf8('import m from "./m.f.js"; export default {"m": m};')], 'a.f.js': [utf8('import b from "./b.f.js"; import c from "./c.f.js"; export default [b, c];')] }), '[[[1]],{"m":[1]}]')
        },
        json: () => { assertEq(jsonOf({ 'a.json': [utf8('[[1],[1]]')], 'a.f.js': [utf8('import j from "./a.json" with { type: "json" }; export default [j, j];')] }), '[[[1],[1]],[[1],[1]]]') },
        // a node doubled at every `const` is written once per reference:
        // sixteen leaves for four doublings, the tree the value is
        doubling: () => {
            const consts = Array.from({ length: 4 }, (_, i) => `const a${i + 1} = [a${i}, a${i}];`).join(' ')
            const expected = Array.from({ length: 4 }).reduce(s => `[${s},${s}]`, '[1]')
            assertEq(compileSource(`const a0 = [1]; ${consts} export default a4;`)('output.json'), expected)
        },
    },
    // A property access on the value path: an own property, never the
    // prototype chain — the property-accessor spec's rule, a prototype's
    // name being refused by the parser — `undefined` where there is none,
    // and the failure JavaScript throws for on a `null` or `undefined` base.
    access: {
        own: () => {
            assertEq(compileSource('const a = { b: [1, 2] }; export default [a.b, a["b"][1], a.b.length];')('output.data.js'), 'export default [[1,2],2,2];')
            // a literal takes accesses as a reference does
            assertEq(compileSource('export default [[1, 2].length, "ab"[1], { a: 3 }.a, true.x];')('output.data.js'), 'export default [2,"b",3,undefined];')
            // a numeric literal takes an access as any other value does, and
            // a sign before it negates what the access read, as JavaScript
            // reads it: `-1 .x` is `-(1 .x)`, which is `NaN`
            assertEq(compileSource('export default [1 .x, -1 .x, 0n.x, -1["x"]];')('output.data.js'), 'export default [undefined,NaN,undefined,NaN];')
            // a bigint's `n` ends the literal, so `1n.x` needs no space where
            // `1.x` is one number and a stray word — JavaScript's own
            // unevenness, which the tokenizer keeps rather than smooths. The
            // sign composes with it: `-1n.x` is `-(1n.x)`, so `NaN`
            assertEq(compileSource('export default [1n.x, -1n.x, -1n];')('output.data.js'), 'export default [undefined,NaN,-1n];')
            assertEq(moduleRefused('export default null.x;'), 'input.f.js - error: module initialization failed')
            assertEq(compileSource('const s = "ab"; export default [s[0], s["1"], s.length];')('output.json'), '["a","b",2]')
            assertEq(compileSource('const a = { b: 1 }; export default [a.c, a.b.x];')('output.data.js'), 'export default [undefined,undefined];')
            assertEq(moduleRefused('const a = { b: 1 }; export default a.toString;'), 'input.f.js:1:38 - error: prohibited property name')
            assertEq(compileSource('const n = 1; const b = true; const g = 2n; export default [n.x, b.x, g.x];')('output.data.js'), 'export default [undefined,undefined,undefined];')
        },
        failure: () => {
            assertEq(moduleRefused('const a = null; export default a.x;'), 'input.f.js - error: module initialization failed')
            assertEq(moduleRefused('const a = { b: 1 }; export default a.c.d;'), 'input.f.js - error: module initialization failed')
        },
        // a failure with no token and no file names the file being compiled
        // — the parser's contract failure, which no reader `compile` runs
        // produces, is the one such error left
        noFile: () => {
            assertEq(_errorLocation('input.f.js')({ message: 'missing end-of-input token', metadata: null }), 'input.f.js')
            assertEq(_errorLocation('input.f.js')({ message: 'file not found', metadata: null, path: 'm.f.js' }), 'm.f.js')
        },
        // a failure with no token names the file it is in: an imported
        // module's body, a missing import, a cycle met at an import
        failureInImport: () => {
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('const n = null; export default n.a;')] }), 'm.f.js - error: module initialization failed')
            assertEq(stderrOf(importing), 'm.f.js - error: file not found')
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('import i from "./input.f.js"; export default [i];')] }), 'input.f.js - error: circular dependency')
            assertEq(stderrOf({ ...importing, 'm.f.js': [utf8('export default @')] }), 'm.f.js:1:16-17 - error: unexpected token')
            // a malformed JSON module likewise, under both readers
            const json = { 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; export default [d];')], 'd.json': [utf8('{')] }
            const [edagState, edagCode] = virtual({ ...emptyState, root: json })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(edagCode), 1)
            assertEq(edagState.stderr.trim(), 'd.json - error: unexpected end')
            assertEq(stderrOf(json), 'd.json - error: unexpected end')
        },
        // a JSON module is imported `with { type: "json" }`, as JavaScript
        // has it; a `.json` file imported without the attribute, or a module
        // imported with it, is refused under both readers
        jsonImport: () => {
            const root = { 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; export default [d, 1];')], 'd.json': [utf8('{"a": [null]}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.json'])))
            assertEq(exitCode(code), 0)
            assertEq(readOutput(state.root, 'output.json'), '[{"a":[null]},1]')
            const [edagState, edagCode] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(edagCode), 0)
            assertEq(readOutput(edagState.root, 'output.edag.data.js'), 'export default ["{}",[[":","default",["[]",[["{}",[[":","a",["[]",[null]]]]],1]]]]];')
            const missing = { ...root, 'input.f.js': [utf8('import d from "./d.json"; export default [d, 1];')] }
            assertEq(stderrOf(missing), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const [missingState, missingCode] = virtual({ ...emptyState, root: missing })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(missingCode), 1)
            assertEq(missingState.stderr.trim(), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const incompatible = { 'input.f.js': [utf8('import m from "./m.f.js" with { type: "json" }; export default [m];')], 'm.f.js': [utf8('export default 1;')] }
            assertEq(stderrOf(incompatible), 'm.f.js - error: only a JSON module is imported with { type: "json" }')
            const [incompatibleState, incompatibleCode] = virtual({ ...emptyState, root: incompatible })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(incompatibleCode), 1)
            assertEq(incompatibleState.stderr.trim(), 'm.f.js - error: only a JSON module is imported with { type: "json" }')
            // a file met before is refused all the same when a later import
            // misspells it: the contract is the import's, not the file's
            const twice = { ...root, 'input.f.js': [utf8('import d from "./d.json" with { type: "json" }; import e from "./d.json"; export default [d, e];')] }
            assertEq(stderrOf(twice), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
            const [twiceState, twiceCode] = virtual({ ...emptyState, root: twice })(compile(nodeProgramOptions(['input.f.js', 'output.edag.data.js'])))
            assertEq(exitCode(twiceCode), 1)
            assertEq(twiceState.stderr.trim(), 'd.json - error: a JSON module needs the import attribute with { type: "json" }')
        },
        // an access reaches what it selects, and JSON writes the node
        // there, once per reference: `cfg.a` beside `cfg.b` is two nodes,
        // `cfg.a` twice or `cfg` beside `cfg.a` is one written twice
        sharing: () => {
            assertEq(compileSource(withCfg('export default { first: cfg.a, second: cfg.b };'))('output.json'), '{"first":[1],"second":[2]}')
            assertEq(compileSource(withCfg('export default [cfg.a, cfg.a];'))('output.json'), '[[1],[1]]')
            assertEq(compileSource(withCfg('export default [cfg.a, cfg.a];'))('output.data.js'), 'const $0=[1];export default [$0,$0];')
            assertEq(compileSource(withCfg('export default [cfg, cfg.a];'))('output.json'), '[{"a":[1],"b":[2],"c":3},[1]]')
            assertEq(compileSource(withCfg('export default [cfg.c, cfg.c, cfg.a[0], cfg.a.length];'))('output.json'), '[3,3,1,1]')
            assertEq(compileSource('const o = []; const cfg = { a: o, b: o }; export default [cfg.a, cfg.b];')('output.json'), '[[],[]]')
            assertEq(compileSource('const a = [[]]; export default [a[0], a["0"]];')('output.json'), '[[],[]]')
            // `"00"` is not an index's spelling, so it selects nothing, and
            // `undefined` is what JSON has no spelling for
            assertEq(jsonRefused('const x = []; const a = [x]; export default [a[0], a["00"]];'), 'output.json - error: no JSON spelling for undefined')
            // an entry reached only through an access is in the value only
            // where the access selects, and a route through a reference
            // follows it
            assertEq(compileSource(withSelected('export default a.selected;'))('output.json'), '1')
            assertEq(compileSource(withSelected('export default a.other[0];'))('output.json'), '[]')
            // a key that is not an index's canonical spelling names no element
            assertEq(compileSource(withSelected('export default [a.other["01"], a.other[1.5], a.other["-1"], a.other["1e0"]];'))('output.data.js'), 'export default [undefined,undefined,undefined,undefined];')
            assertEq(compileSource(withSelected('export default a.other;'))('output.json'), '[[],[]]')
            assertEq(compileSource(withSelected('export default [a.selected, a.other];'))('output.json'), '[1,[[],[]]]')
            assertEq(compileSource('const b = { y: [] }; const a = { x: b }; export default a.x.y;')('output.json'), '[]')
            assertEq(compileSource('const b = { y: [] }; const a = { x: b }; export default [a.x.y, b.y];')('output.json'), '[[],[]]')
            // an import resolved to the path `0` is a module, not `const` 0
            /** @type {typeof emptyState.root} */
            const zero = { 'a.f.js': [utf8('import m from "./0"; const c = []; export default [c, m];')], 0: [utf8('export default [];')] }
            assertEq(jsonOf(zero), '[[],[]]')
            // an access into an import selects as one into a `const` does
            /** @type {typeof emptyState.root} */
            const m = { 'm.f.js': [utf8('export default { x: [1], y: [2], z: 3 };')] }
            assertEq(jsonOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m.x, m.y, m.z, m.z];')] }), '[[1],[2],3,3]')
            assertEq(jsonOf({ ...m, 'a.f.js': [utf8('import m from "./m.f.js"; export default [m.x, m.x, m.z];')] }), '[[1],[1],3]')
            assertEq(jsonOf({ ...m, 'b.f.js': [utf8('import m from "./m.f.js"; export default { p: m.x };')], 'a.f.js': [utf8('import b from "./b.f.js"; import m from "./m.f.js"; export default [b, m.y];')] }), '[{"p":[1]},[2]]')
        },
    },
    // The three numbers JSON cannot spell, end to end: read as the values
    // they name, written back as the same words. `NaN` is checked by
    // `Object.is` directly, which is what `structurallySame` compares leaves
    // by too — so the corpus below carries it and `-0` as well.
    specialNumbers: {
        value: () => {
            const root = { 'input.f.js': [utf8('export default [NaN, Infinity, -Infinity];')] }
            const [, result] = runtime({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            const value = defaultValue(result[1])
            assert(value instanceof Array && value.length === 3, value)
            assert(is(value[0], NaN), value[0])
            assertEq(value[1], Infinity)
            assertEq(value[2], -Infinity)
        },
        moduleRoundTrip: () => {
            const source = 'export default [NaN,Infinity,-Infinity];'
            assertEq(compileSource(source)('output.data.js'), source)
        },
        // The `.json` output refuses them, each by name: `JSON.stringify`'s
        // `null` would read back as a different value, and the word would
        // not read back at all.
        jsonOutput: () => {
            assertEq(jsonRefused('export default NaN;'), 'output.json - error: no JSON spelling for NaN')
            assertEq(jsonRefused('export default Infinity;'), 'output.json - error: no JSON spelling for Infinity')
            assertEq(jsonRefused('export default -Infinity;'), 'output.json - error: no JSON spelling for -Infinity')
        },
    },
    // Separators affect spelling alone, and must stand between digits.
    numericSeparators: {
        values: () => {
            assertEq(compileSource('export default [1_000, 12.3_4, 1e1_0, 1_2.5_0e-1, 0.0_1, 0xF_f, 0B10_10];')('output.json'), '[1000,12.34,10000000000,1.25,0.01,255,10]')
            assertEq(compileSource('export default [1_000n, 0Xf_Fn, -0b10_10n, -0.0_0];')('output.data.js'), 'export default [1000n,255n,-10n,-0];')
            assertEq(compileSource('export default 9_007_199_254_740_993;')('output.json'), '9007199254740992')
            assertEq(compileSource('export default 36_893_488_147_419_103_233n;')('output.data.js'), 'export default 36893488147419103233n;')
            assertEq(compileSource('export default [7, 8][0b0_1];')('output.json'), '8')
        },
        refused: () => {
            for (const literal of ['1_', '1__0', '0_1', '0x_FF', '0b_1', '1_.0', '1._0', '1e_2', '1e+_2', '1_n', '0x1_n', '0b1_n']) {
                assert(moduleRefused(`export default ${literal};`).includes('error: unexpected token'))
            }
        },
    },
    // Binary literals preserve JavaScript's values, rounding and boundaries.
    binaryNumbers: {
        value: () => {
            assertEq(compileSource('export default [0b101010, 0B001, 0b0];')('output.json'), '[42,1,0]')
            assertEq(compileSource(`export default 0b1${'0'.repeat(52)}1;`)('output.json'), '9007199254740992')
            assertEq(compileSource('export default [0b10n, 0B01n, 0b0n];')('output.data.js'), 'export default [2n,1n,0n];')
            assertEq(compileSource(`export default 0b1${'0'.repeat(64)}1n;`)('output.data.js'), 'export default 36893488147419103233n;')
            assertEq(compileSource('export default [1, 2][0b1];')('output.json'), '2')
        },
        negation: () => {
            assertEq(compileSource('export default [-0b101, -0B10n, -0b0];')('output.data.js'), 'export default [-5,-2n,-0];')
        },
        access: () => {
            assertEq(fjsRoundTrip('export default 0b10.length;'), 'const $0=2;export default $0.length;')
        },
        refused: () => {
            assertEq(moduleRefused('export default 0b;'), 'input.f.js:1:18 - error: unexpected token')
            assertEq(moduleRefused('export default 0B2;'), 'input.f.js:1:18 - error: unexpected token')
            assertEq(moduleRefused('export default 0b102;'), 'input.f.js:1:20 - error: unexpected token')
            assertEq(moduleRefused('export default 0b1e2;'), 'input.f.js:1:19 - error: unexpected token')
            assertEq(moduleRefused('export default 0b1.5;'), 'input.f.js:1:20 - error: unexpected token')
            assertEq(moduleRefused('export default 0b1n2;'), 'input.f.js:1:20 - error: unexpected token')
        },
    },
    // Hexadecimal literals, a number's and a `bigint`'s: read as the values
    // JavaScript gives them and written as those values, so the spelling is
    // the source's and not the graph's. After `0x`, `e` is a digit, and a
    // `.` is the next token, never a fraction.
    hexNumbers: {
        value: () => {
            assertEq(compileSource('export default [0xFF, 0XfF, 0xabcdef, 0x10e1, 0x0];')('output.json'), '[255,255,11259375,4321,0]')
            // the nearest double, as a decimal literal is
            assertEq(compileSource('export default 0x20000000000001;')('output.json'), '9007199254740992')
            assertEq(compileSource('export default [0x10n, 0XFFn, 0x0n];')('output.data.js'), 'export default [16n,255n,0n];')
            // a key, read as the number it names
            assertEq(compileSource('export default [1, 2][0x1];')('output.json'), '2')
        },
        // the unary minus over one folds into the leaf, as over a decimal one
        negation: () => {
            assertEq(compileSource('export default [-0xFF, -0x8000000000000000n];')('output.data.js'), 'export default [-255,-9223372036854775808n];')
        },
        access: () => {
            assertEq(fjsRoundTrip('export default 0x10.length;'), 'const $0=16;export default $0.length;')
        },
        // what JavaScript refuses: no digit, a word or a digit against the
        // literal, and a fraction or a suffix where the literal has ended
        refused: () => {
            assertEq(moduleRefused('export default 0x;'), 'input.f.js:1:18 - error: unexpected token')
            assertEq(moduleRefused('export default 0xg;'), 'input.f.js:1:18 - error: unexpected token')
            assertEq(moduleRefused('export default 0x1g;'), 'input.f.js:1:19 - error: unexpected token')
            assertEq(moduleRefused('export default 0x1.5;'), 'input.f.js:1:20 - error: unexpected token')
            assertEq(moduleRefused('export default 0x1n2;'), 'input.f.js:1:20 - error: unexpected token')
        },
    },
    // What JSON cannot spell, refused wherever it sits — at the root, as an
    // element, as a member's value — and nothing written. A bigint is
    // refused even though its digits are JSON: the standard reader would
    // take `1` back as the number `1`, a change of type the extended codec's
    // output exists to signal and a `.json` file cannot. `-0` is a JSON
    // number and stays one.
    jsonRefusals: {
        undefinedRoot: () => { assertEq(jsonRefused('export default undefined;'), 'output.json - error: no JSON spelling for undefined') },
        undefinedElement: () => { assertEq(jsonRefused('export default [1, undefined];'), 'output.json - error: no JSON spelling for undefined') },
        undefinedMember: () => { assertEq(jsonRefused('export default {"a": undefined};'), 'output.json - error: no JSON spelling for undefined') },
        bigintRoot: () => { assertEq(jsonRefused('export default 42n;'), 'output.json - error: no JSON spelling for 42n') },
        bigintElement: () => { assertEq(jsonRefused('export default [42n];'), 'output.json - error: no JSON spelling for 42n') },
        bigintMember: () => { assertEq(jsonRefused('export default {"a": 42n};'), 'output.json - error: no JSON spelling for 42n') },
        nanElement: () => { assertEq(jsonRefused('export default [NaN];'), 'output.json - error: no JSON spelling for NaN') },
        nanMember: () => { assertEq(jsonRefused('export default {"a": NaN};'), 'output.json - error: no JSON spelling for NaN') },
        // a shared node is no refusal: JSON denotes a tree, so the node is
        // written where each reference reaches it, as `JSON.stringify`
        // writes it, and two equal containers read back the same
        sharedNode: () => {
            assertEq(compileSource('const a = [1]; export default [a, a];')('output.json'), '[[1],[1]]')
            assertEq(compileSource('const a = {}; export default {"x": a, "y": a};')('output.json'), '{"x":{},"y":{}}')
            assertEq(compileSource('export default [[1], [1]];')('output.json'), '[[1],[1]]')
        },
        // the whole tree is written once the first refusal is found: nothing
        // after it is reported, and nothing before it is written
        firstRefusal: () => {
            assertEq(jsonRefused('export default [1, undefined, 2n];'), 'output.json - error: no JSON spelling for undefined')
            // and found over the graph, not over the tree it unfolds to: two
            // to the fortieth references reach the leaf here, and twenty-two
            // valid doublings before a refused sibling are not unfolded first
            const consts = Array.from({ length: 40 }, (_, i) => `const a${i + 1} = [a${i}, a${i}];`).join(' ')
            assertEq(jsonRefused(`const a0 = [undefined]; ${consts} export default a40;`), 'output.json - error: no JSON spelling for undefined')
            assertEq(jsonRefused(`const a0 = { x: [1, 2n] }; ${consts} export default { a: a40 };`), 'output.json - error: no JSON spelling for 2n')
            const valid = Array.from({ length: 22 }, (_, i) => `const a${i + 1} = [a${i}, a${i}];`).join(' ')
            assertEq(jsonRefused(`const a0 = [1]; ${valid} export default [a22, undefined];`), 'output.json - error: no JSON spelling for undefined')
            // the first in the reader's order, a leaf before a container
            // before the container's own
            assertEq(jsonRefused('export default [undefined, [2n]];'), 'output.json - error: no JSON spelling for undefined')
            assertEq(jsonRefused('export default [[2n], undefined];'), 'output.json - error: no JSON spelling for 2n')
        },
        // the DataJS output takes every one of them
        moduleOutput: () => {
            assertEq(compileSource('export default [undefined, 42n, NaN];')('output.data.js'), 'export default [undefined,42n,NaN];')
            assertEq(compileSource('const a = [1]; export default [a, a];')('output.data.js'), 'const $0=[1];export default [$0,$0];')
        },
    },
    // Negation uses represented primitive conversion, including containers.
    // A noncallable own toString can still make that conversion fail.
    negation: {
        computes: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => assertEq(compileSource(source)('output.data.js'), expected)
            expect('export default [-"2", -true, -false, -null, -1n];', 'export default [-2,-1,-0,-0,-1n];')
            // `-undefined` is `NaN`, as every conversion that finds no number is
            expect('export default [-undefined, -"abc", -""];', 'export default [NaN,NaN,-0];')
            // the operand is a value and not a spelling: a reference reads
            // as the literal it names
            expect('const n = 2; export default -n;', 'export default -2;')
            // and a negation of a negation is one value, not two nodes
            expect('export default - -1;', 'export default 1;')
        },
        containers: () => {
            assertEq(compileSource('export default -[];')('output.data.js'), 'export default -0;')
            assertEq(compileSource('export default -[1];')('output.json'), '-1')
            assertEq(compileSource('export default -{};')('output.data.js'), 'export default NaN;')
            assertEq(moduleRefused('export default -{toString:1};'), 'input.f.js - error: module initialization failed')
            assertEq(compileSource('const a = []; export default -a;')('output.data.js'), 'export default -0;')
            assertEq(compileSource('export default -[1];')('output.edag.data.js'), 'export default ["{}",[[":","default",["-",["[]",[1]]]]]];')
        },
    },
    // Negative zero end to end: the tokenizer pins the `-0` lexeme,
    // `parseFloat` keeps the sign, and the serializer writes it back as
    // `-0` — where `String(-0)` is `"0"`, which is why only `Object.is` can
    // state this and why the round trip is pinned rather than assumed.
    negativeZero: {
        value: () => {
            const root = { 'input.f.js': [utf8('export default -0;')] }
            const [, result] = runtime({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            assert(is(defaultValue(result[1]), -0), result[1])
        },
        moduleRoundTrip: () => {
            assertEq(compileSource('export default -0;')('output.data.js'), 'export default -0;')
            assertEq(compileSource('export default [0, -0];')('output.data.js'), 'export default [0,-0];')
        },
        // `-0` is a JSON number too, so the tree output keeps it
        jsonOutput: () => {
            assertEq(compileSource('export default -0;')('output.json'), '-0')
        },
    },
    // The `__proto__` key end to end: one value, two output languages, and one
    // spelling of the key in each (#2480).
    protoKey: {
        // The DataJS output uses the computed form, which is also the only
        // input spelling — so the emitter's output is an input that means the
        // same value, and compiling it again is the identity.
        moduleRoundTrip: () => {
            const source = 'export default {["__proto__"]:{"a":42}};'
            const output = compileSource(source)('output.data.js')
            assertEq(output, source)
            assertEq(compileSource(output)('output.data.js'), source)
        },
        // The JSON output keeps the plain key: the computed form is a
        // JavaScript spelling that no JSON parser accepts.
        jsonOutput: () => {
            assertEq(
                compileSource('export default {["__proto__"]:{"a":42}};')('output.json'),
                '{"__proto__":{"a":42}}')
        },
        // `fjs compile proto.json a.js` — the two languages meeting. The input
        // is a JSON document, where `"__proto__"` is an ordinary data key, and
        // the output is a JavaScript module, where only the computed form
        // denotes one. Each hop uses its own language's spelling of the key.
        jsonInput: () => {
            const root = { 'proto.json': [utf8('{"__proto__":5}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['proto.json', 'a.data.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'a.data.js'), 'export default {["__proto__"]:5};')
        },
        // …and back, byte for byte: a JSON document survives the loop
        // `proto.json → a.js → out.json` with no `["__proto__"]:` artifact,
        // which no JSON parser would accept.
        jsonInputRoundTrip: () => {
            const document = '{"__proto__":{"a":42}}'
            const root = { 'proto.json': [utf8(document)] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['proto.json', 'a.data.js'])))
            assertEq(exitCode(code), 0, state.stderr)
            const module = readOutput(state.root, 'a.data.js')
            assertEq(module, 'export default {["__proto__"]:{"a":42}};')
            assertEq(compileSource(module)('out.json'), document)
        },
        // A JSON module imported `with { type: "json" }` is read by the JSON
        // reader too, so its `"__proto__"` key is the data key `JSON.parse`
        // makes of it, through the import and out again.
        jsonImportRoundTrip: () => {
            const root = {
                'main.f.js': [utf8('import a from "./a.json" with { type: "json" };\nexport default [a];')],
                'a.json': [utf8('{"__proto__":{"a":42}}')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['main.f.js', 'out.json'])))
            assertEq(exitCode(code), 0, state.stderr)
            assertEq(readOutput(state.root, 'out.json'), '[{"__proto__":{"a":42}}]')
        },
        // A `.json` input is read as JSON, and an identifier key is no JSON
        // document's key — so this one fails in the JSON reader, which names
        // the code unit it failed at rather than a line and column, and is
        // named by its file instead.
        jsonInputIdKeyRejected: () => {
            const root = { 'proto.json': [utf8('{__proto__:5}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['proto.json', 'a.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.stderr.trim(), 'proto.json - error: unexpected symbol at 1')
            assertEq(state.root['a.data.js'], undefined)
        },
        // The `.json` reader is JSON, not the module reader with a JSON flag:
        // a bigint is not JSON, whatever a module makes of it.
        jsonInputRejectsDjsExtensions: () => {
            const root = { 'a.json': [utf8('{"a":1n}')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['a.json', 'a.data.js'])))
            assertEq(exitCode(code), 1)
            assertEq(state.root['a.data.js'], undefined)
        },
        // The statement behind the textual assertions: the property is an
        // ordinary own property and the prototype is untouched. A textual test
        // alone would also pass for a spelling that merely looks right.
        value: () => {
            const root = { 'input.f.js': [utf8('export default {["__proto__"]:{"a":42}};')] }
            const [, result] = runtime({ ...emptyState, root })(transpile('input.f.js'))
            assert(result[0] === 'ok', result[1])
            const value = defaultValue(result[1])
            assert(isObject(value), value)
            assertStructurallySame(value, protoValue)
            assertEq(getPrototypeOf(value), objectPrototype)
        },
        // The two spellings JavaScript reads as a prototype assignment are
        // compilation errors, not silently accepted properties.
        idKeyRejected: () => {
            const root = { 'input.f.js': [utf8('export default {__proto__:{"a":42}};')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.data.js'], undefined)
        },
        stringKeyRejected: () => {
            const root = { 'input.f.js': [utf8('export default {"__proto__":{"a":42}};')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
            assertEq(exitCode(code), 1)
            assert(state.stderr.includes('__proto__ requires the computed key form'), state.stderr)
            assertEq(state.root['output.data.js'], undefined)
        },
    },
    // A string may be written between single quotes, with JSON's escapes
    // and `\'` (`spec/todo/2460-js-string-literals.md`). The quote is a
    // spelling: every output is what the double-quoted module compiles to,
    // each writing the value in its own canonical form.
    singleQuotes: {
        valuesAndKeys: () => {
            const single = "export default { 'k': ['a\"b', 'it\\'s', '\\u0041\\n'] };"
            const double = 'export default { "k": ["a\\"b", "it\'s", "\\u0041\\n"] };'
            for (const output of ['output.data.js', 'output.js', 'output.json', 'output.rs']) {
                assertEq(compileSource(single)(output), compileSource(double)(output), output)
            }
        },
        importPath: () => {
            /** @type {(source: string) => string} */
            const compiled = source => {
                const root = { 'input.f.js': [utf8(source)], 'm.f.js': [utf8('export default [1];')] }
                const [state, code] = virtual({ ...emptyState, root })(compile(nodeProgramOptions(['input.f.js', 'output.data.js'])))
                assertEq(exitCode(code), 0, state.stderr)
                return readOutput(state.root, 'output.data.js')
            }
            assertEq(compiled("import m from './m.f.js'; export default [m];"), compiled('import m from "./m.f.js"; export default [m];'))
        },
        // what JSON refuses stays refused: `\'` is not JSON's, so a
        // double-quoted string may not hold it, and JavaScript's other
        // escapes are not this language's in either quote
        refused: () => {
            assertEq(moduleRefused('export default "\\\'";'), 'input.f.js:1:16-21 - error: unexpected token')
            assertEq(moduleRefused("export default '\\x41';"), 'input.f.js:1:16-23 - error: unexpected token')
        },
    },
    // Spread in an array literal and in a call's arguments
    // (`spec/README.md`, Spread): its operand evaluated in place and
    // iterated, an array by its elements and a string by its code points,
    // every other value refused; each output spells it as it spells
    // anything, the value outputs by the value and the module and EDAG
    // outputs by the spread itself.
    spread: {
        values: () => {
            assertEq(
                compileSource('const a = [1, 2]; export default [[...a, 0], [0, ...a, 0], [0, ...a], [...a, ...a], [...a,], [...[]]];')('output.data.js'),
                'export default [[1,2,0],[0,1,2,0],[0,1,2],[1,2,1,2],[1,2],[]];')
            // a code point is one item, two code units where it needs them
            assertEq(compileSource('export default [[...""], [..."ab"], [..."😀"], [..."a😀b"]];')('output.json'), '[[],["a","b"],["😀"],["a","😀","b"]]')
            // an access reads the array the spread made
            assertEq(compileSource('const a = [1, 2]; export default [...a, 3][2];')('output.data.js'), 'export default 3;')
            assertEq(compileSource('const a = [{}]; export default [0, ...a][1];')('output.data.js'), 'export default {};')
        },
        // `GetIterator` fails for every value but an array and a string.
        notIterable: () => {
            for (const operand of ['null', 'undefined', 'true', '1', '1n', '{}', '{ length: 1 }']) {
                assertEq(moduleRefused(`export default [...${operand}];`), 'input.f.js - error: module initialization failed')
            }
            assertEq(moduleRefused('export default [...(() => 1)];'), 'input.f.js - error: module initialization failed')
        },
        // `...` before nothing, or before another `...`, is no item
        malformed: () => {
            assertEq(moduleRefused('export default [...];'), 'input.f.js:1:20 - error: unexpected token')
            assertEq(moduleRefused('export default [..., 1];'), 'input.f.js:1:20 - error: unexpected token')
            assertEq(moduleRefused('export default [1, ...];'), 'input.f.js:1:23 - error: unexpected token')
            assertEq(moduleRefused('export default [... ...[]];'), 'input.f.js:1:21 - error: unexpected token')
            assertEq(moduleRefused('const f = (...a) => a; export default f(...);'), 'input.f.js:1:44 - error: unexpected token')
        },
        outputs: () => {
            assertEq(compileSource('const a = [1]; export default [...a];')('output.edag.data.js'), 'export default ["{}",[[":","default",["[]",[["...",["[]",[1]]]]]]]];')
            assertEq(compileSource('const f = (...r) => r; export default (...r) => f(...r, 1);')('output.js'), 'const $0=(...$1)=>$1;export default (...$2)=>$0(...$2,1);')
            assert(compileSource('export default [...null, 1];')('output.rs').includes('spread_array([spread_item(Nullish::Null.to_any()), value_item(f64_any(0x3ff0000000000000))])?'))
        },
        // a call whose function reads its rest array through a spread stays
        // a call, as one reading it any other way does
        notInlined: () => {
            assertEq(compileSource('export default ((...a) => [...a])();')('output.js'), 'const $0=(...$1)=>[...$1];export default $0();')
            assertEq(compileSource('const f = (...a) => a; export default ((...a) => f(...a))();')('output.js'), 'const $0=(...$1)=>$1;const $2=(...$3)=>$0(...$3);export default $2();')
        },
        // A spread puts its operand's elements in the array, not the
        // operand: a container element is one node reached through every
        // spread of it, written by JSON where each reaches it, and an array
        // of leaves spread twice is leaves twice.
        sharing: () => {
            assertEq(compileSource('const a = [1]; export default [...a, ...a];')('output.json'), '[1,1]')
            assertEq(compileSource('const a = [1]; export default {x: [...a, 2], y: [...a, 3]};')('output.json'), '{"x":[1,2],"y":[1,3]}')
            assertEq(compileSource('const a = [1]; export default [[...a], a];')('output.json'), '[[1],[1]]')
            assertEq(compileSource('export default [..."ab", ..."ab"];')('output.json'), '["a","b","a","b"]')
            // a string's elements are strings, no node, through a `const` too
            assertEq(compileSource('const s = "ab"; export default [...s, ...s];')('output.json'), '["a","b","a","b"]')
            assertEq(compileSource('const a = [[1]]; export default [...a[0], a];')('output.json'), '[1,[[1]]]')
            assertEq(compileSource('const a = [{}]; export default {x: [...a, 2], y: [...a, 3]};')('output.json'), '{"x":[{},2],"y":[{},3]}')
            assertEq(compileSource('const a = [{}]; export default [[...a], a];')('output.json'), '[[{}],[{}]]')
            assertEq(compileSource('const x = {}; const a = [x]; export default [...a, x];')('output.json'), '[{},{}]')
            assertEq(compileSource('const b = [{}]; const a = [...b, 1]; export default [...a, b];')('output.json'), '[{},1,[{}]]')
            assertEq(compileSource('const b = [[1]]; const a = [...b]; export default [...a, ...a];')('output.json'), '[[1],[1]]')
            // an array literal spread holds its items as they stand
            assertEq(compileSource('const x = {}; export default [x, ...[x]];')('output.json'), '[{},{}]')
            assertEq(compileSource('const x = {}; export default [...[x], ...[x]];')('output.json'), '[{},{}]')
            assertEq(compileSource('const x = {}; export default [...[[x]][0], x];')('output.json'), '[{},{}]')
            assertEq(compileSource('const x = {}; export default [...[x]];')('output.json'), '[{}]')
            // an access through an array holding a spread selects the item
            assertEq(compileSource('const a = [1, 2]; export default [[...a, 3][2], [0, ...a][1], [...a].length];')('output.json'), '[3,1,2]')
            assertEq(compileSource('const a = [{}]; export default [[0, ...a][1], a];')('output.json'), '[{},[{}]]')
            assertEq(compileSource('const s = [...[{}]]; export default [s[0], s[0]];')('output.json'), '[{},{}]')
            assertEq(compileSource('const x = {}; const a = [...[], 1, [x, x]]; export default [a[0], a[1]];')('output.json'), '[1,[{},{}]]')
        },
    },
    // Spread in an object literal (`spec/README.md`, Object Spread): its
    // operand's own properties copied in its place, as `CopyDataProperties`
    // copies them, from an object, an array or a string, and nothing from
    // any other value, so it never throws; each output spells it as it
    // spells anything.
    objectSpread: {
        values: () => {
            assertEq(
                compileSource('const o = { a: 1, b: 2 }; export default [{ ...o, c: 3 }, { a: 0, ...o }, { ...o, a: 0 }, { ...o, ...o }, { ...o, }, { ...{} }];')('output.json'),
                '[{"a":1,"b":2,"c":3},{"a":1,"b":2},{"a":0,"b":2},{"a":1,"b":2},{"a":1,"b":2},{}]')
            // a copied key behaves as a written one: the later value wins
            // and the key keeps its first position
            assertEq(compileSource('export default { b: 1, a: 1, ...{ b: 2 } };')('output.json'), '{"b":2,"a":1}')
            // an array's elements by index, a string's code units — two per
            // code point, where an array's spread yields one item
            assertEq(compileSource('export default [{ ...["p", "q"], z: 0 }, { ..."a😀" }];')('output.json'), '[{"0":"p","1":"q","z":0},{"0":"a","1":"\\ud83d","2":"\\ude00"}]')
            // nothing from any other value, and no failure
            assertEq(compileSource('export default [{ ...null }, { ...undefined }, { ...1 }, { ...true }, { ...1n }];')('output.json'), '[{},{},{},{},{}]')
            // a copied `__proto__` key is an own property, as the computed
            // spelling makes one
            assertEq(compileSource('export default { ...{ ["__proto__"]: 1 } };')('output.data.js'), 'export default {["__proto__"]:1};')
            // a property named `...` is a property
            assertEq(compileSource('const o = { "...": 1 }; export default { ...o, ["..."]: 2 };')('output.json'), '{"...":2}')
            // an access reads the object the spread made
            assertEq(compileSource('const o = { a: 1 }; export default { ...o }.a;')('output.json'), '1')
        },
        // A function contributes no enumerable properties to an object.
        functions: () => {
            assertEq(compileSource('export default { ...(() => 1) };')('output.data.js'), 'export default {};')
            assertEq(compileSource('export default { ...(() => 1) };')('output.json'), '{}')
            assertEq(compileSource('export default { ...(() => 1) };')('output.js'), 'export default {...()=>1};')
            assertEq(compileSource('export default { ...(() => 1) };')('output.edag.data.js'), 'export default ["{}",[[":","default",["{}",[["...",["=>",0,[],1]]]]]]];')
            assertEq(moduleRefused('export default { ... };'), 'input.f.js:1:22 - error: unexpected token')
            assertEq(moduleRefused('export default { ...a: 1 };'), 'input.f.js:1:22 - error: unexpected token')
        },
        outputs: () => {
            assertEq(compileSource('const o = { a: 1 }; export default { ...o };')('output.edag.data.js'), 'export default ["{}",[[":","default",["{}",[["...",["{}",[[":","a",1]]]]]]]]];')
            assertEq(compileSource('const o = { a: 1 }; export default { x: 0, ...o, ...{ y: 1 }, };')('output.js'), 'export default {"x":0,...{"a":1},...{"y":1}};')
            assert(compileSource('const o = { a: 1 }; export default { x: 1, ...o, y: 2 };')('output.rs').includes('spread_object([property_item(string_key("x"), f64_any(0x3ff0000000000000)), spread_entries(c0), property_item(string_key("y"), f64_any(0x4000000000000000))])'))
        },
        // a call whose function reads its rest array through a spread stays
        // a call
        notInlined: () => {
            assertEq(compileSource('export default ((...r) => ({ ...r }))();')('output.js'), 'const $0=(...$1)=>{return {...$1};};export default $0();')
        },
        // A spread puts its operand's properties in the object, not the
        // operand: a node is shared through it when a property is a
        // container reached twice, and an object of leaves spread twice
        // shares nothing. With a spread among the members no key selects
        // inside the literal, and no member before a spread is dropped.
        sharing: () => {
            assertEq(compileSource('const o = { k: 1 }; export default [{ ...o }, { ...o }];')('output.json'), '[{"k":1},{"k":1}]')
            assertEq(compileSource('const s = "ab"; export default [{ ...s }, { ...s }];')('output.json'), '[{"0":"a","1":"b"},{"0":"a","1":"b"}]')
            // a container the copied properties hold is one node, which
            // DataJS keeps and JSON writes where each reference reaches it
            assertEq(compileSource('const x = {}; const o = { k: x }; export default [{ ...o }, { ...o }];')('output.data.js'), 'const $0={};export default [{"k":$0},{"k":$0}];')
            assertEq(compileSource('const x = {}; const o = { k: x }; export default [{ ...o }, { ...o }];')('output.json'), '[{"k":{}},{"k":{}}]')
            assertEq(compileSource('const x = {}; export default [{ ...{ k: x } }, x];')('output.json'), '[{"k":{}},{}]')
            assertEq(compileSource('const x = {}; const o = { k: x }; export default [{ ...o }.k, o];')('output.json'), '[{},{"k":{}}]')
            assertEq(compileSource('const x = {}; export default [{ a: x, ...{ b: 1 } }.a, x];')('output.json'), '[{},{}]')
            assertEq(compileSource('const x = {}; export default [{ a: x, ...{ a: 1 } }, x];')('output.json'), '[{"a":1},{}]')
            assertEq(compileSource('const x = {}; const a = [x]; export default [{ ...a }, x];')('output.json'), '[{"0":{}},{}]')
        },
    },
    // Code outputs preserve throws; data outputs execute module initialization.
    throws: () => {
        assertEq(compileSource('export default () => { throw 1; };')('output.js'), 'export default ()=>{throw 1;};')
        assertEq(compileSource('export default (...a) => { const x = a[0]; throw [x, x]; };')('output.js'), 'export default (...$0)=>{throw [$0[0],$0[0]];};')
        assertEq(compileSource('export default () => { throw 1; };')('output.edag.data.js'), 'export default ["{}",[[":","default",["=>",0,[],["throw",1]]]]];')
        assertEq(moduleRefused('export default () => { throw 1; };'), 'output.data.js - error: callable materialization requires a target compile/load boundary')
        assertEq(compileSource('throw "boom";')('output.js'), 'throw "boom";')
        assertEq(compileSource('const a = []; throw 1;')('output.js'), 'const $0=[];throw 1;')
        assertEq(compileSource('throw "boom";')('output.edag.data.js'), 'export default ["throw","boom"];')
        assertEq(moduleRefused('throw "boom";'), 'input.f.js - error: module initialization failed')
        assertEq(jsonRefused('export const a = [1]; throw a;'), 'input.f.js - error: module initialization failed')
        assert(compileSource('throw "boom";')('output.rs').includes('    Err(string_any("boom"))\n'))
        assert(compileSource('export default () => { throw 1; };')('output.rs').includes('{ Err(f64_any(0x3ff0000000000000)) }'))
        assertEq(stderrOf({ 'input.f.js': [utf8('import d from "./dep.f.js"; export default d;')], 'dep.f.js': [utf8('throw 1;')] }), 'dep.f.js - error: module initialization failed')
    },
    /**
     * **The side-by-side page is the compiler's regression table.** For each
     * shared example, one letter per output, in the page's order: `o` where the
     * output is written, `x` where it is refused. JSON and DataJS interpret
     * calls and operators, refuse selected functions and failing initializers,
     * and JSON alone refuses `undefined`; a shared node is written by all five, JSON
     * writing it where each reference reaches it; an import has no file to
     * link, and the tokenizer's refusals stop every output.
     */
}
