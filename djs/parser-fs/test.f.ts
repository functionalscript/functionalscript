import * as tokenizer from '../tokenizer/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import * as encoding from '../../text/utf16/module.f.ts'
import { djsModuleStringify } from '../serializer/module.f.ts'
import { at, setReplace, type Map } from '../../types/map/module.f.ts'
import type { Fs } from '../io/module.f.ts'
import { parse } from './module.f.ts'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

const virtualFs = (files: Map<string>): Fs => ({
    readFileSync: (path: string) => at(path)(files),
    writeFileSync: (path: string) => (content: string) => {}
})

export default {
    parse: () => {
        const map: Map<string> = null
        setReplace('a')('export default null')(map)
        const fs = virtualFs(map)
        const p = parse(fs)('a')
    }
}
