import * as parser from '../parser/module.f.mjs'
import * as tokenizer from '../tokenizer/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { toArray } = list
import * as djsSerializer from './module.f.mjs'
const { djsModuleStringify } = djsSerializer
import * as o from '../../types/object/module.f.mjs'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.mjs'

/** @type {(s: string) => readonly tokenizer.DjsToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringifyDjsModule = djsModuleStringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'export default null') { throw result }
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [a,{"k1":[b]}]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'const c0 = 1\nconst c1 = 2\nexport default [c0,{"k1":[c1]}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = a \n export default [a,{"k1":[b]}]')
            const obj = parser.parse(tokenList)
            if (obj[0] !== 'ok') { throw obj }
            const result = stringifyDjsModule(obj[1])
            if (result !== 'import a0 from "test/test.f.mjs"\nconst c0 = a0\nexport default [a0,{"k1":[c0]}]') { throw result }
        },
    ],
}