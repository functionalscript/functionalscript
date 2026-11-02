/** Number property names retain their spelling, value and source location. */

/** @import { Member } from './types.ts' */

import { assert, assertEq, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => readonly Member[]} */
const members = source => {
    const value = assertNotNullish(assertOk(parseSyntax(tokenizeString(source))).exported).value
    assert(value[0] === 'object')
    return value[1].map(entry => { assert(!(entry instanceof Array)); return entry })
}

export const proof = /** @type {const} */ ({
    numberSpellingsRetainTheirNumericValueAndToken: () => {
        /** @type {readonly (readonly [string, number])[]} */
        const samples = [['0', 0], ['0x70', 112], ['0b11', 3], ['1_000', 1_000], ['1.5', 1.5], ['2e3', 2_000], ['1e309', Infinity]]
        for (const [spelling, expected] of samples) {
            const source = `export default {\n    ${spelling}: "value"\n};`
            const member = members(source)[0]
            assert(member.spelling === 'number')
            assertStructurallySame(member.node, ['primitive', expected])
            assertStructurallySame(member.value, ['primitive', 'value'])
            assert(member.key.token.kind === 'number')
            assertEq(member.key.token.value, spelling)
            assertStructurallySame(member.key.metadata, { path: '', line: 2, column: 5 })
        }
    },
    numericAndBracketedSpellingRemainDistinct: () => {
        const [literal, bracketed, quoted, named] = members('export default {0x70:1,[0x70]:2,"112":3,named:4};')
        assert(literal.spelling === 'number' && bracketed.spelling === 'computed')
        assertStructurallySame(literal.node, bracketed.node)
        assertEq(quoted.spelling, 'string')
        assertEq(named.spelling, 'plain')
        assertStructurallySame([literal.value, bracketed.value, quoted.value, named.value], [['primitive', 1], ['primitive', 2], ['primitive', 3], ['primitive', 4]])
    },
    numericPatternKeysRetainTheSameConstantToken: () => {
        const source = /** @type {const} */ ('const {0:first,0x70:value=3}=input;export default value;')
        const declaration = assertOk(parseSyntax(tokenizeString(source))).statements[0]
        assert(declaration[0] === 'const')
        const target = declaration[1].declaration.target
        assert(target[0] === 'object')
        const [first, second] = target[2]
        assert(!(first instanceof Array) && !(second instanceof Array))
        assert(!(first.key instanceof Array) && !(second.key instanceof Array))
        assert(first.key.token.kind === 'number' && second.key.token.kind === 'number')
        assertEq(first.key.token.value, '0')
        assertEq(second.key.token.value, '0x70')
        assertEq(second.key.metadata.column, source.indexOf('0x70') + 1)
        assert(second.target[0] === '=' && second.target[1][0] === 'name')
        assertStructurallySame(second.target[3], ['primitive', 3])
    },
})
