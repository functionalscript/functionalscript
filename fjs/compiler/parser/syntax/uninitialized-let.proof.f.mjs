/** @import { Block } from './types.ts' */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** The block of the exported function, retaining its source declarations. @type {(source: string) => Block} */
const functionBlock = source => {
    const value = assertOk(parseSyntax(tokenizeString(source))).exported?.value
    assert(value !== undefined && value[0] === '=>')
    const block = value[2]
    assert(block[0] === 'block')
    return block
}

export const proof = /** @type {const} */ ({
    omissionIsDistinctFromExplicitPrimitiveInitializers: () => {
        const module = assertOk(parseSyntax(tokenizeString('\nlet absent;\nlet explicit=undefined;let nullable=null;export default absent;')))
        const [absent, explicit, nullable] = module.statements
        assert(absent[0] === 'let' && explicit[0] === 'let' && nullable[0] === 'let')
        assertEq(absent[1].exported, false)
        const declaration = absent[1].declaration
        assertEq(declaration.value, null)
        assertEq(declaration.semicolon, true)
        assertEq(declaration.start.token.kind, 'id')
        assertStructurallySame(declaration.start.metadata, { path: '', line: 2, column: 1 })
        assert(declaration.target[0] === 'name')
        assertStructurallySame(declaration.target[1].metadata, { path: '', line: 2, column: 5 })
        assertStructurallySame(explicit[1].declaration.value, ['primitive', undefined])
        assertStructurallySame(nullable[1].declaration.value, ['primitive', null])
    },
    ordinaryStatementsKeepOmissionAndAsiEvidence: () => {
        const block = functionBlock('export default a=>{let local\nif(a){let branch;}while(false){let loop;}return local;};')
        const [local, conditional, loop] = block[1]
        assert(local[0] === 'let' && conditional[0] === 'normal-if' && loop[0] === 'while')
        assertEq(local[1].value, null)
        assertEq(local[1].semicolon, false)
        const branch = conditional[1].block[1][0]
        assert(branch[0] === 'let')
        assertEq(branch[1].value, null)
        assertEq(branch[1].semicolon, true)
        const inner = loop[1].block[1][0]
        assert(inner[0] === 'let')
        assertEq(inner[1].value, null)
    },
    loopSwitchDeclarationsKeepOmission: () => {
        const module = assertOk(parseSyntax(tokenizeString('while(false){switch(0){case 0:{let value;break;}}}export default 0;')))
        const loop = module.statements[0]
        assert(loop[0] === 'while')
        const statement = loop[1].block[1][0]
        assert(statement[0] === 'switch')
        const declaration = statement[1].cases[0].block[1][0]
        assert(declaration[0] === 'let')
        assertEq(declaration[1].value, null)
    },
    classicForKeepsNamedOmissionAndRequiredPatternInitializers: () => {
        const module = assertOk(parseSyntax(tokenizeString('for(let value;false;value=1){}for(let [item]=[0];false;){}for(let {item}={item:0};false;){}export default 0;')))
        for (const [index, statement] of module.statements.entries()) {
            assert(statement[0] === 'for')
            const initializer = statement[1].initializer
            assert(initializer !== null && initializer[0] === 'let')
            assertEq(initializer[1].semicolon, true)
            assertEq(initializer[1].target[0], index === 0 ? 'name' : index === 1 ? 'array' : 'object')
            assertEq(initializer[1].value === null, index === 0)
        }
        const loop = module.statements[0]
        assert(loop[0] === 'for' && loop[1].initializer !== null)
        assertEq(loop[1].initializer[1].start.metadata.column, 5)
        assert(loop[1].step !== null && loop[1].step[0] === 'assign')
    },
    namedAndPatternForOfDeclarationsRemainTargetOnly: () => {
        const module = assertOk(parseSyntax(tokenizeString('for(let item of values){}for(let [item] of values){}for(let {item} of values){}export default 0;')))
        for (const statement of module.statements) {
            assert(statement[0] === 'for-of')
            assertEq(statement[1].kind, 'let')
            assertEq(statement[1].iterable[0], 'ref')
        }
    },
    initializedLetPatternsKeepTheirValues: () => {
        const module = assertOk(parseSyntax(tokenizeString('let [first]=[1];let {second}={second:2};export default first;')))
        for (const statement of module.statements) {
            assert(statement[0] === 'let')
            assert(statement[1].declaration.value !== null)
            assertEq(statement[1].declaration.value[0], statement[1].declaration.target[0])
        }
    },
})
