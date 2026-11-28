/**
 * A code output is written from the module's value: nothing of its
 * initialization is left, and what a function computes the same way in
 * every call is computed. A module that fails is written as the `throw` of
 * what it failed with. The helpers are the command proof's own.
 */

import { compileFile, noRuntime } from './module.f.js'
import { compileSource, graphSource, readOutput } from './proof.f.js'
import { virtualAt } from '../effects/node/virtual/module.f.js'
import { utf8 } from '../text/module.f.js'
import { assert, assertEq, assertOk } from '../asserts/module.f.js'

export const proof = {
    initialized: () => {
        // the access is read, as the data output reads it
        assertEq(compileSource('const a = { b: 1 }; export default a.b;')('output.js'), 'export default 1;')
        const rust = compileSource('const a = { b: 1 }; export default a.b;')('output.rs')
        assert(rust.includes('f64_any(0x3ff0000000000000)'), rust)
        assert(!rust.includes('Any::dot'), rust)
        // the same program from its graph keeps the access
        assertEq(graphSource('const a = { b: 1 }; export default a.b;')('output.js'), 'export default {"b":1}.b;')
    },
    precomputed: () => {
        // `table(3)` reads no argument of `at`, so the table is made
        // here and the function that made it is gone
        assertEq(
            compileSource('const table = n => [n, n * n]; export const at = i => table(3)[Number(i)];')('output.js'),
            'const $0=[3,9];export const at=($1)=>$0[Number($1)];')
    },
    failedInitialization: () => {
        // a failed initialization is as much computed: the output throws
        // what the module failed with, and holds nothing else of it
        assertEq(compileSource('export default null.x;')('output.js'), 'throw undefined;')
        assert(compileSource('export default null.x;')('output.rs').includes('    Err(Nullish::Undefined.to_any())\n'))
        const source = 'const f = (a, b) => x => [a, b, x]; const s = [1]; throw { g: f(s, s), m: "boom" };'
        assertEq(compileSource(source)('output.js'), 'const $0=[1];throw {"g":($1)=>[$0,$0,$1],"m":"boom"};')
    },
    importedFailure: () => {
        // a module fails with what a module it imports throws
        const root = {
            'input.f.js': [utf8('import a from "./a.f.js"; export default [a];')],
            'a.f.js': [utf8('throw "message from a";')],
        }
        const [state, result] = virtualAt(root)(compileFile(noRuntime)('input.f.js', 'output.js'))
        assertOk(result)
        assertEq(readOutput(state.root, 'output.js'), 'throw "message from a";')
    },
    document: () => {
        // a JSON document computes nothing, so both routes write it alike
        const root = { 'input.json': [utf8('{"a":[1,2]}')] }
        const [written] = virtualAt(root)(compileFile(noRuntime)('input.json', 'output.js'))
        const [graph] = virtualAt(root)(compileFile(noRuntime, true)('input.json', 'output.js'))
        assertEq(readOutput(written.root, 'output.js'), 'export default {"a":[1,2]};')
        assertEq(readOutput(graph.root, 'output.js'), 'export default {"a":[1,2]};')
    },
    capturedOnce: () => {
        // two captures of one value are one, as a source function's are
        const source = 'const pair = (a, b) => x => [a, b, x]; const s = [1]; export default pair(s, s);'
        assertEq(compileSource(source)('output.js'), 'const $0=[1];export default ($1)=>[$0,$0,$1];')
    },
}
