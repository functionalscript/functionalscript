import * as parser from '../parser/module.f'
import * as tokenizer from '../tokenizer/module.f'
import { toArray } from '../../types/list/module.f'
import { sort } from '../../types/object/module.f'
import * as encoding from '../../text/utf16/module.f'
import { djsModuleStringify } from '../serializer/module.f'

const tokenizeString
    : (s: string) => readonly tokenizer.DjsToken[]
    = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

export default {
    
}
