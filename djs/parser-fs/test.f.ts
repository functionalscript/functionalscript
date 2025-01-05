import * as tokenizer from '../tokenizer/module.f'
import { toArray } from '../../types/list/module.f'
import { sort } from '../../types/object/module.f'
import * as encoding from '../../text/utf16/module.f'
import { djsModuleStringify } from '../serializer/module.f'
import { at, type Map } from '../../types/map/module.f'
import type { Fs } from '../io/module.f'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

const createVirtualFs = (files: Map<string>): Fs => ({
    readFileSync: (path: string) => at(path)(files),
    writeFileSync: (path: string) => (content: string) => {}
})

export default {
    parse: () => {

    }
}
