import * as tokenizer from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import * as encoding from '../../text/utf16/module.f.ts'
import { djsModuleStringify } from '../serializer/module.f.ts'
import { at, setReplace, type Map } from '../../types/map/module.f.ts'
import type { Fs } from '../io/module.f.ts'
import { transpile } from './module.f.ts'
import { stringify } from '../module.f.ts'

const virtualFs = (files: Map<string>): Fs => ({
    readFileSync: (path: string) => at(path)(files),
    writeFileSync: (path: string) => (content: string) => {
        const map = setReplace(path)(content)(files)
        return virtualFs(map)
    }
})

export default {
    parse: () => {        
        const map = setReplace('a')('export default 1')(null)
        const fs = virtualFs(map)
        const result = transpile(fs)('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringify(sort)(result[1])
        if (s !== '1') { throw s }
    },
    parseWithSubModule: () => {        
        const map = setReplace('a')('import b from "b"\nexport default b')(null)
        const map2 = setReplace('a/b')('export default 2')(map)
        const fs = virtualFs(map2)
        const result = transpile(fs)('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringify(sort)(result[1])
        if (s !== '2') { throw s }
    },
    parseWithSubModules: () => {        
        const map = setReplace('a')('import b from "b"\nimport c from "c"\nexport default [b,c,b]')(null)
        const map2 = setReplace('a/b')('import d from "../d"\nexport default [0,d]')(map)
        const map3 = setReplace('a/c')('import d from "../d"\nexport default [1,d]')(map2)
        const map4 = setReplace('a/d')('export default 2')(map3)
        const fs = virtualFs(map4)
        const result = transpile(fs)('a')
        if (result[0] === 'error') { throw result[1] }
        const s = stringify(sort)(result[1])
        if (s !== '[[0,2],[1,2],[0,2]]') { throw s }
    },
    parseWithFileNotFoundError: () => {        
        const map = setReplace('a')('import b from "b"\nexport default b')(null)
        const fs = virtualFs(map)
        const result = transpile(fs)('a')
        if (result[0] !== 'error') { throw result }
        if (result[1] !== 'circular dependency') { throw result }
    },
    parseWithCycleError: () => {        
        const map = setReplace('a')('import b from "b"\nimport c from "c"\nexport default [b,c,b]')(null)
        const map2 = setReplace('a/b')('import c from "../c"\nexport default c')(map)
        const map3 = setReplace('a/c')('import b from "../b"\nexport default b')(map2)        
        const fs = virtualFs(map3)
        const result = transpile(fs)('a')
        if (result[0] !== 'error') { throw result }
        if (result[1] !== 'circular dependency') { throw result }
    },
}
