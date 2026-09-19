/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Denotation } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */
import { _importPath, transpile } from './module.f.mjs'
import { resolve } from '../edag/module.f.mjs'
import { compile } from '../module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(root: Dir) => (path: string) => Result<Denotation, ParseError>} */
const run = root => path => {
    const [, result] = virtual({ ...emptyState, root })(transpile(path))
    return result
}

export const proof = {
    parse: () => {
        const result = run({ a: [utf8('export default 1;')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = unwrap(tryStringify(result[1].value))
        assertEq(s, 'export default 1;')
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: [utf8('import c from "c";\nexport default c;')], c: [utf8('export default 2;')] } })('a/b')
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
    // URL dot processing sees encoded components, not decoded filesystem paths.
    // These invalid components vanish before validation; the same components
    // still fail when they survive, or when `..` cancels only an empty one.
    importPathDotSegments: () => {
        for (const component of ['bad%', '%ff', '%2F', '%2f', '%00', '%5C', '%5c', 'C%3A', '%ED%A0%80']) {
            for (const parent of ['..', '.%2e', '%2E.', '%2e%2E']) {
                const specifier = `./${component}/%2E/${parent}/%64ep.f.js`
                assertEq(_importPath('main.f.js')(specifier), 'dep.f.js', specifier)
            }
            assertEq(_importPath('main.f.js')(`./${component}//../dep.f.js`), null, component)
            assertEq(_importPath('main.f.js')(`./${component}/../${component}/dep.f.js`), null, component)
        }
        assertEq(_importPath('main.f.js')('./bad%/x/../../dep.f.js'), 'dep.f.js')
        assertEq(_importPath('/a/main.f.js')('/bad%/../../dep.f.js'), '/dep.f.js')
        assertEq(_importPath('/a/main.f.js')('/../dep.f.js'), '/dep.f.js')
        assertEq(_importPath('a/main.f.js')('../../dep.f.js'), '../dep.f.js')
        assertEq(_importPath('main.f.js')('./%252e/dep.f.js'), '%2e/dep.f.js')
        assertEq(_importPath('main.f.js')('./%252e%252e/dep.f.js'), '%2e%2e/dep.f.js')
        // Do not confuse a raw drive/separator with percent-encoded data.
        assertEq(_importPath('main.f.js')('./C:/../dep.f.js'), null)
        assertEq(_importPath('main.f.js')('./bad%\\extra/../dep.f.js'), null)
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
    importPathRefusals: () => {
        for (const specifier of [
            './bad%.f.js', './%ff.f.js', './a%2Fb.f.js', './a%5Cb.f.js', './a%00b.f.js',
            './C%3A/x.f.js', './dir/../c%3a/x.f.js', './%43%3a/x.f.js', './C:relative.f.js',
            './name%3Astream.f.js', './%ED%A0%80.f.js', './%ED%B0%80.f.js',
            './dep.f.js?x=%64', './dep.f.js#x=%64', './dep.f.js?', './dep.f.js#',
            './ignored?x=/../dep.f.js', './ignored#x=/../dep.f.js',
        ]) {
            assertEq(_importPath('main.f.js')(specifier), null, specifier)
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
            assertEq(_importPath('main.f.js')(specifier), name)
            assertEq(unwrap(run(root)('main.f.js')).value, 7, specifier)
            assertEq(unwrap(virtual({ ...emptyState, root })(resolve('main.f.js'))[1]), 7, specifier)
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
        for (const specifier of [
            './bad%.f.js', './a%5Cb.f.js', './a%00b.f.js', './C%3A/x.f.js',
            './bad%//../dep.f.js', './bad%/%252e%252e/dep.f.js',
            './dep.f.js?x=%64', './dep.f.js#x=%64', './dep.f.js?', './dep.f.js#',
            './ignored?x=/../dep.f.js', './ignored#x=/../dep.f.js',
        ]) {
            const root = {
                'main.f.js': [utf8(`import a from "./ok.f.js"; import b from "${specifier}"; export default a;`)],
                'ok.f.js': [utf8('export default 1;')],
                'C:': { 'x.f.js': [utf8('export default 2;')] },
                // A suffix must not choose one of these files, even when it exists.
                'dep.f.js': [utf8('export default 2;')],
                'dep.f.js?x=d': [utf8('export default 3;')],
                'dep.f.js#x=d': [utf8('export default 4;')],
                'dep.f.js?': [utf8('export default 5;')],
                'dep.f.js#': [utf8('export default 6;')],
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
        for (const specifier of ['./bad%.f.js', './dep.f.js?x=%64', './dep.f.js#x=%64']) {
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
            a: [utf8('import b from "b";\nimport c from "c";\nexport default [b,c,b];')],
            b: [utf8('import d from "d";\nexport default [0,d];')],
            c: [utf8('import d from "d";\nexport default [1,d];')],
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
        const result = run({ a: [utf8('import b from "b";\nexport default b;')] })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'file not found', result)
    },
    parseWithCycleError: () => {
        const result = run({
            a: [utf8('import b from "b";\nimport c from "c";\nexport default [b,c,b];')],
            b: [utf8('import c from "c";\nexport default c;')],
            c: [utf8('import b from "b";\nexport default b;')],
        })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'circular dependency', result)
    },
}
