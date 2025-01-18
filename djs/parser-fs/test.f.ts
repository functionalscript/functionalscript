import * as tokenizer from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import * as encoding from '../../text/utf16/module.f.ts'
import { djsModuleStringify } from '../serializer/module.f.ts'
import { at, setReplace, type Map } from '../../types/map/module.f.ts'
import type { Fs } from '../io/module.f.ts'
import { parse } from './module.f.ts'

const stringifyDjsModule = djsModuleStringify(sort)

const virtualFs = (files: Map<string>): Fs => ({
    readFileSync: (path: string) => at(path)(files),
    writeFileSync: (path: string) => (content: string) => {
        const map = setReplace(path)(content)(files)
        return virtualFs(map)
    }
})

export default {
    parse: () => {        
        const map = setReplace('a')('export default null')(null)
        const fs = virtualFs(map)
        const modules = parse(fs)('a')
        const module = at('a')(modules)
        if (module === null) { throw module }
        if (module[0] === 'error') { throw module[1] }
        const result = stringifyDjsModule(module[1])
        if (result !== 'export default null') { throw result }
    },
    parseWithSubModule: () => {        
        const map = setReplace('a')('import a from "b"\nexport default a')(null)
        const map2 = setReplace('a/b')('export default null')(map)
        const fs = virtualFs(map2)
        const modules = parse(fs)('a')

        const moduleA = at('a')(modules)
        if (moduleA === null) { throw moduleA }
        if (moduleA[0] === 'error') { throw moduleA[1] }
        const resultA = stringifyDjsModule(moduleA[1])
        if (resultA !== 'import a0 from "b"\nexport default a0') { throw resultA }

        const moduleB = at('a/b')(modules)
        if (moduleB === null) { throw moduleB }
        if (moduleB[0] === 'error') { throw moduleB[1] }
        const resultB = stringifyDjsModule(moduleB[1])
        if (resultB !== 'export default null') { throw resultB }
    },
    parseWithCycle: () => {        
        const map = setReplace('a')('import a from "b"\nexport default a')(null)
        const map2 = setReplace('a/b')('import a from ".."\nexport default a')(map)
        const fs = virtualFs(map2)
        const modules = parse(fs)('a')

        const moduleA = at('a')(modules)
        if (moduleA === null) { throw moduleA }
        if (moduleA[0] === 'error') { throw moduleA[1] }
        const resultA = stringifyDjsModule(moduleA[1])
        if (resultA !== 'import a0 from "b"\nexport default a0') { throw resultA }

        const moduleB = at('a/b')(modules)
        if (moduleB === null) { throw moduleB }
        if (moduleB[0] !== 'error') { throw moduleB[0] }
        if (moduleB[1] !== 'circular dependency') { throw moduleB[1] }
    }
}
