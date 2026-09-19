/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Denotation } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */
import { _importPath, transpile } from './module.f.mjs'
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
    // Validate the decoded characters, not overescaped string spellings.
    importPath: () => {
        assertEq(_importPath('main.f.js')('./%64ep.f.js'), 'dep.f.js')
        // A literal percent sign is decoded once, not recursively.
        assertEq(_importPath('main.f.js')('./%255C.f.js'), '%5C.f.js')
    },
    throw: {
        malformedImport: () => _importPath('main.f.js')('./bad%.f.js'),
        invalidUtf8Import: () => _importPath('main.f.js')('./%ff.f.js'),
        escapedSlashImport: () => _importPath('main.f.js')('./a%2Fb.f.js'),
        escapedBackslashImport: () => _importPath('main.f.js')('./a%5Cb.f.js'),
        nulImport: () => _importPath('main.f.js')('./a%00b.f.js'),
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
