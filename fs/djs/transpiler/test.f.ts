import { sort } from '../../types/object/module.f.ts'
import { setReplace, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import { transpile } from './module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { createVirtualIo } from '../../io/virtual/module.f.ts'
import type { Fs } from '../../io/module.f.ts'
import { encodeUtf8 } from '../../types/uint8array/module.f.ts'

const virtualFs
    :(map: OrderedMap<Uint8Array>) => Fs
    = map => {
        return createVirtualIo(map).fs
    }

export default {
    parse: () => {
        const map = setReplace('a')(encodeUtf8('export default 1'))(null)
        const fs = virtualFs(map)
        const result = transpile(fs)('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '1') { throw s }
    },
    parseWithSubModule: () => {
        const map = setReplace('a/b')(encodeUtf8('import c from "c"\nexport default c'))(null)
        const map2 = setReplace('a/c')(encodeUtf8('export default 2'))(map)
        const fs = virtualFs(map2)
        const result = transpile(fs)('a/b')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '2') { throw s }
    },
    parseWithSubModules: () => {
        const map = setReplace('a')(encodeUtf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]'))(null)
        const map2 = setReplace('b')(encodeUtf8('import d from "d"\nexport default [0,d]'))(map)
        const map3 = setReplace('c')(encodeUtf8('import d from "d"\nexport default [1,d]'))(map2)
        const map4 = setReplace('d')(encodeUtf8('export default 2'))(map3)
        const fs = virtualFs(map4)
        const result = transpile(fs)('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringifyAsTree(sort)(result[1])
        if (s !== '[[0,2],[1,2],[0,2]]') { throw s }
    },
    parseWithFileNotFoundError: () => {
        const map = setReplace('a')(encodeUtf8('import b from "b"\nexport default b'))(null)
        const fs = virtualFs(map)
        const result = transpile(fs)('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'file not found') { throw result }
    },
    parseWithCycleError: () => {
        const map = setReplace('a')(encodeUtf8('import b from "b"\nimport c from "c"\nexport default [b,c,b]'))(null)
        const map2 = setReplace('b')(encodeUtf8('import c from "c"\nexport default c'))(map)
        const map3 = setReplace('c')(encodeUtf8('import b from "b"\nexport default b'))(map2)
        const fs = virtualFs(map3)
        const result = transpile(fs)('a')
        if (result[0] !== 'error') { throw result }
        if (result[1].message !== 'circular dependency') { throw result }
    },
}
