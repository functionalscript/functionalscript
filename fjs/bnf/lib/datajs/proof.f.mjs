/**
 * @import { CodePoint } from '../../../text/utf16/types.ts'
 * @import { Meta } from '../../matcher/types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { map, toArray } from '../../../types/list/module.f.mjs'
import { descentParser } from '../../descent/module.f.mjs'
import { dataJs } from './module.f.mjs'

/** @type {(symbol: CodePoint) => Meta<undefined, CodePoint>} */
const withMeta = symbol => [symbol, undefined]

/** @type {(input: string) => boolean} */
const matches = input => {
    const cp = toArray(map(withMeta)(stringToCodePointList(input)))
    const result = descentParser(dataJs)('', cp)
    return result.success && result.idx === cp.length
}

export const proof = {
    accepts: [
        () => assert(matches('const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];')),
        () => assert(matches('const $config=undefined;const $10=NaN;export default [$config,$10,Infinity,-Infinity];')),
    ],
    rejects: [
        () => assert(!matches('const $0={["__proto__"]:"world!"};export default $0')),
        () => assert(!matches('export default1;')),
        () => assert(!matches('exportdefault 1;')),
        () => assert(!matches('const$x=1;export default $x;')),
    ],
}
