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
    writeFileSync: (path: string) => (content: string) => {}
})

export default {
    parse: () => {        
        const map = setReplace('a')('export default null')(null)
        const fs = virtualFs(map)
        const modules = parse(fs)('a')
        const module = at('a')(modules)
        if (module === null) { throw module }
        if (module[0] === 'error') { throw module[1] }
        if (stringifyDjsModule(module[1]) !== 'export default null') { throw module[1] }
    }
}
