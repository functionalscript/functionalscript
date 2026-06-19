import { sort } from '../../types/object/module.f.ts'
import { transpile } from './module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { virtual, emptyState, type Dir } from '../../effects/node/virtual/module.f.ts'
import { utf8 } from '../../text/module.f.ts'

const run = (root: Dir) => (path: string) => {
    const [_, result] = virtual({ ...emptyState, root })(transpile(path))
    return result
}

export const proof = {
    parse: () => {
        const result = run({ a: [utf8('export default 1')] })('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '1') { throw s }
    },
    parseWithSubModule: () => {
        const result = run({ a: { b: [utf8('import c from "c"\nexport default c')], c: [utf8('export default 2')] } })('a/b')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '2') { throw s }
    },
    parseWithSubModules: () => {
        const result = run({
            a: [utf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]')],
            b: [utf8('import d from "d"\nexport default [0,d]')],
            c: [utf8('import d from "d"\nexport default [1,d]')],
            d: [utf8('export default 2')],
        })('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '[[0,2],[1,2],[0,2]]') { throw s }
    },
    parseWithFileNotFoundError: () => {
        const result = run({ a: [utf8('import b from "b"\nexport default b')] })('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'file not found') { throw result }
    },
    parseWithCycleError: () => {
        const result = run({
            a: [utf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]')],
            b: [utf8('import c from "c"\nexport default c')],
            c: [utf8('import b from "b"\nexport default b')],
        })('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'circular dependency') { throw result }
    },
}
