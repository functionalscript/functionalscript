/**
 * @import { Exp } from '../../edag/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 */

import { resolve, unresolved } from './module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { exp } from '../../edag/module.f.mjs'
import { validate } from '../../rtti/validate/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** A module's text through the front end and the lowering, a parse refusal thrown. @type {(source: string) => Unresolved} */
const compile = source => unresolved(unwrap(parse('')(source)))

/** A file of the virtual file system. @type {(text: string) => readonly Vec[]} */
const file = text => [utf8(text)]

/** The program at `path` linked over a virtual file system, as the linker reports it. @type {(root: Dir) => (path: string) => Result<Exp, ParseError>} */
const linked = root => path => virtual({ ...emptyState, root })(resolve(path))[1]

/** The program at `path` linked, refusals thrown. @type {(root: Dir) => (path: string) => Exp} */
const program = root => path => unwrap(linked(root)(path))

/** The linker's refusal of the program at `path`: its message, and whether it carries a position. @type {(root: Dir) => (path: string) => string} */
const linkRefusal = root => path => {
    const [tag, value] = linked(root)(path)
    assert(tag === 'error', tag)
    return `${value.message} at ${value.metadata === null ? 'no position' : `${value.metadata.line}:${value.metadata.column}`}`
}

/** An EDAG the schema admits, and structurally the one expected. @type {(edag: Exp, expected: Exp) => void} */
const expectEdag = (edag, expected) => {
    assertEq(validate(exp)(edag)[0], 'ok')
    assertStructurallySame(edag, expected)
}

export const proof = {
    // The issue's own example: one shared `const` is one node, reached from
    // two members, and the import is a property of the arguments.
    example: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; const x = [a, 1]; export default { x: x, y: x };')
        assertStructurallySame(imports, [{ specifier: './a.f.js', json: false }])
        expectEdag(edag, ['{}', [[':', 'x', ['[]', [['.', ['args'], 0], 1]]], [':', 'y', ['[]', [['.', ['args'], 0], 1]]]]])
        assert(edag instanceof Array && edag[0] === '{}', edag)
        const [x, y] = edag[1]
        assert(x instanceof Array && y instanceof Array && x[2] === y[2], edag)
    },
    leaves: {
        primitives: () => {
            const { imports, edag } = compile('export default [1, -0, 2n, "s", true, null, NaN, -Infinity];')
            assertStructurallySame(imports, [])
            expectEdag(edag, ['[]', [1, -0, 2n, 's', true, null, NaN, -Infinity]])
        },
        // a bare `undefined` is a missing tuple position in an EDAG, so it is
        // the tagged node, at the root and inside a container alike
        undefined: () => {
            expectEdag(compile('export default undefined;').edag, ['undefined'])
            expectEdag(compile('export default { a: undefined };').edag, ['{}', [[':', 'a', ['undefined']]]])
        },
    },
    // an object's members as written: a repeated key twice, an integer-like
    // key where it stands, which is what the constructor takes
    members: () => {
        expectEdag(compile('export default { b: 1, "1": 2, b: 3 };').edag, ['{}', [[':', 'b', 1], [':', '1', 2], [':', 'b', 3]]])
        expectEdag(compile('export default { ["__proto__"]: 1 };').edag, ['{}', [[':', '__proto__', 1]]])
    },
    // a `const` reached along a chain of `const`s is reached, and its node
    // is the one the chain ends at
    chain: () => {
        const { edag } = compile('const a = []; const b = [a]; const c = { b: b }; export default [c, a];')
        expectEdag(edag, ['[]', [['{}', [[':', 'b', ['[]', [['[]', []]]]]]], ['[]', []]]])
        assert(edag instanceof Array && edag[0] === '[]', edag)
        const [c, a] = edag[1]
        assert(c instanceof Array && c[0] === '{}', c)
        const b = c[1][0]
        assert(b instanceof Array && b[0] === ':' && b[2] instanceof Array && b[2][0] === '[]', b)
        assert(b[2][1][0] === a, edag)
    },
    // a property access is the EDAG's own form, its key the constant written
    access: () => {
        expectEdag(compile('const a = { b: [1] }; export default a.b;').edag, ['.', ['{}', [[':', 'b', ['[]', [1]]]]], 'b'])
        expectEdag(compile('const a = [[1]]; export default a[0][0];').edag, ['.', ['.', ['[]', [['[]', [1]]]], 0], 0])
        expectEdag(compile('import m from "./m.f.js"; export default m["x"].y;').edag, ['.', ['.', ['.', ['args'], 0], 'x'], 'y'])
        const root = { 'a.f.js': file('import m from "./m.f.js"; export default m.x;'), 'm.f.js': file('export default { x: 1 };') }
        expectEdag(program(root)('a.f.js'), ['.', ['{}', [[':', 'x', 1]]], 'x'])
    },
    // imports take their positions from the source, and one import is one
    // parameter node however many references reach it
    parameters: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; import b from "./b.f.js"; export default [b, a, b];')
        assertStructurallySame(imports, [{ specifier: './a.f.js', json: false }, { specifier: './b.f.js', json: false }])
        expectEdag(edag, ['[]', [['.', ['args'], 1], ['.', ['args'], 0], ['.', ['args'], 1]]])
        assert(edag instanceof Array && edag[0] === '[]' && edag[1][0] === edag[1][2], edag)
    },
    // A member a later duplicate shadows is in the graph — the constructor
    // applies every member written — so a reference in it is reached, and
    // the module compiles where its value alone would say the `const` is
    // dropped; the sharing decision, which reads the value, says otherwise
    // of the same source, and both are right about their own question.
    shadowed: () => {
        expectEdag(compile('const s = [1]; export default { a: s, a: 1 };').edag, ['{}', [[':', 'a', ['[]', [1]]], [':', 'a', 1]]])
        expectEdag(compile('import a from "./a.f.js"; export default { x: a, x: 0 };').edag, ['{}', [[':', 'x', ['.', ['args'], 0]], [':', 'x', 0]]])
    },
    // What the export does not reach is anchored, not dropped: `transpile`
    // reads every import and `run` evaluates every `const`, so a compile
    // that fails on a broken unused import must not succeed here. The comma
    // operation holds the roots of the unreached part before the export,
    // and takes the export's value.
    anchored: {
        import: () => {
            expectEdag(compile('import a from "./a.f.js"; export default 1;').edag, [',', [['.', ['args'], 0], 1]])
            expectEdag(compile('import a from "./a.f.js"; import b from "./b.f.js"; export default [b];').edag, [',', [['.', ['args'], 0], ['[]', [['.', ['args'], 1]]]]])
        },
        const: () => {
            expectEdag(compile('const a = []; export default 1;').edag, [',', [['[]', []], 1]])
            expectEdag(compile('const n = null; const check = n.x; export default 1;').edag, [',', [['.', null, 'x'], 1]])
            // a reached `const` stays one node, inside the anchor and the export
            const edag = compile('const a = []; const b = [a, a]; export default [a];').edag
            expectEdag(edag, [',', [['[]', [['[]', []], ['[]', []]]], ['[]', [['[]', []]]]]])
            assert(edag instanceof Array && edag[0] === ',', edag)
            const [b, exported] = edag[1]
            assert(b instanceof Array && exported instanceof Array && b[0] === '[]' && exported[0] === '[]', edag)
            assert(b[1][0] === b[1][1] && b[1][0] === exported[1][0], edag)
        },
        // only the roots are operands: an unreached `const` another one
        // reaches, and an import reached only through one, are anchored
        // through it — an operand a sibling reaches is a redundant anchor
        roots: () => {
            expectEdag(compile('const a = []; const b = [a]; export default 1;').edag, [',', [['[]', [['[]', []]]], 1]])
            expectEdag(compile('import a from "./a.f.js"; const b = [a]; export default 1;').edag, [',', [['[]', [['.', ['args'], 0]]], 1]])
        },
        // source order: the imports, then the entries, then the export
        order: () => {
            expectEdag(compile('import a from "./a.f.js"; const b = 1; const c = 2; export default 3;').edag, [',', [['.', ['args'], 0], 1, 2, 3]])
        },
        // a module the export reaches entirely has no comma at all
        none: () => {
            expectEdag(compile('const a = []; export default [a];').edag, ['[]', [['[]', []]]])
        },
    },
    // The imports bound: the linked program is one EDAG, the imported
    // module's node where the importer's parameter was, and no path in it.
    resolve: {
        alone: () => {
            expectEdag(program({ 'a.f.js': file('export default [1, { b: 2n }];') })('a.f.js'), ['[]', [1, ['{}', [[':', 'b', 2n]]]]])
        },
        // one import reached twice is one node, the imported module's
        bound: () => {
            const root = { 'a.f.js': file('import b from "./b.f.js"; export default [b, b];'), 'b.f.js': file('const x = [1]; export default { x: x };') }
            const edag = program(root)('a.f.js')
            expectEdag(edag, ['[]', [['{}', [[':', 'x', ['[]', [1]]]]], ['{}', [[':', 'x', ['[]', [1]]]]]]])
            assert(edag instanceof Array && edag[0] === '[]' && edag[1][0] === edag[1][1], edag)
        },
        // a diamond joins at one node: `d` is resolved once and both paths
        // to it bind the same EDAG, as the issue requires of a link
        diamond: () => {
            const root = {
                'a.f.js': file('import b from "./b.f.js"; import c from "./c.f.js"; export default [b, c];'),
                'b.f.js': file('import d from "./d.f.js"; export default { b: d };'),
                'c.f.js': file('import d from "./d.f.js"; export default { c: d };'),
                'd.f.js': file('export default [42];'),
            }
            const edag = program(root)('a.f.js')
            expectEdag(edag, ['[]', [['{}', [[':', 'b', ['[]', [42]]]]], ['{}', [[':', 'c', ['[]', [42]]]]]]])
            assert(edag instanceof Array && edag[0] === '[]', edag)
            const [b, c] = edag[1]
            assert(b instanceof Array && b[0] === '{}' && c instanceof Array && c[0] === '{}', edag)
            const [bd] = b[1]
            const [cd] = c[1]
            assert(bd instanceof Array && bd[0] === ':' && cd instanceof Array && cd[0] === ':' && bd[2] === cd[2], edag)
        },
        // the path is resolved against the importer's, so a module in a
        // directory imports its sibling and its parent's file by name
        paths: () => {
            const root = {
                dir: { 'a.f.js': file('import s from "./s.f.js"; import p from "../p.f.js"; export default [s, p];'), 's.f.js': file('export default 1;') },
                'p.f.js': file('export default 2;'),
            }
            expectEdag(program(root)('dir/a.f.js'), ['[]', [1, 2]])
        },
        // a module whose EDAG is `null` is recorded and found again: the
        // record boxes it, since `null` is also what an absent record says
        nullModule: () => {
            const root = { 'a.f.js': file('import n from "./n.f.js"; import m from "./n.f.js"; export default [n, m];'), 'n.f.js': file('export default null;') }
            expectEdag(program(root)('a.f.js'), ['[]', [null, null]])
        },
        // a JSON module, imported `with { type: "json" }`, is the tree its
        // document denotes, as `transpile` reads it; the root read as a
        // program is a JSON module by its extension, and an attribute that
        // disagrees with the extension is refused, as JavaScript refuses it
        json: () => {
            const root = { 'a.f.js': file('import j from "./j.json" with { type: "json" }; export default [j, j];'), 'j.json': file('{"a": [1, null, "s"], "b": {}}') }
            const edag = program(root)('a.f.js')
            expectEdag(edag, ['[]', [['{}', [[':', 'a', ['[]', [1, null, 's']]], [':', 'b', ['{}', []]]]], ['{}', [[':', 'a', ['[]', [1, null, 's']]], [':', 'b', ['{}', []]]]]]])
            assert(edag instanceof Array && edag[0] === '[]' && edag[1][0] === edag[1][1], edag)
            expectEdag(program({ 'j.json': file('[true, 2.5]') })('j.json'), ['[]', [true, 2.5]])
            assertEq(linkRefusal({ ...root, 'a.f.js': file('import j from "./j.json"; export default [j];') })('a.f.js'), 'a JSON module needs the import attribute with { type: "json" } at no position')
            assertEq(linkRefusal({ 'a.f.js': file('import j from "./j.f.js" with { type: "json" }; export default [j];'), 'j.f.js': file('[1]') })('a.f.js'), 'only a JSON module is imported with { type: "json" } at no position')
            // a file met before is refused all the same when a later import
            // misspells it: the contract is the import's, not the file's
            assertEq(linkRefusal({ ...root, 'a.f.js': file('import j from "./j.json" with { type: "json" }; import k from "./j.json"; export default [j, k];') })('a.f.js'), 'a JSON module needs the import attribute with { type: "json" } at no position')
            assertEq(linkRefusal({ 'a.f.js': file('import m from "./m.f.js"; import k from "./m.f.js" with { type: "json" }; export default [m, k];'), 'm.f.js': file('export default 1;') })('a.f.js'), 'only a JSON module is imported with { type: "json" } at no position')
        },
        // the failures `transpile` reports, reported the same way
        refused: () => {
            assertEq(linkRefusal({ 'a.f.js': file('import b from "./b.f.js"; export default [b];') })('a.f.js'), 'file not found at no position')
            assertEq(linkRefusal({})('a.f.js'), 'file not found at no position')
            assertEq(linkRefusal({ 'a.f.js': file('import b from "./b.f.js"; export default [b];'), 'b.f.js': file('import a from "./a.f.js"; export default [a];') })('a.f.js'), 'circular dependency at no position')
            assertEq(linkRefusal({ 'a.f.js': file('import a from "./a.f.js"; export default [a];') })('a.f.js'), 'circular dependency at no position')
            assertEq(linkRefusal({ 'a.f.js': file('import b from "./b.f.js"; export default [b];'), 'b.f.js': file('export default [;') })('a.f.js'), 'unexpected token at 1:17')
            assertEq(linkRefusal({ 'a.f.js': file('import j from "./j.json" with { type: "json" }; export default [j];'), 'j.json': file('{') })('a.f.js'), 'unexpected end at no position')
        },
        // an anchor is linked as any node is: an imported module's anchored
        // `const` is in the program, and an import the export does not
        // reach is the imported module's EDAG, anchored
        anchored: () => {
            expectEdag(program({ 'a.f.js': file('import b from "./b.f.js"; export default [b];'), 'b.f.js': file('const x = 1; export default 2;') })('a.f.js'), ['[]', [[',', [1, 2]]]])
            expectEdag(program({ 'a.f.js': file('import b from "./b.f.js"; export default 1;'), 'b.f.js': file('export default 2;') })('a.f.js'), [',', [2, 1]])
            expectEdag(program({ 'a.f.js': file('import b from "./b.f.js"; export default 1;'), 'b.f.js': file('const x = 1; export default 2;') })('a.f.js'), [',', [[',', [1, 2]], 1]])
        },
    },
}
