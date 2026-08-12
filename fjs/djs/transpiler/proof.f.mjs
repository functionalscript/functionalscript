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
