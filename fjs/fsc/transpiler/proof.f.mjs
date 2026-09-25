/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Denotation } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */

import { _importSources, parse, transpile } from './module.f.mjs'
import { _defaultExport, resolve, unresolved } from '../edag/module.f.mjs'
import { _own } from '../ast/module.f.mjs'
import { _errorLocation, compile } from '../module.f.mjs'
import { nodeCommands, exitCode, ioError } from '../../effects/node/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

// The virtual host declares lexical path identities; native URL behavior has host proofs.
/** @type {(path: string) => (imports: readonly import('../ast/types.ts').AstImport[]) => Result<readonly import('./types.ts')._Source[], ParseError>} */
const importSources = path => imports => virtual(emptyState)(_importSources({ id: path, path, json: false })(imports))[1]

/** @type {(root: Dir) => (path: string) => Result<Denotation, ParseError>} */
const run = root => path => {
    const [, result] = virtual({ ...emptyState, root })(transpile(path))
    return result
}

/** Both public compiler paths report the same unsupported-specifier error. @type {(specifier: string, source: string, root: Dir) => void} */
const refusedSpecifier = (specifier, source, root) => {
    const files = { ...root, 'main.f.js': [utf8(source)] }
    const value = run(files)('main.f.js')
    const graph = virtual({ ...emptyState, root: files })(resolve('main.f.js'))[1]
    assertStructurallySame(value, ['error', {
        message: `unsupported import specifier "${specifier}": expected ./, ../, or /`,
        metadata: null,
        path: 'main.f.js',
    }])
    assertStructurallySame(graph, value)
}

export const proof = {
    namedImports: {
        errorOrder: () => {
            for (const [before, name] of [
                ['import {missing} from "./one";', 'missing'],
                ['import missing from "./one";', 'default'],
                ['import {x,missing as alias} from "./one";', 'missing'],
                ['import {} from "./one"; import {missing} from "./one";', 'missing'],
            ]) {
                const root = {
                    main: [utf8(`${before} import {x as later} from "./two"; export default 1;`)],
                    one: [utf8('export const x=undefined;')],
                    two: [utf8('export const x=null.a;')],
                }
                const expected = error({ message: `module has no ${name} export`, metadata: null, path: 'one' })
                assertStructurallySame(run(root)('main'), expected)
                assertStructurallySame(virtual({ ...emptyState, root })(resolve('main'))[1], expected)
                for (const output of ['output.json', 'output.data.js', 'output.f.js', 'output.rs']) {
                    const [state, code] = virtual({ ...emptyState, root })(compile(['main', output]))
                    assertEq(exitCode(code), 1)
                    assertEq(state.stderr.trim(), `one - error: module has no ${name} export`)
                    assertEq(state.root[output], undefined)
                }
            }
        },
        values: () => {
            for (const [source, expected] of /** @type {const} */ ([
                ['import {a} from "./dep"; export default a;', [5]],
                ['import d,{a as x,u,default as z} from "./dep"; export default [d,x,u,z];', [7,[5],undefined,7]],
                ['import {u} from "./dep"; export default u;', undefined],
                ['import {} from "./dep"; export default 1;', 1],
                ['import {__proto__ as p,constructor as c} from "./dep"; export default [p,c];', [8,9]],
            ])) {
                const root = { 'main': [utf8(source)], 'dep': [utf8('export const a=[5]; export const u=undefined; export const __proto__=8; export const constructor=9; export default 7;')] }
                assertStructurallySame(_own(unwrap(run(root)('main')).value, 'default'), expected)
            }
            const root = { 'main': [utf8('import {a} from "./dep"; import {a as b} from "./dep"; export default [a,b];')], 'dep': [utf8('export const a=[];')] }
            const result = unwrap(run(root)('main'))
            const pair = _own(result.value, 'default')
            assert(pair instanceof Array && pair[0] === pair[1])
            assert(result.shared)
        },
        sharing: () => {
            // Different selected roots can still contain the same descendant.
            const overlap = {
                main: [utf8('import {a,b} from "./dep"; export default [a.x,b.y];')],
                dep: [utf8('const shared=[]; export const a={x:shared}; export const b={y:shared};')],
            }
            const overlapResult = unwrap(run(overlap)('main'))
            const descendants = _own(overlapResult.value, 'default')
            assert(descendants instanceof Array && descendants[0] === descendants[1])
            assert(overlapResult.shared)
            const [state, code] = virtual({ ...emptyState, root: overlap })(compile(['main', 'output.json']))
            assertEq(exitCode(code), 1)
            assertEq(state.root['output.json'], undefined)
            // An unused leaf import must not overwrite the reached export's sharing facts.
            const dep = [utf8('const x=[]; export const shared=[x,x]; export const leaf=1;')]
            for (const source of [
                'import {shared,leaf} from "./dep"; export default shared;',
                'import {leaf,shared} from "./dep"; export default shared;',
            ]) { assert(unwrap(run({ main: [utf8(source)], dep })('main')).shared) }
            const selectedLeaf = 'import {shared,leaf} from "./dep"; export default leaf;'
            assertEq(unwrap(run({ main: [utf8(selectedLeaf)], dep })('main')).shared, false)
            const diamond = {
                main: [utf8('import {a} from "./left"; import {b} from "./right"; export default [a,b];')],
                left: [utf8('import {x} from "./dep"; export const a=x;')],
                right: [utf8('import {x as y} from "./dep"; export const b=y;')],
                dep: [utf8('export const x=[];')],
            }
            const result = unwrap(run(diamond)('main'))
            const pair = _own(result.value, 'default')
            assert(pair instanceof Array && pair[0] === pair[1])
            assert(result.shared)
        },
        refusals: () => {
            for (const source of [
                'import {missing} from "./dep"; export default 1;',
                'import {toString as x} from "./dep"; export default 1;',
                'import {constructor as x} from "./dep"; export default 1;',
                'import {__proto__ as x} from "./dep"; export default 1;',
                'import d,{missing} from "./dep"; export default d;',
            ]) {
                const root = { main: [utf8(source)], dep: [utf8('export const a=1; export default undefined;')] }
                const value = run(root)('main')
                assertEq(value[0], 'error')
                assertStructurallySame(virtual({ ...emptyState, root })(resolve('main'))[1], value)
            }
            for (const source of ['import {a} from "./dep";', 'import {} from "./dep";']) {
                const root = { main: [utf8(`${source} export default 1;`)], dep: [utf8('export const a=1; export const bad=null.x;')] }
                assertEq(run(root)('main')[0], 'error')
                assertEq(run({ main: root.main })('main')[0], 'error')
                assertEq(run({ ...root, dep: [utf8('import {} from "./main"; export const a=1;')] })('main')[0], 'error')
            }
        },
        json: () => {
            const root = { main: [utf8('import {default as data} from "./data.json" with {type:"json"}; export default data;')], 'data.json': [utf8('{"x":7}')] }
            assertStructurallySame(unwrap(run(root)('main')).value, { default: { x: 7 } })
            for (const source of [
                'import {x} from "./data.json" with {type:"json"};',
                'import {default as data} from "./data.json";',
                'import {} from "./data.json";',
                'import {} from "./dep" with {type:"json"};',
            ]) {
                const files = { ...root, main: [utf8(`${source} export default 1;`)], dep: [utf8('export const x=1;')] }
                const value = run(files)('main')
                assertEq(value[0], 'error')
                assertStructurallySame(virtual({ ...emptyState, root: files })(resolve('main'))[1], value)
            }
        },
    },
    moduleResult: () => {
        for (const [source, expected] of [
            ['export default 7;', { default: 7 }],
            ['export default { a: 5 };', { default: { a: 5 } }],
            ['export default undefined;', { default: undefined }],
        ]) {
            assert(typeof source === 'string')
            const root = { 'main.f.js': [utf8(source)] }
            assertStructurallySame(unwrap(run(root)('main.f.js')).value, expected)
            const imported = { ...root, 'entry.f.js': [utf8('import x from "./main.f.js"; export default x;')] }
            assertStructurallySame(unwrap(run(imported)('entry.f.js')).value, expected)
        }
    },
    // The resolver's identity may differ from the read path in both directions:
    // one identity under two spellings, and two identities at one location.
    hostIdentities: () => {
        /** @type {import('../../effects/mock/types.ts').MemOperationMap<import('../../effects/node/types.ts').ReadFile | import('../../effects/node/types.ts').ResolveFileModule, null>} */
        const host = {
            resolveFileModule: (name, parent) => state => {
                if (parent === null) {
                    assertEq(name, 'entry')
                    return [state, ok({ id: 'file:///logical/main.mjs', path: 'physical/main' })]
                }
                assertEq(parent, 'file:///logical/main.mjs')
                assert(['./one.mjs', './two.mjs', './%6fne.mjs'].includes(name))
                return [state, ok({
                    id: name === './two.mjs' ? 'file:///logical/two.mjs' : 'file:///logical/one.mjs',
                    path: 'physical/shared',
                })]
            },
            readFile: path => state => {
                assert(['physical/main', 'physical/shared'].includes(path))
                return [state, ok(utf8(path === 'physical/main'
                    ? 'import a from "./one.mjs"; import b from "./two.mjs"; import c from "./%6fne.mjs"; export default [a, b, c];'
                    : 'export default [7];'))]
            },
        }
        const runner = partialRun(nodeCommands)(host)(null)
        const value = _own(unwrap(runner(transpile('entry'))[1]).value, 'default')
        assert(value instanceof Array)
        assert(value[0] === value[2] && value[0] !== value[1])
        const graph = _defaultExport(unwrap(runner(resolve('entry'))[1]))
        assert(graph instanceof Array && graph[0] === '[]')
        assert(graph[1][0] === graph[1][2] && graph[1][0] !== graph[1][1])
    },
    rootJsonAlias: () => {
        /** @type {import('../../effects/mock/types.ts').MemOperationMap<import('../../effects/node/types.ts').ReadFile | import('../../effects/node/types.ts').ResolveFileModule, null>} */
        const host = {
            resolveFileModule: (name, parent) => state => {
                assertEq(name, 'input.json')
                assertEq(parent, null)
                return [state, ok({ id: 'file:///real/data', path: 'real/data' })]
            },
            readFile: path => state => {
                assertEq(path, 'real/data')
                return [state, ok(utf8('[1,2]'))]
            },
        }
        const runner = partialRun(nodeCommands)(host)(null)
        assertStructurallySame(unwrap(runner(transpile('input.json'))[1]).value, [1, 2])
        assertStructurallySame(unwrap(runner(resolve('input.json'))[1]), ['[]', [1, 2]])
    },
    missingResolver: () => {
        const runner = partialRun(nodeCommands)({})(null)
        const value = runner(transpile('entry'))[1]
        assertStructurallySame(value, ['error', {
            message: 'module resolution failed: operation not implemented: resolveFileModule',
            metadata: null, path: 'entry',
        }])
        assertStructurallySame(runner(resolve('entry'))[1], value)
    },
    // Once resolved, a diagnostic names the host's loading path, including
    // syntax positions and cycles. A root that cannot resolve still names the
    // caller's input; an unresolved dependency names its resolved importer.
    hostDiagnosticPaths: () => {
        const imports = 'import value from "./dep.f.js"; export default value;'
        const root = { id: 'file:///real/main.f.js', path: '/real/main.f.js' }
        /** @type {readonly (readonly [string | null, string | null, string, string])[]} */
        const cases = [
            [null, null, 'main.f.js', 'module resolution failed: missing module'],
            [imports, null, '/real/main.f.js', 'module resolution failed: missing module'],
            ['export default [;', null, '/real/main.f.js:1:17', 'unexpected token'],
            [imports, 'export default [;', '/real/dep.f.js:1:17', 'unexpected token'],
            ['import value from "./%6dain.f.js"; export default value;', null, '/real/main.f.js', 'circular dependency'],
            ['import a from "./data.json" with { type: "json" }; import b from "./%64ata.json"; export default a;', '[[7]]', '/real/data.json', 'a JSON module needs the import attribute with { type: "json" }'],
        ]
        for (const [main, dependency, location, message] of cases) {
            /** @type {import('../../effects/mock/types.ts').PartialMemOperationMap<import('../types.ts')._CompileOp, string>} */
            const host = {
                resolveFileModule: (name, parent) => state => {
                    if (parent === null) {
                        assertEq(name, 'main.f.js')
                        return [state, main === null ? error(ioError({ message: 'missing module' })) : ok(root)]
                    }
                    assertEq(parent, root.id)
                    if (name === './%6dain.f.js') { return [state, ok(root)] }
                    if (name === './data.json' || name === './%64ata.json') {
                        return [state, ok({ id: 'file:///real/data.json', path: '/real/data.json' })]
                    }
                    assertEq(name, './dep.f.js')
                    return [state, dependency === null ? error(ioError({ message: 'missing module' }))
                        : ok({ id: 'file:///real/dep.f.js', path: '/real/dep.f.js' })]
                },
                readFile: path => state => {
                    assert([root.path, '/real/dep.f.js', '/real/data.json'].includes(path))
                    const source = path === root.path ? main : dependency
                    assert(source !== null)
                    return [state, ok(utf8(source))]
                },
                write: (stream, data) => state => {
                    assertEq(stream, 'stderr')
                    return [state + utf8ToString(data), ok(undefined)]
                },
                writeFile: () => state => {
                    assert(false, 'a failed compilation must not write output')
                    return [state, ok(undefined)]
                },
            }
            const runner = partialRun(nodeCommands)(host)('')
            for (const result of [runner(transpile('main.f.js'))[1], runner(resolve('main.f.js'))[1]]) {
                assert(result[0] === 'error')
                assertEq(_errorLocation('main.f.js')(result[1]), location)
                assertEq(result[1].message, message)
            }
            for (const output of ['out.data.js', 'out.edag.data.js']) {
                const [stderr, result] = runner(compile(['main.f.js', output]))
                assertEq(exitCode(result), 1)
                assertEq(stderr.trim(), `${location} - error: ${message}`)
            }
        }
    },
    // The literal local targets exist: these must be refusals, not fallback
    // loads or accidental file-not-found errors. Prefixing ./ is the control.
    bareImports: () => {
        const file = [utf8('export default 7;')]
        /** @type {readonly (readonly [string, Dir])[]} */
        const cases = [
            ['pkg', { pkg: file }],
            ['pkg/submodule', { pkg: { submodule: file } }],
            ['@scope/pkg', { '@scope': { pkg: file } }],
            ['@scope/pkg/submodule', { '@scope': { pkg: { submodule: file } } }],
            ['.hidden', { '.hidden': file }],
            ['..hidden', { '..hidden': file }],
            ['pkg/../dep.f.js', { 'dep.f.js': file }],
            ['%2e/dep.f.js', { 'dep.f.js': file }],
        ]
        for (const [specifier, root] of cases) {
            const source = `import value from "${specifier}"; export default value;`
            // Grammar recognition and unresolved compilation still retain the
            // original specifier. Refusal belongs to dependency resolution.
            const module = unresolved(unwrap(parse('main.f.js')(source)))
            assertEq(module.imports[0].specifier, specifier)
            refusedSpecifier(specifier, source, root)
            const relative = { ...root, 'main.f.js': [utf8(`import value from "./${specifier}"; export default value;`)] }
            assertStructurallySame(unwrap(run(relative)('main.f.js')).value, { default: 7 })
            assertStructurallySame(unwrap(virtual({ ...emptyState, root: relative })(resolve('main.f.js'))[1]), ['{}', [[':', 'default', 7]]])
        }
    },
    bareUnusedAndRepeated: () => {
        const root = { pkg: [utf8('export default 7;')] }
        refusedSpecifier('pkg', 'import value from "pkg"; export default 1;', root)
        refusedSpecifier('pkg', 'import a from "./pkg"; import b from "pkg"; export default a;', root)
        refusedSpecifier('pkg.json', 'import value from "pkg.json" with { type: "json" }; export default value;', { 'pkg.json': [utf8('7')] })
    },
    importSources: () => {
        assertStructurallySame(importSources('main.f.js')([]), ['ok', []])
        assertStructurallySame(importSources('/dir/main.f.js')([
            { specifier: './dep.f.js', json: false, name: 'default' },
            { specifier: '../data.json', json: true, name: 'default' },
        ]), ['ok', [{ id: '/dir/dep.f.js', path: '/dir/dep.f.js', json: false, name: 'default' }, { id: '/data.json', path: '/data.json', json: true, name: 'default' }]])
        // Keep rooted input behavior separate from classifying import text.
        assertStructurallySame(importSources('/main.f.js')([{ specifier: '/dep.f.js', json: false, name: 'default' }]), ['ok', [{ id: '/dep.f.js', path: '/dep.f.js', json: false, name: 'default' }]])
        for (const specifier of ['', '.', '..', '#alias', 'file:relative.mjs', 'file:///dep.f.js', 'FILE:/dep.f.js', 'node:fs', 'https://example.com/dep.f.js']) {
            refusedSpecifier(specifier, `import value from "${specifier}"; export default value;`, {})
        }
    },
    // A diamond and a direct escaped spelling share one module allocation;
    // another file with identical source remains distinct. Cover JSON too.
    moduleSharing: () => {
        for (const json of [false, true]) {
            const extension = json ? 'json' : 'f.js'
            const attribute = json ? ' with { type: "json" }' : ''
            const content = utf8(json ? '[42]' : 'export default [42];')
            const root = {
                'main.f.js': [utf8(`import a from "./left.f.js"; import b from "./right.f.js"; import c from "./%64ep.${extension}"${attribute}; import d from "./other.${extension}"${attribute}; export default [a, b, c, d];`)],
                'left.f.js': [utf8(`import d from "./dep.${extension}"${attribute}; export default d;`)],
                'right.f.js': [utf8(`import d from "./unused/../%64ep.${extension}"${attribute}; export default d;`)],
                [`dep.${extension}`]: [content],
                [`other.${extension}`]: [content],
            }
            const value = unwrap(run(root)('main.f.js'))
            const selected = _own(value.value, 'default')
            assert(selected instanceof Array)
            const [a, b, c, d] = selected
            assert(a === b && b === c && c !== d)
            assert(value.shared)
            const edag = _defaultExport(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]))
            assert(edag instanceof Array && edag[0] === '[]')
            const [ea, eb, ec, ed] = edag[1]
            assert(ea === eb && eb === ec && ec !== ed)
        }
    },
    moduleCycleDiagnostic: () => {
        const root = {
            'main.f.js': [utf8('import d from "./dir/dep.f.js"; export default d;')],
            dir: { 'dep.f.js': [utf8('import m from "../%6dain.f.js"; export default m;')] },
        }
        for (const result of [run(root)('main.f.js'), virtual({ ...emptyState, root })(resolve('main.f.js'))[1]]) {
            assertStructurallySame(result, ['error', { message: 'circular dependency', metadata: null, path: 'main.f.js' }])
        }
    },
    bareImportDiagnostic: () => {
        for (const output of ['out.data.js', 'out.edag.data.js', 'out.f.js', 'out.json', 'out.rs']) {
            const root = {
                'input.f.js': [utf8('import value from "pkg"; export default value;')],
                pkg: [utf8('export default 7;')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', output]))
            assertEq(exitCode(code), 1, state.stderr)
            assertEq(state.root[output], undefined)
            assertEq(state.stderr.trim(), 'input.f.js - error: unsupported import specifier "pkg": expected ./, ../, or /')
        }
    },
    escapedImportComponents: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['./dep%3Fcopy.f.js', 'dep?copy.f.js'],
            ['./dep%3fcopy.f.js', 'dep?copy.f.js'],
            ['./dep%23copy.f.js', 'dep#copy.f.js'],
            ['./dep%3F%23copy.f.js', 'dep?#copy.f.js'],
            ['./dep%253Fcopy.f.js', 'dep%3Fcopy.f.js'],
            ['./dep%2523copy.f.js', 'dep%23copy.f.js'],
        ]
        for (const [specifier, filename] of cases) {
            const root = {
                'main.f.js': [utf8(`import value from "${specifier}"; export default value;`)],
                [filename]: [utf8('import a from "./dep.f.js"; export default a;')],
                'dep.f.js': [utf8('export default 7;')],
            }
            assertStructurallySame(unwrap(run(root)('main.f.js')).value, { default: 7 })
            assertStructurallySame(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), ['{}', [[':', 'default', 7]]])
        }
        // CLI entry paths are filesystem names, not import specifiers.
        const root = {
            'main?#copy.f.js': [utf8('import value from "./dep.f.js"; export default value;')],
            'dep.f.js': [utf8('export default 7;')],
        }
        assertStructurallySame(unwrap(run(root)('main?#copy.f.js')).value, { default: 7 })
        assertStructurallySame(unwrap(virtual({ ...emptyState, root })(resolve('main?#copy.f.js'))[1]), ['{}', [[':', 'default', 7]]])
    },
    parse: () => {
        const result = run({ a: [utf8('export default 1;')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":1};')
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: [utf8('import c from "./c";\nexport default c;')], c: [utf8('export default 2;')] } })('a/b')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":2};')
    },
    // Module specifiers are URL-path spellings, not literal filesystem names:
    // Node resolves %64 to "d" before loading, so the literal %64ep file must
    // not win merely because it exists beside dep.
    parseWithPercentEscapedImport: () => {
        const result = run({
            'main.f.js': [utf8('import value from "./%64ep.f.js";\nexport default value;')],
            'dep.f.js': [utf8('export default 1;')],
            '%64ep.f.js': [utf8('export default 2;')],
        })('main.f.js')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":1};')
    },
    canceledImportComponents: () => {
        for (const component of ['bad%', '%ff', '%2F', '%00', '%5C', 'C%3A']) {
            for (const parent of ['..', '.%2e', '%2E.', '%2e%2E']) {
                const specifier = `./${component}/${parent}/dep.f.js`
                const root = {
                    'main.f.js': [utf8(`import value from "${specifier}"; export default value;`)],
                    'dep.f.js': [utf8('export default 1;')],
                }
                assertStructurallySame(unwrap(run(root)('main.f.js')).value, { default: 1 }, specifier)
                assertStructurallySame(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), ['{}', [[':', 'default', 1]]], specifier)
            }
        }
    },
    // Escaped URL delimiters are filename data, not query/fragment syntax.
    // A literal percent sign in a filename must itself be escaped, once.
    importEncodedFilenameSyntax: () => {
        for (const [specifier, name] of [
            ['./name%3Fpart.f.js', 'name?part.f.js'],
            ['./name%23part.f.js', 'name#part.f.js'],
            ['./name%3f%23.f.js', 'name?#.f.js'],
            ['./%2564ep.f.js', '%64ep.f.js'],
            ['./name%253F.f.js', 'name%3F.f.js'],
            ['./name%2523.f.js', 'name%23.f.js'],
        ]) {
            const root = {
                'main.f.js': [utf8(`import value from "${specifier}"; export default value;`)],
                [name]: [utf8('export default 7;')],
            }
            assertStructurallySame(unwrap(run(root)('main.f.js')).value, { default: 7 }, specifier)
            assertStructurallySame(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), ['{}', [[':', 'default', 7]]], specifier)
        }
    },
    // A valid dependency before a bad, unused import must not hide the error.
    // These are Result assertions, not "throw" proofs: a leaked panic fails.
    invalidImportResult: () => {
        for (const specifier of [
            './bad%.f.js', './a%5Cb.f.js', './a%00b.f.js', './C%3A/x.f.js',
            './bad%//../dep.f.js', './bad%/%252e%252e/dep.f.js',
            './ok.f.js?v=1', './ok.f.js#copy',
        ]) {
            const root = {
                'main.f.js': [utf8(`import a from "./ok.f.js"; import b from "${specifier}"; export default a;`)],
                'ok.f.js': [utf8('export default 1;')],
                'ok.f.js?v=1': [utf8('export default 99;')],
                'ok.f.js#copy': [utf8('export default 99;')],
                'C:': { 'x.f.js': [utf8('export default 2;')] },
            }
            const value = run(root)('main.f.js')
            const edag = virtual({ ...emptyState, root })(resolve('main.f.js'))[1]
            for (const result of [value, edag]) {
                assert(result[0] === 'error', result)
                assertEq(result[1].message, `invalid module specifier: ${specifier}`)
                assertEq(result[1].path, 'main.f.js')
            }
        }
    },
    importSurrogateFilename: () => {
        const root = {
            'main.f.js': [utf8('import value from "./\\ud800%20.f.js"; export default value;')],
            '\ufffd .f.js': [utf8('export default 1;')],
        }
        assertStructurallySame(unwrap(run(root)('main.f.js')).value, { default: 1 })
        assertStructurallySame(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), ['{}', [[':', 'default', 1]]])
    },
    // Both callers propagate the error through the CLI: exit 1, a diagnostic,
    // no output. A thrown assertion would fail this ordinary (non-throw) proof.
    invalidImportDiagnostic: () => {
        for (const specifier of ['./bad%.f.js', './dep.f.js?v=1', './dep.f.js#copy']) {
            for (const output of ['out.data.js', 'out.edag.data.js', 'out.f.js', 'out.json', 'out.rs']) {
                const root = { 'input.f.js': [utf8(`import value from "${specifier}"; export default value;`)] }
                const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', output]))
                assertEq(exitCode(code), 1, state.stderr)
                assertEq(state.root[output], undefined)
                assertEq(state.stderr.trim(), `input.f.js - error: invalid module specifier: ${specifier}`)
            }
        }
    },
    parseWithSubModules: () => {
        const result = run({
            a: [utf8('import b from "./b";\nimport c from "./c";\nexport default [b,c,b];')],
            b: [utf8('import d from "./d";\nexport default [0,d];')],
            c: [utf8('import d from "./d";\nexport default [1,d];')],
            d: [utf8('export default 2;')],
        })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'const $0=[0,2];export default {"default":[$0,[1,2],$0]};')
    },
    parseWithIdentifierKeys: () => {
        const result = run({ a: [utf8('export default {a:1,b:2};')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":{"a":1,"b":2}};')
    },
    parseWithConstIdentifier: () => {
        const result = run({ a: [utf8('const a = 1;\nconst b = a;\nexport default {x:a,y:b};')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":{"x":1,"y":1}};')
    },
    parseWithUnaryMinusOperator: () => {
        const result = run({ a: [utf8('export default [-1,2,-3];')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":[-1,2,-3]};')
    },
    // A module named by an absolute path resolves its imports: `transpile`
    // reaches them through `concat(concat(path)('..'))(importPath)`, which
    // used to drop the leading `/` and look the import up under the current
    // directory instead. Here the import also names `..` from the root, so
    // the answer depends on the root surviving both calls.
    parseAbsolutePath: () => {
        const result = run({
            'lib.f.js': [utf8('export default 8080;')],
            'm.f.js': [utf8('import p from "../lib.f.js";\nexport default p;')],
        })('/m.f.js')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"default":8080};')
    },
    // The control: with no root to clamp it, the same `..` escapes and finds
    // nothing — which is why the case above is about the root and not about
    // `..` being ignored.
    parseRelativePathEscapesRoot: () => {
        const result = run({
            'lib.f.js': [utf8('export default 8080;')],
            'm.f.js': [utf8('import p from "../lib.f.js";\nexport default p;')],
        })('m.f.js')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'file not found', result)
    },
    parseWithFileNotFoundError: () => {
        const result = run({ a: [utf8('import b from "./b";\nexport default b;')] })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'file not found', result)
    },
    parseWithCycleError: () => {
        const result = run({
            a: [utf8('import b from "./b";\nimport c from "./c";\nexport default [b,c,b];')],
            b: [utf8('import c from "./c";\nexport default c;')],
            c: [utf8('import b from "./b";\nexport default b;')],
        })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'circular dependency', result)
    },
}
