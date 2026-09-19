/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Denotation } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */
import { _importPath, _importSources, parse, transpile } from './module.f.mjs'
import { resolve, unresolved } from '../edag/module.f.mjs'
import { compile } from '../module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

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

/** Query/fragment refusal goes through the normal error channel in both compilers. @type {(specifier: string, source: string, root: Dir) => void} */
const refusedComponents = (specifier, source, root) => {
    const files = { ...root, 'main.f.js': [utf8(source)] }
    const value = run(files)('main.f.js')
    const graph = virtual({ ...emptyState, root: files })(resolve('main.f.js'))[1]
    assertStructurallySame(value, ['error', {
        message: `unsupported import specifier "${specifier}": query and fragment components are not supported`,
        metadata: null,
        path: 'main.f.js',
    }])
    assertStructurallySame(graph, value)
}

export const proof = {
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
        assertStructurallySame(_importSources('main.f.js')([]), ['ok', []])
        assertStructurallySame(_importSources('/dir/main.f.js')([
            { specifier: './dep.f.js', json: false },
            { specifier: '../data.json', json: true },
        ]), ['ok', [{ id: '/dir/dep.f.js', path: '/dir/dep.f.js', json: false }, { id: '/data.json', path: '/data.json', json: true }]])
        // Keep rooted input behavior separate from classifying import text.
        assertStructurallySame(_importSources('/main.f.js')([{ specifier: '/dep.f.js', json: false }]), ['ok', [{ id: '/dep.f.js', path: '/dep.f.js', json: false }]])
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
    // Neither a literal suffix-bearing filename nor its stripped counterpart
    // may be loaded. These are valid JS imports, not parser errors.
    importComponents: () => {
        for (const suffix of ['?v=1', '#copy', '?', '#', '?v=1#copy', '?bad%', '#bad%']) {
            const specifier = `./dep.f.js${suffix}`
            const source = `import value from "${specifier}"; export default value;`
            const module = unresolved(unwrap(parse('main.f.js')(source)))
            assertEq(module.imports[0].specifier, specifier)
            refusedComponents(specifier, source, {
                'dep.f.js': [utf8('export default 1;')],
                [`dep.f.js${suffix}`]: [utf8('export default 2;')],
            })
        }
    },
    unusedImportComponents: () => {
        for (const suffix of ['?v=1', '#copy']) {
            const specifier = `./dep.f.js${suffix}`
            // Even a valid earlier import or an unused binding cannot bypass
            // the check. It precedes dependency loading and attribute checks.
            refusedComponents(specifier, `import a from "./dep.f.js"; import b from "${specifier}"; export default a;`, {
                'dep.f.js': [utf8('export default 1;')],
                [`dep.f.js${suffix}`]: [utf8('export default 2;')],
            })
            refusedComponents(specifier, `import a from "./missing.f.js"; import b from "${specifier}"; export default 1;`, {})
            refusedComponents(`./data.json${suffix}`, `import a from "./data.json${suffix}" with { type: "json" }; export default a;`, {})
        }
        // JavaScript string escapes are already decoded by the parser; this
        // restriction is on the specifier's value, not its source spelling.
        refusedComponents('./dep?copy.f.js', 'import a from "./dep\\u003fcopy.f.js"; export default a;', {})
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
                [filename]: [utf8('export default 7;')],
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
        for (const suffix of ['?v=1', '#copy']) {
            for (const output of ['out.data.js', 'out.edag.data.js', 'out.f.js', 'out.json', 'out.rs']) {
                const specifier = `./dep.f.js${suffix}`
                const root = {
                    'input.f.js': [utf8(`import value from "${specifier}"; export default value;`)],
                    [`dep.f.js${suffix}`]: [utf8('export default 7;')],
                }
                const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', output]))
                assertEq(exitCode(code), 1, state.stderr)
                assertEq(state.root[output], undefined)
                assertEq(state.stderr.trim(), `input.f.js - error: unsupported import specifier "${specifier}": query and fragment components are not supported`)
            }
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
    // Only the specifier is decoded, once; the importer's filesystem root stays put.
    importPath: () => {
        assertEq(_importPath('main.f.js')('./%64ep.f.js'), 'dep.f.js')
        assertEq(_importPath('C:/repo/main.f.js')('./%64ep.f.js'), 'C:/repo/dep.f.js')
        assertEq(_importPath('dir%25/main.f.js')('./dep.f.js'), 'dir%25/dep.f.js')
        assertEq(_importPath('main.f.js')('./%255C.f.js'), '%5C.f.js')
        assertEq(_importPath('main.f.js')('./%253A.f.js'), '%3A.f.js')
    },
    importPathRefusals: () => {
        for (const specifier of [
            './bad%.f.js', './%ff.f.js', './a%2Fb.f.js', './a%5Cb.f.js', './a%00b.f.js',
            './C%3A/x.f.js', './dir/../c%3a/x.f.js', './%43%3a/x.f.js', './C:relative.f.js',
            './name%3Astream.f.js', './%ED%A0%80.f.js', './%ED%B0%80.f.js',
        ]) {
            assertEq(_importPath('main.f.js')(specifier), null, specifier)
        }
    },
    // Native URL input is a scalar-value string. Do not apply that replacement
    // to percent-encoded UTF-8: the ED A0 80 case above must still fail.
    importPathSurrogates: () => {
        assertEq(_importPath('main.f.js')('./\ud800.f.js'), '\ufffd.f.js')
        assertEq(_importPath('main.f.js')('./\udc00.f.js'), '\ufffd.f.js')
        assertEq(_importPath('main.f.js')('./\ud800%20.f.js'), '\ufffd .f.js')
        assertEq(_importPath('main.f.js')('./%61\udc00.f.js'), 'a\ufffd.f.js')
        assertEq(_importPath('main.f.js')('./\ud83d\ude00.f.js'), '\ud83d\ude00.f.js')
    },
    // A valid dependency before a bad, unused import must not hide the error.
    // These are Result assertions, not "throw" proofs: a leaked panic fails.
    invalidImportResult: () => {
        for (const specifier of ['./bad%.f.js', './a%5Cb.f.js', './a%00b.f.js', './C%3A/x.f.js']) {
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
        for (const output of ['out.data.js', 'out.edag.data.js', 'out.f.js', 'out.json', 'out.rs']) {
            const root = { 'input.f.js': [utf8('import value from "./bad%.f.js"; export default value;')] }
            const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', output]))
            assertEq(exitCode(code), 1, state.stderr)
            assertEq(state.root[output], undefined)
            assertEq(state.stderr.trim(), 'input.f.js - error: invalid module specifier: ./bad%.f.js')
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
