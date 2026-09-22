/**
 * @import { Exp } from '../../edag/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { memo } from '../../edag/memo/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { _defaultExport, resolve, unresolved } from './module.f.mjs'
import { _shapeOf, _walk, demo } from './demo.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { exp } from '../../edag/module.f.mjs'
import { validate } from '../../rtti/validate/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'

/** The default export's computation through the front end and lowering, a parse refusal thrown. @type {(source: string) => Unresolved} */
const compile = source => {
    const { imports, edag } = unresolved(unwrap(parse('')(source)))
    return { imports, edag: _defaultExport(edag) }
}

/** A file of the virtual file system. @type {(text: string) => readonly Vec[]} */
const file = text => [utf8(text)]

/** The program at `path` linked over a virtual file system, as the linker reports it. @type {(root: Dir) => (path: string) => Result<Exp, ParseError>} */
const linked = root => path => virtual({ ...emptyState, root })(resolve(path))[1]

/** The linked default export (or direct JSON document), refusals thrown. @type {(root: Dir) => (path: string) => Exp} */
const program = root => path => {
    const edag = unwrap(linked(root)(path))
    return path.endsWith('.json') ? edag : _defaultExport(edag)
}

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

/**
 * Confirms `exp` is a left-associative `+` chain `depth` terms deep, bottoming
 * out at `1` — `((1+1)+1)+…`. `validate`/`assertStructurallySame` are
 * themselves recursive (`fjs/edag/todo/stack-safety.md` tracks that, one
 * layer down from this one), so a chain deep enough to prove `lower` stack-safe
 * overflows them before it says anything about `lower`. This walks the same
 * shape iteratively instead, the one comparison this proof needs at a depth
 * the two shared helpers cannot reach.
 * @type {(depth: number) => (exp: Exp) => void}
 */
const expectPlusChain = depth => exp => {
    let node = exp
    let remaining = depth
    while (remaining > 0) {
        assert(Array.isArray(node) && node[0] === '+' && node[2] === 1, node)
        node = node[1]
        remaining = remaining - 1
    }
    assertEq(node, 1)
}

/** @type {(graph: Exp) => unknown} */
const execute = graph => memo(analysis(graph))({ frame: null, args: [] })

export const proof = {
    namedExports: {
        sharing: () => {
            const source = 'export const z=[]; export const a=z; export default a;'
            const graph = unresolved(unwrap(parse('')(source))).edag
            const result = /** @type {{ a: unknown, z: unknown, default: unknown }} */ (execute(graph))
            assertStructurallySame(Object.keys(result), ['a', 'default', 'z'])
            assert(result.a === result.z && result.a === result.default)
            assertStructurallySame(result.a, [])
            expectEdag(_defaultExport(['{}', []]), ['.', ['{}', []], 'default'])
        },
        imports: () => {
            const root = {
                'main.f.js': file('import a from "./dep.f.js"; import b from "./dep.f.js"; export const a1=a; export default [a,b];'),
                'dep.f.js': file('export const z=[]; export default z;'),
            }
            const result = /** @type {{ a1: unknown, default: readonly unknown[] }} */ (execute(unwrap(linked(root)('main.f.js'))))
            assert(result.a1 === result.default[0] && result.default[0] === result.default[1])
            const missing = { 'main.f.js': file('import a from "./dep.f.js"; export default 1;'), 'dep.f.js': file('export const a=1;') }
            assertEq(linkRefusal(missing)('main.f.js'), 'module has no default export at no position')
            const defined = { ...missing, 'dep.f.js': file('export const a=1; export default undefined;') }
            assertStructurallySame(execute(unwrap(linked(defined)('main.f.js'))), { default: 1 })
        },
        importedFunction: () => {
            const root = {
                'main.f.js': file('import f from "./dep.f.js"; export default f(5);'),
                'dep.f.js': file('export const a=1; export default (...args)=>args;'),
            }
            const graph = program(root)('main.f.js')
            assert(graph instanceof Array && graph[0] === '()')
            assertStructurallySame(execute(graph), [5])
        },
        dependencyOrder: () => {
            const graph = unresolved(unwrap(parse('')('export const z=[]; export const a=[z];'))).edag
            const result = /** @type {{ a: readonly unknown[], z: unknown }} */ (execute(graph))
            assertStructurallySame(Object.keys(result), ['a', 'z'])
            assert(result.a[0] === result.z)
        },
        throw: {
            unselectedInitializer: () => execute(program({
                'main.f.js': file('import x from "./dep.f.js"; export default x;'),
                'dep.f.js': file('export const bad=null.x; export default 7;'),
            })('main.f.js')),
        },
    },
    moduleResult: {
        default: () => {
            expectEdag(unresolved(unwrap(parse('')('export default 7;'))).edag,
                ['{}', [[':', 'default', 7]]])
            expectEdag(unresolved(unwrap(parse('')('export default { a: 5 };'))).edag,
                ['{}', [[':', 'default', ['{}', [[':', 'a', 5]]]]]])
            expectEdag(unresolved(unwrap(parse('')('export default undefined;'))).edag,
                ['{}', [[':', 'default', ['undefined']]]])
        },
        imports: () => {
            expectEdag(unresolved(unwrap(parse('')('import x from "./dep.f.js"; export default x;'))).edag,
                ['{}', [[':', 'default', ['.', ['.', ['args'], 0], 'default']]]])
            const root = {
                'main.f.js': file('import x from "./middle.f.js"; export default x;'),
                'middle.f.js': file('import x from "./dep.json" with { type: "json" }; export default x;'),
                'dep.json': file('{"default":7}'),
            }
            expectEdag(unwrap(linked(root)('main.f.js')),
                ['{}', [[':', 'default', ['{}', [[':', 'default', 7]]]]]])
        },
        functionReturn: () => {
            expectEdag(unresolved(unwrap(parse('')('export default () => { return 7; };'))).edag,
                ['{}', [[':', 'default', ['=>', null, 7]]]])
            const root = {
                'main.f.js': file('import f from "./dep.f.js"; export default f();'),
                'dep.f.js': file('export default () => 7;'),
            }
            expectEdag(unwrap(linked(root)('main.f.js')),
                ['{}', [[':', 'default', ['()', ['=>', null, 7], ['[]', []]]]]])
        },
        repeatedAnchoredImport: () => {
            const root = {
                'main.f.js': file('import a from "./dep.f.js"; import b from "./dep.f.js"; export default [a,b];'),
                'dep.f.js': file('const unused = []; export default [7];'),
            }
            const edag = program(root)('main.f.js')
            assert(edag instanceof Array && edag[0] === '[]')
            assert(edag[1][0] === edag[1][1])
            const imported = edag[1][0]
            assert(imported instanceof Array && imported[0] === ',')
            expectEdag(imported, [',', [['[]', []], ['[]', [7]]]])
        },
        throw: {
            // Malformed internal module boundaries remain compiler errors.
            leaf: () => _defaultExport(7),
            array: () => _defaultExport(['[]', []]),
            spread: () => _defaultExport(['{}', [['...', 7]]]),
            emptyScope: () => _defaultExport([',', []]),
        },
    },
    // The issue's own example: one shared `const` is one node, reached from
    // two members, and the import is a property of the arguments.
    example: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; const x = [a, 1]; export default { x: x, y: x };')
        assertStructurallySame(imports, [{ specifier: './a.f.js', json: false }])
        expectEdag(edag, ['{}', [[':', 'x', ['[]', [['.', ['.', ['args'], 0], 'default'], 1]]], [':', 'y', ['[]', [['.', ['.', ['args'], 0], 'default'], 1]]]]])
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
        expectEdag(compile('import m from "./m.f.js"; export default m["x"].y;').edag, ['.', ['.', ['.', ['.', ['args'], 0], 'default'], 'x'], 'y'])
        expectEdag(compile('export default [[1].length, { a: 2 }.a, "s"[0], null.x];').edag, ['[]', [['.', ['[]', [1]], 'length'], ['.', ['{}', [[':', 'a', 2]]], 'a'], ['.', 's', 0], ['.', null, 'x']]])
        const root = { 'a.f.js': file('import m from "./m.f.js"; export default m.x;'), 'm.f.js': file('export default { x: 1 };') }
        expectEdag(program(root)('a.f.js'), ['.', ['{}', [[':', 'x', 1]]], 'x'])
    },
    // Linking uses the same URL-path resolution as transpilation: an escaped
    // spelling resolves to dep.f.js, not to a literal %64ep.f.js sibling.
    percentEscapedImport: () => {
        const root = {
            'main.f.js': file('import value from "./%64ep.f.js"; export default value;'),
            'dep.f.js': file('export default 1;'),
            '%64ep.f.js': file('export default 2;'),
        }
        expectEdag(program(root)('main.f.js'), 1)
    },
    // imports take their positions from the source, and one import is one
    // parameter node however many references reach it
    parameters: () => {
        const { imports, edag } = compile('import a from "./a.f.js"; import b from "./b.f.js"; export default [b, a, b];')
        assertStructurallySame(imports, [{ specifier: './a.f.js', json: false }, { specifier: './b.f.js', json: false }])
        expectEdag(edag, ['[]', [['.', ['.', ['args'], 1], 'default'], ['.', ['.', ['args'], 0], 'default'], ['.', ['.', ['args'], 1], 'default']]])
        assert(edag instanceof Array && edag[0] === '[]' && edag[1][0] === edag[1][2], edag)
    },
    // A member a later duplicate shadows is in the graph — the constructor
    // applies every member written — so a reference in it is reached, and
    // the module compiles where its value alone would say the `const` is
    // dropped; the sharing decision, which reads the value, says otherwise
    // of the same source, and both are right about their own question.
    shadowed: () => {
        expectEdag(compile('const s = [1]; export default { a: s, a: 1 };').edag, ['{}', [[':', 'a', ['[]', [1]]], [':', 'a', 1]]])
        expectEdag(compile('import a from "./a.f.js"; export default { x: a, x: 0 };').edag, ['{}', [[':', 'x', ['.', ['.', ['args'], 0], 'default']], [':', 'x', 0]]])
    },
    // What the export does not reach is anchored, not dropped: `transpile`
    // reads every import and `run` evaluates every `const`, so a compile
    // that fails on a broken unused import must not succeed here. The comma
    // operation holds the roots of the unreached part before the export,
    // and takes the export's value.
    anchored: {
        import: () => {
            expectEdag(compile('import a from "./a.f.js"; export default 1;').edag, [',', [['.', ['.', ['args'], 0], 'default'], 1]])
            expectEdag(compile('import a from "./a.f.js"; import b from "./b.f.js"; export default [b];').edag, [',', [['.', ['.', ['args'], 0], 'default'], ['[]', [['.', ['.', ['args'], 1], 'default']]]]])
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
            expectEdag(compile('import a from "./a.f.js"; const b = [a]; export default 1;').edag, [',', [['[]', [['.', ['.', ['args'], 0], 'default']]], 1]])
        },
        // an alias is the node it names, so it anchors nothing: `b` is `a`'s
        // node, in the export or below another anchor
        alias: () => {
            expectEdag(compile('const a = []; const b = a; export default a;').edag, ['[]', []])
            expectEdag(compile('const a = []; const b = a; const c = [a]; export default 1;').edag, [',', [['[]', [['[]', []]]], 1]])
            expectEdag(compile('const a = []; const b = a; export default 1;').edag, [',', [['[]', []], 1]])
            expectEdag(compile('import a from "./a.f.js"; const b = a; export default 1;').edag, [',', [['.', ['.', ['args'], 0], 'default'], 1]])
        },
        // source order: the imports, then the entries, then the export
        order: () => {
            expectEdag(compile('import a from "./a.f.js"; const b = 1; const c = 2; export default 3;').edag, [',', [['.', ['.', ['args'], 0], 'default'], 1, 2, 3]])
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
        expectEdag(compile('import y from "./y.f.js"; const f = (...a) => 0; export default 1;').edag, [',', [['.', ['.', ['args'], 0], 'default'], ['=>', null, 0], 1]])
        // linked beside an import: the body's arguments are not rewritten
        expectEdag(program({ 'a.f.js': file('import y from "./y.f.js"; export default [y, (...x) => x];'), 'y.f.js': file('export default 1;') })('a.f.js'), ['[]', [1, ['=>', null, ['args']]]])
        // a block body is the same function as the expression body it
        // returns, so the two spell one graph — and an object literal, which
        // the expression body cannot spell bare, reaches the lowering
        // through either it or a group
        expectEdag(compile('export default (...a) => { return a; };').edag, ['=>', null, ['args']])
        expectEdag(compile('export default (...a) => { return [a, a[0]]; };').edag, ['=>', null, ['[]', [['args'], ['.', ['args'], 0]]]])
        expectEdag(compile('export default (...a) => { return { x: a }; };').edag, ['=>', null, ['{}', [[':', 'x', ['args']]]]])
        expectEdag(compile('export default (...a) => { return (...b) => { return b; }; };').edag, ['=>', null, ['=>', null, ['args']]])
    },
    // Source blocks and returns survive parsing, but lowering still gives
    // equivalent bodies the same EDAG, including nested block functions.
    explicitReturns: () => {
        for (const [expression, block] of [
            ['() => 7', '() => { return 7; }'],
            ['() => () => 7', '() => { return () => { return 7; }; }'],
            ['(...a) => [a, a[0]]', '(...a) => { return [a, a[0]]; }'],
        ]) {
            const expected = compile(`export default ${expression};`).edag
            expectEdag(compile(`export default ${block};`).edag, expected)
        }
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
        // a group is a `-`'s operand, so a prefix reaches a function and an
        // access on one, which nothing else spells: `-((...a) => 1)` is
        // JavaScript's `NaN` and `-(...a) => 1` its syntax error
        expectEdag(compile('export default -(1);').edag, -1)
        expectEdag(compile('export default -((...a) => 1);').edag, ['-', ['=>', null, 1]])
        expectEdag(compile('export default -([1, 2]).length;').edag, ['-', ['.', ['[]', [1, 2]], 'length']])
        // and how far the prefix reaches is the one thing the parentheses
        // change: the access on the negation, against the negation of the
        // access, which is what `-1 .x` is
        expectEdag(compile('export default (-1).x;').edag, ['.', -1, 'x'])
        expectEdag(compile('export default -1 .x;').edag, ['-', ['.', 1, 'x']])
    },
    // Stage A of `spec/todo/2340-operators.md`: arithmetic, strict
    // comparison, and bitwise, each the EDAG's own `op2`/`op12`/`op1` shape
    // with both operands lowered and nothing folded — the binary `-`
    // included, told from the unary one the `group` block already covers
    // by arity, never by this tag alone. Folding one would need to say
    // what every operator computes over every value it might see, which is
    // the EDAG's question and not the front end's.
    operators: () => {
        expectEdag(compile('export default 1 + 2 * 3;').edag, ['+', 1, ['*', 2, 3]])
        expectEdag(compile('export default 5 - 2;').edag, ['-', 5, 2])
        expectEdag(compile('export default 2 ** 3 ** 2;').edag, ['**', 2, ['**', 3, 2]])
        expectEdag(compile('export default 1 < 2 << 3;').edag, ['<', 1, ['<<', 2, 3]])
        expectEdag(compile('export default 1 === 2;').edag, ['===', 1, 2])
        expectEdag(compile('export default 1 & 2 | 3 ^ 4;').edag, ['|', ['&', 1, 2], ['^', 3, 4]])
        expectEdag(compile('export default ~1;').edag, ['~', 1])
        // unary `-` still folds over a numeric literal, even nested inside
        // a binary operator the lowering does not fold
        expectEdag(compile('export default -1 * 2;').edag, ['*', -1, 2])
        // a `const` reached through two operands is one node, as through
        // any other operator
        const shared = compile('const a = [1]; export default a + a;').edag
        expectEdag(shared, ['+', ['[]', [1]], ['[]', [1]]])
        assert(shared instanceof Array && shared[0] === '+', shared)
        assert(shared[1] === shared[2], shared)
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
            expectEdag(compile('import m from "./m.f.js"; import n from "./m.f.js"; export default [m];').edag, [',', [['.', ['.', ['args'], 1], 'default'], ['[]', [['.', ['.', ['args'], 0], 'default']]]]])
            expectEdag(program({ ...twice, 'a.f.js': file('import m from "./m.f.js"; import n from "./m.f.js"; export default 1;') })('a.f.js'), [',', [['[]', [1]], 1]])
        },
    },
    // A chain of operators, as deep as the source that built it: `lower`
    // walks one with an explicit stack rather than recursion, so 5,000
    // terms — the depth `fjs/fsc/parser/proof.f.mjs`'s own `stackSafety`
    // uses — cost no call stack. Left-associative for a binary operator,
    // the EDAG nests on its own left, `((1+1)+1)+…`, checked by
    // `expectPlusChain` rather than `expectEdag` for the reason given on
    // it; right-associative for `-`, on its right, `-(-(-…))`, folding away
    // to the leaf it started from since 5,000 negations is even — a single
    // number, so `expectEdag` never recurses into it.
    stackSafety: () => {
        const plus = `1${' + 1'.repeat(5000)}`
        expectPlusChain(5000)(compile(`export default ${plus};`).edag)
        const neg = `${'- '.repeat(5000)}1`
        expectEdag(compile(`export default ${neg};`).edag, 1)
    },
    demo: {
        /**
         * `_shapeOf` against hand-built `Exp` values, not source text: most
         * of these tags — every `Op1`, most of `Op2`, the ternary, a
         * spread, a computed object key — have no `export default <text>;`
         * that reaches them yet, so this is the only way to the whole
         * walker rather than only its currently-reachable half. A chain
         * continuation and optional chaining's own tags are refused the
         * same way, and that path is tested here too, for the same reason.
         */
        shapeOf: {
            array: {
                plain: () => {
                    const shape = assertNotNullish(_shapeOf(['[]', [1, 2]]), 'expected a shape')
                    assertEq(shape.label, '[]')
                    assertStructurallySame(shape.children, [['0', 1], ['1', 2]])
                },
                // A spread item is one child, named by its position rather
                // than by an index that would claim it names one array slot.
                spread: () => {
                    const shape = assertNotNullish(_shapeOf(['[]', [['...', ['a']]]]), 'expected a shape')
                    assertStructurallySame(shape.children, [['...0', ['a']]])
                },
            },
            object: {
                // A literal string key becomes the edge label; no separate
                // node for it, the same economy the DataJS demo spends on
                // object keys.
                literalKey: () => {
                    const shape = assertNotNullish(_shapeOf(['{}', [[':', 'x', 1]]]), 'expected a shape')
                    assertStructurallySame(shape.children, [['x', 1]])
                },
                // A computed key is itself an `Exp` with nothing to fold
                // into a label, so it gets a node of its own, alongside the
                // value's.
                computedKey: () => {
                    const shape = assertNotNullish(_shapeOf(['{}', [[':', ['a'], 1]]]), 'expected a shape')
                    assertStructurallySame(shape.children, [['key0', ['a']], ['value0', 1]])
                },
                spread: () => {
                    const shape = assertNotNullish(_shapeOf(['{}', [['...', ['a']]]]), 'expected a shape')
                    assertStructurallySame(shape.children, [['...0', ['a']]])
                },
            },
            dot: {
                // A string index folds into the node's own label; nothing
                // about it needs a child edge to say what it is.
                literalString: () => {
                    const shape = assertNotNullish(_shapeOf(['.', ['a'], 'x']), 'expected a shape')
                    assertEq(shape.label, '.x')
                    assertStructurallySame(shape.children, [['obj', ['a']]])
                },
                literalNumber: () => {
                    const shape = assertNotNullish(_shapeOf(['.', ['a'], 0]), 'expected a shape')
                    assertEq(shape.label, '[0]')
                },
                // A computed index — `Number(x)`, the one shape `Index`
                // allows beyond a bare literal — is an `Exp`, so it gets a
                // child edge the way a computed object key does.
                computed: () => {
                    const shape = assertNotNullish(_shapeOf(['.', ['a'], ['Number', ['b']]]), 'expected a shape')
                    assertEq(shape.label, '.')
                    assertStructurallySame(shape.children, [['obj', ['a']], ['idx', ['Number', ['b']]]])
                },
                // A chain continuation is a fourth element past the
                // ordinary two- or three-element form — not yet drawn, so
                // refused rather than misread as an extra plain operand.
                continuation: () => assertEq(_shapeOf(['.', ['a'], 'x', ['|()', 1]]), null),
            },
            call: () => {
                const shape = assertNotNullish(_shapeOf(['()', ['a'], ['b']]), 'expected a shape')
                assertEq(shape.label, '()')
                assertStructurallySame(shape.children, [['callee', ['a']], ['arg', ['b']]])
            },
            /**
             * **A comma's operands are named, not numbered.** It establishes
             * all of them and takes the value of the last; the earlier ones
             * exist for their throw-potential only. Numbers showed five
             * equals where one is the answer and the rest only have to
             * happen.
             */
            comma: () => {
                const shape = assertNotNullish(_shapeOf([',', [1, 2, 3]]), 'expected a shape')
                assertStructurallySame(shape.children, [
                    ['anchor', 1], ['anchor', 2], ['result', 3]])
            },
            // Two is the shortest a canonical comma has: one anchor and the
            // value. A single operand would be the identity, which the
            // emitter does not write.
            commaOfTwo: () => {
                const shape = assertNotNullish(_shapeOf([',', [1, 2]]), 'expected a shape')
                assertStructurallySame(shape.children, [['anchor', 1], ['result', 2]])
            },
            ternary: () => {
                const shape = assertNotNullish(_shapeOf(['?:', ['a'], 1, 2]), 'expected a shape')
                assertEq(shape.label, '?:')
                assertStructurallySame(shape.children, [['cond', ['a']], ['then', 1], ['else', 2]])
            },
            // `=>` is an Op2 by operand count, so it would draw `left` and
            // `right` like every other tag in that set; it is its own case
            // for the two names that say what a function's operands are. The
            // frame is `null` in everything the compiler emits today.
            lambda: () => {
                const shape = assertNotNullish(_shapeOf(['=>', null, ['args']]), 'expected a shape')
                assertEq(shape.label, '=>')
                assertStructurallySame(shape.children, [['frame', null], ['body', ['args']]])
            },
            // Every Op0 name renders with no children, and the three part
            // by meaning where `Op0Id` groups them by operand count:
            // `undefined` is a constant and draws as the leaf it is, beside
            // `null` and the numbers, where `args` and `frame` are the two
            // places a value enters a scope from outside it and draw as
            // terminals of their own. `frame` is unreachable from the demo's
            // own field — the parser refuses a capture, so no source lowers
            // to one — which is why the tags are built here by hand.
            op0: () => {
                for (const [tag, kind] of [['undefined', 'leaf'], ['args', 'terminal'], ['frame', 'terminal']]) {
                    const shape = assertNotNullish(_shapeOf([tag]), tag)
                    assertEq(shape.label, tag)
                    assertEq(shape.kind, kind)
                    assertStructurallySame(shape.children, [])
                }
            },
            op1: () => {
                for (const tag of ['String', 'Number', '!', '~', 'typeof']) {
                    const shape = assertNotNullish(_shapeOf([tag, ['a']]), tag)
                    assertEq(shape.label, tag)
                    assertStructurallySame(shape.children, [['operand', ['a']]])
                }
            },
            // A sample across Op2's range, not all twenty-one tags: the
            // dispatch is one membership test per group, so one tag from
            // each syntactic corner — comparison, arithmetic, bitwise,
            // logical, and the two named rather than symbolic ones — is
            // what could vary.
            op2: () => {
                for (const tag of ['===', '*', '&', '&&', 'own', 'is']) {
                    const shape = assertNotNullish(_shapeOf([tag, ['a'], ['b']]), tag)
                    assertEq(shape.label, tag)
                    assertStructurallySame(shape.children, [['left', ['a']], ['right', ['b']]])
                }
            },
            op12: {
                unary: () => {
                    const shape = assertNotNullish(_shapeOf(['-', ['a']]), 'expected a shape')
                    assertStructurallySame(shape.children, [['operand', ['a']]])
                },
                binary: () => {
                    const shape = assertNotNullish(_shapeOf(['-', ['a'], ['b']]), 'expected a shape')
                    assertStructurallySame(shape.children, [['left', ['a']], ['right', ['b']]])
                },
            },
            // A tag naming none of the recognized shapes — optional
            // chaining's own, here — is refused the same way a chain
            // continuation is.
            unrecognizedTag: () => assertEq(_shapeOf(['?.', ['a'], 'x']), null),
        },
        // `_shapeOf` refusing a shape does not drop the node: `_walk` still
        // draws it, labeled by its own tag, with no outgoing edges. No
        // source the parser accepts today reaches this — optional chaining
        // does not parse yet — so it needs the same hand-built `Exp` the
        // `shapeOf.unrecognizedTag` test above refuses, carried one level up
        // to where a node is actually built rather than only described.
        walk: {
            unsupported: () => {
                const exp = /** @type {Exp} */ (/** @type {unknown} */ (['?.', ['a'], 'x']))
                const { id, state } = _walk({ refs: [], nodes: [], edges: [], next: 0 })(exp)
                assertEq(id, 0)
                assertStructurallySame(state.nodes, [{ id: 0, kind: 'unsupported', label: '?. (not yet drawn)' }])
                assertStructurallySame(state.edges, [])
            },
        },
        // The initial source is the demo's whole reason for being: `a` is
        // one `+` node reached by three edges, not three nodes that happen
        // to match.
        sharing: () => {
            const html = htmlToString(demo.view(demo.init))
            assertEq(html.split('>+<').length - 1, 1) // one `+` node, however many edges reach it
            assert(html.includes('>0, 1<'), html) // the array's two direct refs, merged
            assert(html.includes('>left<'), html) // a*3's left operand, the third edge to +
        },
        // The same source carries one of every look the drawing has, so a
        // reader meets all three before typing anything: an operator
        // hollow, a constant dashed, a terminal filled. `undefined` is among
        // the constants rather than drawn as the zero-operand operator its
        // `Op0Id` grouping would otherwise make it, and the terminals are
        // two rather than one shared because a node belongs to one scope —
        // the module's `args`, which its import reaches, and the function's
        // own. The `=>` names its operands `frame` and `body`, which is what
        // makes its `null` frame read as the absent one it is.
        kinds: () => {
            const html = htmlToString(demo.view(demo.init))
            assertEq(html.split('data-graph-kind="terminal"').length - 1, 2)
            assertEq(html.split('>args<').length - 1, 2)
            assert(html.includes('>undefined<'), html)
            assert(html.includes('>frame<'), html)
            assert(html.includes('>body<'), html)
        },
        // Arithmetic, comparison, a call and property access, all through
        // real source — the parser accepts this much today.
        realSource: () => {
            const html = htmlToString(demo.view(
                'const a = {x: 1}; const f = a.x; export default [f(2), a.x === 1];'))
            assert(html.includes('>()<'), html)
            assert(html.includes('>.x<'), html)
            assert(html.includes('>===<'), html)
        },
        // A bigint leaf carries its own suffix into the label rather than
        // being coerced like every other leaf `String(exp)` already covers.
        bigintLeaf: () => {
            const html = htmlToString(demo.view('export default 5n;'))
            assert(html.includes('>5n<'), html)
        },
        // An unused const is anchored as a comma's first operand rather
        // than dropped, so the export default is not the whole EDAG.
        /**
         * **The initial source draws a comma**, so a reader meets the two
         * roles before typing anything. `checked` is the one thing the
         * export does not reach, which is what the compiler anchors.
         */
        commaRolesInTheInitialSource: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('>,<'), html)
            assert(html.includes('>anchor<'), html)
            assert(html.includes('>result<'), html)
        },
        commaAnchorsAnUnusedConst: () => {
            const html = htmlToString(demo.view('const unused = 5; export default 1;'))
            assert(html.includes('>,<'), html)
            assert(html.includes('>5<'), html)
            assert(html.includes('>1<'), html)
        },
        // A parse failure is shown, not swallowed, and draws no graph.
        error: () => {
            const html = htmlToString(demo.view('export default {bad'))
            assert(html.includes('Error:'), html)
            assert(!html.includes('<svg'), html)
        },
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'edag', value: '1' })(''), '1')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="edag"'), html)
        },
    },
}
