/** EDAG linking carries unary plus as its own node, and a unary-plus index as a numeric key. */

import { assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { parse } from '../source/module.f.js'
import { resolve, tryUnresolved, unresolved } from './module.f.js'

/** The module graph of a source text. @type {(source: string) => unknown} */
const edagOf = source => unresolved(assertOk(parse('input.f.js')(source))).edag

export const proof = /** @type {const} */ ({
    // `+x` is a number or a throw, so it is a numeric key as `Number(x)`
    // is. The key keeps the numeric-index wrapper every such key has, over
    // the unary-plus node: the bigint refusal is the inner node's.
    indexIsANumericKey: () => {
        assertStructurallySame(edagOf('export default (a,x)=>a[+x];'),
            ['{}', [[':', 'default', ['=>', 2, [], ['.', ['arg', 0], ['Number', ['+', ['arg', 1]]]]]]]])
        assertStructurallySame(edagOf('export default (a,x)=>a?.[+x];'),
            ['{}', [[':', 'default', ['=>', 2, [], ['?.', ['arg', 0], ['Number', ['+', ['arg', 1]]]]]]]])
    },
    linksAsAnyOtherOperator: () => {
        const source = /** @type {const} */ ('export default (a,x)=>a[+x];')
        assertOk(tryUnresolved(assertOk(parse('input.f.js')(source))))
        assertOk(virtualAt({ 'input.f.js': [utf8(source)] })(resolve('input.f.js'))[1])
    },
})
