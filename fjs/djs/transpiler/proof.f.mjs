/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unknown } from '../types.ts'
 * @import { ParseError } from '../parser/types.ts'
 */
import { sort } from '../../types/object/module.f.mjs'
import { transpile } from './module.f.mjs'
import { stringifyAsTree } from '../serializer/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(root: Dir) => (path: string) => Result<Unknown, ParseError>} */
const run = root => path => {
    const [, result] = virtual({ ...emptyState, root })(transpile(path))
    return result
}

export const proof = {
    parse: () => {
        const result = run({ a: [utf8('export default 1')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '1')
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: [utf8('import c from "c"\nexport default c')], c: [utf8('export default 2')] } })('a/b')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '2')
    },
    parseWithSubModules: () => {
        const result = run({
            a: [utf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]')],
            b: [utf8('import d from "d"\nexport default [0,d]')],
            c: [utf8('import d from "d"\nexport default [1,d]')],
            d: [utf8('export default 2')],
        })('a')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '[[0,2],[1,2],[0,2]]')
    },
    parseWithIdentifierKeys: () => {
        const result = run({ a: [utf8('export default {a:1,b:2}')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '{"a":1,"b":2}')
    },
    parseWithConstIdentifier: () => {
        const result = run({ a: [utf8('const a = 1\nconst b = a\nexport default {x:a,y:b}')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '{"x":1,"y":1}')
    },
    parseWithUnaryMinusOperator: () => {
        const result = run({ a: [utf8('export default [-1,2,-3]')] })('a')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '[-1,2,-3]')
    },
    // A module named by an absolute path resolves its imports: `transpile`
    // reaches them through `concat(concat(path)('..'))(importPath)`, which
    // used to drop the leading `/` and look the import up under the current
    // directory instead. Here the import also names `..` from the root, so
    // the answer depends on the root surviving both calls.
    parseAbsolutePath: () => {
        const result = run({
            'lib.f.js': [utf8('export default 8080')],
            'm.f.js': [utf8('import p from "../lib.f.js"\nexport default p')],
        })('/m.f.js')
        assert(result[0] !== 'error', result[1])
        const s = stringifyAsTree(sort)(result[1])
        assertEq(s, '8080')
    },
    // The control: with no root to clamp it, the same `..` escapes and finds
    // nothing — which is why the case above is about the root and not about
    // `..` being ignored.
    parseRelativePathEscapesRoot: () => {
        const result = run({
            'lib.f.js': [utf8('export default 8080')],
            'm.f.js': [utf8('import p from "../lib.f.js"\nexport default p')],
        })('m.f.js')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'file not found', result)
    },
    parseWithFileNotFoundError: () => {
        const result = run({ a: [utf8('import b from "b"\nexport default b')] })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'file not found', result)
    },
    parseWithCycleError: () => {
        const result = run({
            a: [utf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]')],
            b: [utf8('import c from "c"\nexport default c')],
            c: [utf8('import b from "b"\nexport default b')],
        })('a')
        assert(result[0] === 'error', result)
        assertEq(result[1].message, 'circular dependency', result)
    },
}
