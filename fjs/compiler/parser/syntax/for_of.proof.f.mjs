/**
 * Keep declaration-based `for...of` as syntax, with its original pattern,
 * iterable and body, without inventing classic-loop clauses or evaluation.
 *
 * @import { Block, Module } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { unwrap } from '../../../types/result/module.f.js'
import { stringToList } from '../../../text/utf16/module.f.js'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => Module} */
const read = source => unwrap(parseSyntax(tokenize(stringToList(source))('for-of.f.js')))

/** @type {(source: string) => Block[1]} */
const statements = source => {
    const value = read(source).exported?.value
    assert(value !== undefined && value[0] === '=>')
    const body = value[2]
    assert(body[0] === 'block')
    return body[1]
}

export const proof = /** @type {const} */ ({
    declarationsKeepTheirTargetIterableAndSourcePosition: () => {
        const named = read('\nfor(const item of items){use(item);}export default 0;').statements[0]
        assert(named[0] === 'for-of')
        assertEq(named[1].kind, 'const')
        assertEq(named[1].start.metadata.line, 2)
        assertEq(named[1].start.metadata.column, 1)
        assert(named[1].target[0] === 'name')
        assertStructurallySame(named[1].target[1].token, { kind: 'id', value: 'item' })
        assert(named[1].iterable[0] === 'ref')
        assertStructurallySame(named[1].iterable[1].token, { kind: 'id', value: 'items' })
        assertEq(named[1].block[1][0][0], 'const')
        const array = read('for(let [first,,...rest] of rows){}export default 0;').statements[0]
        assert(array[0] === 'for-of')
        assertEq(array[1].kind, 'let')
        assert(array[1].target[0] === 'array')
        assertStructurallySame(array[1].target[2].map(target => target[0]), ['name', 'elision', '...'])
        const object = read('for(const {of:alias,...rest} of rows){}export default 0;').statements[0]
        assert(object[0] === 'for-of' && object[1].target[0] === 'object')
        assertEq(object[1].target[2].length, 2)
    },
    nestedBodiesAndFollowingTransfersRemainUnresolvedSyntax: () => {
        const outer = statements('export default rows=>{for(const row of rows){for(let item of row){continue;throw item;}break;return row;}return 0;};')[0]
        assert(outer[0] === 'for-of')
        assertStructurallySame(outer[1].block[1].map(statement => statement[0]), ['for-of', 'break', 'return'])
        const nested = outer[1].block[1][0]
        assert(nested[0] === 'for-of')
        assertStructurallySame(nested[1].block[1].map(statement => statement[0]), ['continue', 'throw'])
        const candidate = statements('export default rows=>{for(const row of rows){return row;}};')[0]
        assertEq(candidate[0], 'terminal-for-of')
    },
    conditionalArmsRetainFinalAndFollowingLoopPositions: () => {
        const terminal = statements('export default (b,rows)=>{if(b){for(const row of rows){}}return 0;};')[0]
        assert(terminal[0] === 'normal-if')
        assertEq(terminal[1].block[2]?.[0], 'terminal-for-of')
        const following = statements('export default (b,rows)=>{if(b){for(const row of rows){}const x=1;}return 0;};')[0]
        assert(following[0] === 'normal-if')
        assertStructurallySame(following[1].block[1].map(statement => statement[0]), ['for-of', 'const'])
        assertEq(following[1].block[2], null)
        const ended = statements('export default (b,rows)=>{if(b){for(const row of rows){}return 1;}return 0;};')[0]
        assert(ended[0] === 'if')
        assertStructurallySame(ended[1].block[1].map(statement => statement[0]), ['for-of', 'return'])
    },
    contextualOfKeepsItsIdentifierTokens: () => {
        const loop = read('for(const of of of){}export default 0;').statements[0]
        assert(loop[0] === 'for-of' && loop[1].target[0] === 'name' && loop[1].iterable[0] === 'ref')
        assertStructurallySame(loop[1].target[1].token, { kind: 'id', value: 'of' })
        assertStructurallySame(loop[1].iterable[1].token, { kind: 'id', value: 'of' })
        const classic = read('let of=0;for(of=0;of<2;of+=1){}export default of;').statements[1]
        assert(classic[0] === 'for' && classic[1].initializer !== null && classic[1].initializer[0] === 'assign')
        assertStructurallySame(classic[1].initializer[1].name.token, { kind: 'id', value: 'of' })
        assertEq(classic[1].condition[0], '<')
        assert(classic[1].step !== null && classic[1].step[0] === 'assign')
        assertEq(classic[1].step[1].operator?.tag, '+')
    },
})
