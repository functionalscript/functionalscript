/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Denotation } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */
import { _importSources, parse, transpile } from './module.f.mjs'
import { resolve, unresolved } from '../edag/module.f.mjs'
import { compile } from '../module.f.mjs'
import { nodeCommands, exitCode } from '../../effects/node/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
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
        message: `unsupported import specifier "${specifier}": expected ./, ../ or /`,
        metadata: null,
        path: 'main.f.js',
    }])
    assertStructurallySame(graph, value)
}

export const proof = {
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
        const value = unwrap(runner(transpile('entry'))[1]).value
        assert(value instanceof Array)
        assert(value[0] === value[2] && value[0] !== value[1])
        const graph = unwrap(runner(resolve('entry'))[1])
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
            assertEq(unwrap(run(relative)('main.f.js')).value, 7)
            assertEq(unwrap(virtual({ ...emptyState, root: relative })(resolve('main.f.js'))[1]), 7)
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
            { specifier: './dep.f.js', json: false },
            { specifier: '../data.json', json: true },
        ]), ['ok', [{ id: '/dir/dep.f.js', path: '/dir/dep.f.js', json: false }, { id: '/data.json', path: '/data.json', json: true }]])
        // Keep rooted input behavior separate from classifying import text.
        assertStructurallySame(importSources('/main.f.js')([{ specifier: '/dep.f.js', json: false }]), ['ok', [{ id: '/dep.f.js', path: '/dep.f.js', json: false }]])
        for (const specifier of ['', '.', '..', '#alias', 'file:///dep.f.js', 'node:fs', 'https://example.com/dep.f.js']) {
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
            assert(value.value instanceof Array)
            const [a, b, c, d] = value.value
            assert(a === b && b === c && c !== d)
            assert(value.shared)
            const edag = unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1])
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
            assertEq(state.stderr.trim(), 'input.f.js - error: unsupported import specifier "pkg": expected ./, ../ or /')
        }
    },
    // Suffixes affect identity, never the loading filename. Repeated spellings
    // and empty components share; distinct suffixes allocate independently.
    importComponents: () => {
        for (const json of [false, true]) {
            const ext = json ? 'json' : 'f.js'
            const attr = json ? ' with { type: "json" }' : ''
            const root = {
                'main.f.js': [utf8(`import a from "./dep.${ext}?v=1"${attr}; import b from "./%64ep.${ext}?v=1"${attr}; import c from "./dep.${ext}?v=2"${attr}; import d from "./dep.${ext}#copy"${attr}; import e from "./dep.${ext}?"${attr}; import f from "./dep.${ext}#"${attr}; import g from "./dep.${ext}"${attr}; export default [a,b,c,d,e,f,g];`)],
                [`dep.${ext}`]: [utf8(json ? '[7]' : 'export default [7];')],
                [`dep.${ext}?v=1`]: [utf8(json ? '[99]' : 'export default [99];')],
            }
            const value = unwrap(run(root)('main.f.js')).value
            assert(value instanceof Array)
            assertStructurallySame(value, [[7], [7], [7], [7], [7], [7], [7]])
            const [a, b, c, d, e, f, g] = value
            assert(a === b && a !== c && c !== d && d !== e && e === f && f === g)
            const graph = unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1])
            assert(graph instanceof Array && graph[0] === '[]')
            const [ea, eb, ec, ed, ee, ef, eg] = graph[1]
            assert(ea === eb && ea !== ec && ec !== ed && ed !== ee && ee === ef && ef === eg)
        }
    },
    suffixPathValidation: () => {
        for (const suffix of ['?v=1', '#copy', '?x=%64', '#x=%64', '?bad%/a:b#%2F', '#a?b#c']) {
            const specifier = `./dep.f.js${suffix}`
            const root = {
                'main.f.js': [utf8(`import a from "${specifier}"; export default a;`)],
                'dep.f.js': [utf8('export default 7;')],
                'dep.f.js?x=d': [utf8('export default 99;')],
                'dep.f.js#x=d': [utf8('export default 99;')],
            }
            assertEq(unwrap(run(root)('main.f.js')).value, 7)
            assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 7)
            const invalid = importSources('main.f.js')([{ specifier: `./bad%${suffix}`, json: false }])
            assertEq(invalid[0], 'error')
        }
    },
    suffixCannotCancelPath: () => {
        for (const suffix of ['?x=/../dep.f.js', '#x=/../dep.f.js']) {
            const root = {
                'main.f.js': [utf8(`import a from "./ignored${suffix}"; export default a;`)],
                'dep.f.js': [utf8('export default 99;')],
            }
            for (const result of [run(root)('main.f.js'), virtual({ ...emptyState, root })(resolve('main.f.js'))[1]]) {
                assertStructurallySame(result, ['error', { message: 'file not found', metadata: null, path: 'ignored' }])
            }
        }
    },
    suffixCycles: () => {
        const root = {
            'main.f.js': [utf8('import a from "./dep.f.js?v=1"; export default a;')],
            'dep.f.js': [utf8('import a from "./dep.f.js?v=2"; export default a;')],
        }
        for (const result of [run(root)('main.f.js'), virtual({ ...emptyState, root })(resolve('main.f.js'))[1]]) {
            assertStructurallySame(result, ['error', { message: 'circular dependency', metadata: null, path: 'dep.f.js' }])
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
                'main.f.js': [utf8(`import value from "${specifier}?v=1#copy"; export default value;`)],
                [filename]: [utf8('import a from "./dep.f.js"; export default a;')],
                'dep.f.js': [utf8('export default 7;')],
            }
            assertEq(unwrap(run(root)('main.f.js')).value, 7)
            assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 7)
        }
        // CLI entry paths are filesystem names, not import specifiers.
        const root = {
            'main?#copy.f.js': [utf8('import value from "./dep.f.js"; export default value;')],
            'dep.f.js': [utf8('export default 7;')],
        }
        assertEq(unwrap(run(root)('main?#copy.f.js')).value, 7)
        assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main?#copy.f.js'))[1]), 7)
    },
    importComponentsDiagnostic: () => {
        for (const output of ['out.data.js', 'out.edag.data.js', 'out.f.js', 'out.json', 'out.rs']) {
            const root = {
                'input.f.js': [utf8('import a from "./dep.f.js?v=1#copy"; export default a;')],
                'dep.f.js': [utf8('export default 7;')],
            }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', output]))
            assertEq(exitCode(code), 0, state.stderr)
            assert(state.root[output] !== undefined)
            assertEq(state.stderr, '')
            const missing = { 'input.f.js': root['input.f.js'] }
            const [failed, failedCode] = virtual({ ...emptyState, root: missing })(compile(['input.f.js', output]))
            assertEq(exitCode(failedCode), 1)
            assertEq(failed.root[output], undefined)
            assert(failed.stderr.includes('dep.f.js'))
        }
    },
    parse: () => {
        const result = run({ a: [utf8('export default 1;')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default 1;')
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: [utf8('import c from "./c";\nexport default c;')], c: [utf8('export default 2;')] } })('a/b')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default 2;')
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
        assertEq(s, 'export default 1;')
    },
    canceledImportComponents: () => {
        for (const component of ['bad%', '%ff', '%2F', '%00', '%5C', 'C%3A']) {
            for (const parent of ['..', '.%2e', '%2E.', '%2e%2E']) {
                const specifier = `./${component}/${parent}/dep.f.js`
                const root = {
                    'main.f.js': [utf8(`import value from "${specifier}"; export default value;`)],
                    'dep.f.js': [utf8('export default 1;')],
                }
                assertEq(unwrap(run(root)('main.f.js')).value, 1, specifier)
                assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 1, specifier)
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
            assertEq(unwrap(run(root)('main.f.js')).value, 7, specifier)
            assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 7, specifier)
        }
    },
    // A valid dependency before a bad, unused import must not hide the error.
    // These are Result assertions, not "throw" proofs: a leaked panic fails.
    invalidImportResult: () => {
        for (const specifier of [
            './bad%.f.js', './a%5Cb.f.js', './a%00b.f.js', './C%3A/x.f.js',
            './bad%//../dep.f.js', './bad%/%252e%252e/dep.f.js',
        ]) {
            const root = {
                'main.f.js': [utf8(`import a from "./ok.f.js"; import b from "${specifier}"; export default a;`)],
                'ok.f.js': [utf8('export default 1;')],
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
        assertEq(unwrap(run(root)('main.f.js')).value, 1)
        assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 1)
    },
    // Both callers propagate the error through the CLI: exit 1, a diagnostic,
    // no output. A thrown assertion would fail this ordinary (non-throw) proof.
    invalidImportDiagnostic: () => {
        for (const specifier of ['./bad%.f.js', './bad%.f.js?x=%64', './bad%.f.js#x=%64']) {
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
        assertEq(s, 'const $0=[0,2];export default [$0,[1,2],$0];')
    },
    parseWithIdentifierKeys: () => {
        const result = run({ a: [utf8('export default {a:1,b:2};')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"a":1,"b":2};')
    },
    parseWithConstIdentifier: () => {
        const result = run({ a: [utf8('const a = 1;\nconst b = a;\nexport default {x:a,y:b};')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default {"x":1,"y":1};')
    },
    parseWithUnaryMinusOperator: () => {
        const result = run({ a: [utf8('export default [-1,2,-3];')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default [-1,2,-3];')
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
        assertEq(s, 'export default 8080;')
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
