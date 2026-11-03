import { assert, assertEq } from '../../../asserts/module.f.js'
import { _function } from '../standalone.proof.f.mjs'
import { _flattenedStandalone, _hasArmThrow, _regionBlock, _standaloneStatements } from './module.f.js'
import { parseSyntax } from '../syntax/module.f.mjs'
import { tokenizeString } from '../proof.f.mjs'
import { assertOk } from '../../../asserts/module.f.js'

export const proof = {
    regions: () => {
        const body = _function('export default ()=>{return 1;};').body
        assertEq(_regionBlock(['block', body]), body)
        const empty = { statements: [], exit: /** @type {const} */ (['yield', undefined]) }
        assertEq(_flattenedStandalone(empty), empty.statements)
        assertEq(_flattenedStandalone({ statements: [], exit: ['throw', 2] })[0][0], 'throw')
    },
    endings: () => {
        for (const [source, ending] of /** @type {const} */ ([
            ['{}export default 0;', null], ['{throw 1;}export default 0;', 'throw'],
            ['{while(false){}}export default 0;', 'while'],
            ['{for(;;){}}export default 0;', 'for'],
            ['{for(const x of []){}}export default 0;', 'for-of'],
        ])) {
            const statement = assertOk(parseSyntax(tokenizeString(source))).statements[0]
            assert(statement[0] === 'block')
            const statements = _standaloneStatements(statement[1].block)
            assertEq(statements.length === 0 ? null : statements[0][0], ending)
        }
    },
    throws: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['export default ()=>{return 1;};', false],
            ['export default ()=>{throw 1;};', true],
            ['export default ()=>{{throw 1;}return 0;};', true],
            ['export default ()=>{while(true){break;}return 0;};', false],
            ['export default ()=>{for(const x of []){}return 0;};', false],
            ['export default ()=>{while(true){continue;}};', false],
            ['export default ()=>{if(true){return 1;}else{return 2;}return 0;};', false],
            ['export default ()=>{switch(1){case 1:{return 1;}default:{return 2;}}};', false],
            ['export default ()=>{let x=0;if(true){x=1;}return x;};', false],
            ['export default ()=>{while(false){if(true){throw 1;}}return 0;};', true],
            ['export default ()=>{while(false){switch(1){case 1:{break;}default:{break;}}}return 0;};', false],
        ])) { assertEq(_hasArmThrow([_function(source).body]), expected) }
        assertEq(_hasArmThrow([]), false)
    },
}
