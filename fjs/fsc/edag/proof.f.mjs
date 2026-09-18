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
            // a written sign is the prefix operator, and the lowering folds
            // it over a numeric literal: negating one is exact arithmetic,
            // so the graph holds the number and every reader sees the leaf
            // it saw before there was an operator
            expectEdag(edag, ['[]', [1, -0, 2n, 's', true, null, NaN, -Infinity]])
        },
        // a bare `undefined` is a missing tuple position in an EDAG, so it is
        // the tagged node, at the root and inside a container alike
        undefined: () => {
            expectEdag(compile('export default undefined;').edag, ['undefined'])
            expectEdag(compile('export default { a: undefined };').edag, ['{}', [[':', 'a', ['undefined']]]])
        },
        // one node per occurrence, never one node in two places: a node
        // belongs to a scope, so a shared one inside a function and outside
        // it is no EDAG, and the analysis refuses such a graph rather than
        // answer for it. This is what the structural comparison above cannot
        // see, and what a module as ordinary as
        // `[undefined, (...a) => undefined]` produced while `undefined` was
        // one constant — see
        // `fjs/edag/todo/scope-and-identity-free-nodes.md`.
        undefinedPerOccurrence: () => {
            const edag = compile('export default [undefined, (...a) => undefined];').edag
            expectEdag(edag, ['[]', [['undefined'], ['=>', null, ['undefined']]]])
            const [, items] = /** @type {readonly ['[]', readonly Exp[]]} */ (edag)
            const [outside, lambda] = items
            assert(outside !== /** @type {readonly ['=>', null, Exp]} */(lambda)[2], 'one node in two scopes')
            // and two in one scope are two nodes as well, which the analysis
            // merges rather than the linker
            const flat = compile('export default [undefined, undefined];').edag
            const [, pair] = /** @type {readonly ['[]', readonly Exp[]]} */ (flat)
            assert(pair[0] !== pair[1], 'one node twice in one scope')
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
        expectEdag(compile('export default [[1].length, { a: 2 }.a, "s"[0], null.x];').edag, ['[]', [['.', ['[]', [1]], 'length'], ['.', ['{}', [[':', 'a', 2]]], 'a'], ['.', 's', 0], ['.', null, 'x']]])
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
        // an alias is the node it names, so it anchors nothing: `b` is `a`'s
        // node, in the export or below another anchor
        alias: () => {
            expectEdag(compile('const a = []; const b = a; export default a;').edag, ['[]', []])
            expectEdag(compile('const a = []; const b = a; const c = [a]; export default 1;').edag, [',', [['[]', [['[]', []]]], 1]])
            expectEdag(compile('const a = []; const b = a; export default 1;').edag, [',', [['[]', []], 1]])
            expectEdag(compile('import a from "./a.f.js"; const b = a; export default 1;').edag, [',', [['.', ['args'], 0], 1]])
        },
        // source order: the imports, then the entries, then the export
        order: () => {
            expectEdag(compile('import a from "./a.f.js"; const b = 1; const c = 2; export default 3;').edag, [',', [['.', ['args'], 0], 1, 2, 3]])
        },
        // a module the export reaches entirely has no comma at all
        none: () => {
            expectEdag(compile('const a = []; export default [a];').edag, ['[]', [['[]', []]]])
            // a literal read by an access is constructed whole, so what it
            // holds is reached whatever the key selects
            expectEdag(compile('const a = []; export default [a, 0][1];').edag, ['.', ['[]', [['[]', []], 0]], 1])
        },
    },
    // A function is `['=>', null, body]`: no frame yet, and the body a
    // scope of its own, in which the arguments are one node however many
    // references reach them and no module node stands, since the parser
    // refuses a capture — so two functions share nothing, and a function
    // `const` is one node like any other.
    func: () => {
        expectEdag(compile('export default (...a) => a;').edag, ['=>', null, ['args']])
        const shared = compile('export default (...a) => [a, a[0]];').edag
        expectEdag(shared, ['=>', null, ['[]', [['args'], ['.', ['args'], 0]]]])
        assert(shared instanceof Array && shared[0] === '=>', shared)
        const body = shared[2]
        assert(body instanceof Array && body[0] === '[]', shared)
        const [first, second] = body[1]
        assert(second instanceof Array && second[0] === '.' && second[1] === first, shared)
        const both = compile('const f = (...a) => 1; export default [f, f];').edag
        expectEdag(both, ['[]', [['=>', null, 1], ['=>', null, 1]]])
        assert(both instanceof Array && both[0] === '[]' && both[1][0] === both[1][1], both)
        expectEdag(compile('export default [(...a) => a, (...a) => a];').edag, ['[]', [['=>', null, ['args']], ['=>', null, ['args']]]])
        // an unreached function is anchored as any entry is, and takes no
        // anchor from an import beside it: the sweep reads it as a leaf
        expectEdag(compile('const f = (...a) => 1; export default 2;').edag, [',', [['=>', null, 1], 2]])
        expectEdag(compile('import y from "./y.f.js"; const f = (...a) => 0; export default 1;').edag, [',', [['.', ['args'], 0], ['=>', null, 0], 1]])
        // linked beside an import: the body's arguments are not rewritten
        expectEdag(program({ 'a.f.js': file('import y from "./y.f.js"; export default [y, (...x) => x];'), 'y.f.js': file('export default 1;') })('a.f.js'), ['[]', [1, ['=>', null, ['args']]]])
        // a block body is the same function as the expression body it
        // returns, so the two spell one graph — and the object literal the
        // expression body cannot spell reaches the lowering through it
        expectEdag(compile('export default (...a) => { return a; };').edag, ['=>', null, ['args']])
        expectEdag(compile('export default (...a) => { return [a, a[0]]; };').edag, ['=>', null, ['[]', [['args'], ['.', ['args'], 0]]]])
        expectEdag(compile('export default (...a) => { return { x: a }; };').edag, ['=>', null, ['{}', [[':', 'x', ['args']]]]])
        expectEdag(compile('export default (...a) => { return (...b) => { return b; }; };').edag, ['=>', null, ['=>', null, ['args']]])
    },
    // A call takes the EDAG's two forms, and the callee picks which. A
    // property access as the callee is a method call — `a.b(c)` passes `a`
    // as the receiver, so the access owns the call and the two are one node
    // — and any other callee is the plain call, whose second operand is the
    // arguments spread: `exp0(...exp1)`.
    //
    // The plain call over an access is the *detached* receiver,
    // `(0, a.b)(c)` — parentheses alone keep it, which
    // `chainsJs.receiver` in `fjs/edag/proof.f.mjs` pins against JavaScript
    // — so it needs the comma operator and no source writes one.
    call: () => {
        expectEdag(compile('const f = (...a) => 1; export default f();').edag, ['()', ['=>', null, 1], ['[]', []]])
        expectEdag(compile('const f = (...a) => 1; export default f(1, 2);').edag, ['()', ['=>', null, 1], ['[]', [1, 2]]])
        expectEdag(compile('const o = { b: 1 }; export default o.b(3);').edag, ['.', ['{}', [[':', 'b', 1]]], 'b', ['|()', ['[]', [3]]]])
        expectEdag(compile('const a = [1]; export default a[0](2);').edag, ['.', ['[]', [1]], 0, ['|()', ['[]', [2]]]])
        // a call upon a call: what a step applies to is everything before it
        expectEdag(compile('const f = (...a) => 1; export default f(1)(2);').edag, ['()', ['()', ['=>', null, 1], ['[]', [1]]], ['[]', [2]]])
        // the arguments of a body's call name that body's arguments
        expectEdag(compile('export default (...a) => a[0](a);').edag, ['=>', null, ['.', ['args'], 0, ['|()', ['[]', [['args']]]]]])
        // A call mints identity, so two calls are two nodes and a `const`
        // is one — which is the whole reason a body may name one.
        const twice = compile('const f = (...a) => 1; export default [f(1), f(1)];').edag
        assert(twice instanceof Array && twice[0] === '[]', twice)
        assert(twice[1][0] !== twice[1][1], twice)
        const once = compile('const f = (...a) => 1; const x = f(1); export default [x, x];').edag
        assert(once instanceof Array && once[0] === '[]', once)
        assert(once[1][0] === once[1][1], once)
        // the callee is one node however many calls reach it
        assert(twice[1][0] instanceof Array && twice[1][1] instanceof Array, twice)
        assert(twice[1][0][1] === twice[1][1][1], twice)
        // grouping the access changes nothing: parentheses keep the
        // property reference, so this is the method call above, node for
        // node, and not the detached `(0, o.b)(3)` the comma operator will
        // spell
        expectEdag(compile('const o = { b: 1 }; export default (o.b)(3);').edag, ['.', ['{}', [[':', 'b', 1]]], 'b', ['|()', ['[]', [3]]]])
    },
    // A group lowers to the node of the value it holds and adds none of its
    // own: `(x)` *is* `x`, so the graph and its sharing are the ones the
    // parentheses are not in.
    group: () => {
        expectEdag(compile('export default (1);').edag, 1)
        expectEdag(compile('export default (([1]));').edag, ['[]', [1]])
        expectEdag(compile('export default ([1, 2]).length;').edag, ['.', ['[]', [1, 2]], 'length'])
        expectEdag(compile('export default (...a) => ({ x: a });').edag, ['=>', null, ['{}', [[':', 'x', ['args']]]]])
        // a `const` reached through a group is the node it is reached
        // without one: one node, two references
        const shared = compile('const a = [1]; export default [(a), a];').edag
        expectEdag(shared, ['[]', [['[]', [1]], ['[]', [1]]]])
        assert(shared instanceof Array && shared[0] === '[]', shared)
        assert(shared[1][0] === shared[1][1], shared)
        // how far a prefix reaches is the one thing the parentheses change:
        // the access on the negation, against the negation of the access,
        // which is what `-1 .x` is
        expectEdag(compile('export default (-1).x;').edag, ['.', -1, 'x'])
        expectEdag(compile('export default -1 .x;').edag, ['-', ['.', 1, 'x']])
    },
    // A body `const` is an entry of the body, as a module's is of the
    // module, and lowers the same way: a `const` is one node however many
    // references reach it, an alias is the node it names, and what the
    // returned value does not reach is anchored by the comma rather than
    // dropped — which is the first comma the compiler emits anywhere but a
    // module's root.
    bodyConst: () => {
        const shared = compile('export default (...a) => { const x = [1]; return [x, x]; };').edag
        expectEdag(shared, ['=>', null, ['[]', [['[]', [1]], ['[]', [1]]]]])
        assert(shared instanceof Array && shared[0] === '=>', shared)
        const body = shared[2]
        assert(body instanceof Array && body[0] === '[]', shared)
        // one node, not two equal ones: that is what the `const` is for
        assert(body[1][0] === body[1][1], shared)
        expectEdag(compile('export default (...a) => { const x = 1; return x; };').edag, ['=>', null, 1])
        expectEdag(compile('export default (...a) => { const x = a; return x; };').edag, ['=>', null, ['args']])
        expectEdag(compile('export default (...a) => { const x = a[0]; const y = [x]; return [y, x]; };').edag, ['=>', null, ['[]', [['[]', [['.', ['args'], 0]]], ['.', ['args'], 0]]]])
        // the anchor, inside a body
        expectEdag(compile('export default (...a) => { const x = []; return 1; };').edag, ['=>', null, [',', [['[]', []], 1]]])
        expectEdag(compile('export default (...a) => { const x = null.y; return 1; };').edag, ['=>', null, [',', [['.', null, 'y'], 1]]])
        // an alias is no node of its own, so it anchors nothing
        expectEdag(compile('export default (...a) => { const x = []; const y = x; return y; };').edag, ['=>', null, ['[]', []]])
        // a nested body has its own entries and its own anchor
        expectEdag(compile('export default (...a) => { const x = (...b) => { const y = []; return 1; }; return x; };').edag, ['=>', null, ['=>', null, [',', [['[]', []], 1]]]])
        // each body names its own arguments: two `['args']` nodes, not one,
        // since a node belongs to one scope
        const nested = compile('export default (...a) => { const x = (...b) => b; return [x, a]; };').edag
        assert(nested instanceof Array && nested[0] === '=>', nested)
        const outer = nested[2]
        assert(outer instanceof Array && outer[0] === '[]', nested)
        const inner = outer[1][0]
        assert(inner instanceof Array && inner[0] === '=>', nested)
        assert(inner[2] !== outer[1][1], nested)
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
            // two imports of one module are one node once bound, so the
            // unreached one is anchored only where the node is not already
            // in the graph; before binding they are two parameters
            const twice = { 'a.f.js': file('import m from "./m.f.js"; import n from "./m.f.js"; export default [m];'), 'm.f.js': file('export default [1];') }
            expectEdag(program(twice)('a.f.js'), ['[]', [['[]', [1]]]])
            expectEdag(compile('import m from "./m.f.js"; import n from "./m.f.js"; export default [m];').edag, [',', [['.', ['args'], 1], ['[]', [['.', ['args'], 0]]]]])
            expectEdag(program({ ...twice, 'a.f.js': file('import m from "./m.f.js"; import n from "./m.f.js"; export default 1;') })('a.f.js'), [',', [['[]', [1]], 1]])
        },
    },
}
