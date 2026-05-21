import { sort } from '../../types/object/module.f.ts'
import { transpile } from './module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { virtual, emptyState, type Dir } from '../../types/effects/node/virtual/module.f.ts'
import { encodeUtf8, toVec } from '../../types/uint8array/module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'

const fileVec = (s: string): Vec => toVec(encodeUtf8(s))

const run = (root: Dir) => (path: string) => {
    const [_, result] = virtual({ ...emptyState, root })(transpile(path))
    return result
}

export default {
    parse: () => {
        const result = run({ a: fileVec('export default 1') })('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '1') { throw s }
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: fileVec('import c from "c"\nexport default c'), c: fileVec('export default 2') } })('a/b')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '2') { throw s }
    },
    parseWithSubModules: () => {
        const result = run({
            a: fileVec('import b from "b"\nimport c from "c"\nexport default [b,c,b]'),
            b: fileVec('import d from "d"\nexport default [0,d]'),
            c: fileVec('import d from "d"\nexport default [1,d]'),
            d: fileVec('export default 2'),
        })('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '[[0,2],[1,2],[0,2]]') { throw s }
    },
    parseWithFileNotFoundError: () => {
        const result = run({ a: fileVec('import b from "b"\nexport default b') })('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'file not found') { throw result }
    },
    parseWithCycleError: () => {
        const result = run({
            a: fileVec('import b from "b"\nimport c from "c"\nexport default [b,c,b]'),
            b: fileVec('import c from "c"\nexport default c'),
            c: fileVec('import b from "b"\nexport default b'),
        })('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'circular dependency') { throw result }
    },
}
