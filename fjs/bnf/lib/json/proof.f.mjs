/**
 * @import { CodePoint } from '../../../text/utf16/types.ts'
 * @import { Meta } from '../../matcher/types.ts'
 * @import { Rule } from '../../types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { map, toArray } from '../../../types/list/module.f.mjs'
import { descentParser } from '../../descent/module.f.mjs'
import {
    array,
    cj,
    createValue,
    digit,
    json,
    object,
    optionFloatSuffix,
    optionNeg,
    string,
    uint,
    ws,
    wsSymbol,
} from './module.f.mjs'

/** @type {(symbol: CodePoint) => Meta<undefined, CodePoint>} */
const withMeta = symbol => [symbol, undefined]

/** @type {(rule: Rule, input: string) => boolean} */
const matches = (rule, input) => {
    const cp = toArray(map(withMeta)(stringToCodePointList(input)))
    const result = descentParser(rule)('', cp)
    return result.success && result.idx === cp.length
}

export const proof = {
    json: {
        accepts: [
            () => assert(matches(json, ' {"a":[null,true,false,-12.5e+2,"\\u0041"]} ')),
            () => assert(matches(json, '\t"\\t\\u00AF "\r\n')),
            () => assert(matches(json, '[0,9,19,1e+5,"\\u0099"]')),
        ],
        rejects: [
            () => assert(!matches(json, '{"a":1} trailing')),
            () => assert(!matches(json, '01')),
            () => assert(!matches(json, '00')),
            () => assert(!matches(json, '+1')),
            () => assert(!matches(json, '[1,]')),
            () => assert(!matches(json, '"unterminated')),
            () => assert(!matches(json, '"\\u00AG"')),
            () => assert(!matches(json, '"\u0001"')),
        ],
    },
    buildingBlocks: [
        () => assert(matches(digit, '7')),
        () => assert(matches(string, '"a\\n"')),
        () => assert(matches(optionNeg, '-')),
        () => assert(matches(uint, '123')),
        () => assert(matches(optionFloatSuffix, '.5e2')),
        () => assert(matches(wsSymbol, '\n')),
        () => assert(matches([ws, 'x'], ' x')),
        () => assert(matches(cj('[]', 'x'), '[x, x]')),
        () => assert(matches(array('x'), '[x]')),
        () => assert(matches(object('p', 'x'), '{p:x}')),
        () => assert(matches(createValue('p', 'x'), '{p:x}')),
        () => assert(!matches(createValue('p', 'x'), '{"p":x}')),
    ],
}
