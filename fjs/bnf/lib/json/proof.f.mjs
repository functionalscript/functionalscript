/**
 * @import { CodePoint } from '../../../text/utf16/types.ts'
 * @import { CodePointMeta } from '../../descent/types.ts'
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

/** @type {(symbol: CodePoint) => CodePointMeta<undefined>} */
const withMeta = symbol => [symbol, undefined]

/** @type {(rule: Rule, input: string) => boolean} */
const matches = (rule, input) => {
    const cp = toArray(map(withMeta)(stringToCodePointList(input)))
    const result = descentParser(rule)('', cp)
    return result.success && result.idx === cp.length
}

export const proof = {
    json: () => {
        assert(matches(json, ' {"a":[null,true,false,-12.5e+2,"\\u0041"]} '))
        assert(!matches(json, '{"a":1} trailing'))
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
