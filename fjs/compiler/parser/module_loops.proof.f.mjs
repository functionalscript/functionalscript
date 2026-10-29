/**
 * A module's loop shares its initialization scope and the existing loop owner.
 * Exports retain declaration-time values while module variables keep rebinding.
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'

/** @param {string} source */
const parsed = source => assertOk(parse('')(source))

/** @param {string} source */
const evaluated = source => memo(assertOk(analysis(unresolved(parsed(source)).edag)))({ args: [] })

/** @param {string} source */
const result = source => assertOk(toData(assertOk(evaluated(source))))

export const proof = /** @type {const} */ ({
    moduleLoopRetainsScopeAndSourceFacts: () => {
        const module = parsed('let state=0;export const before=state;while(state<2){let local=1;local=local+1;state=state+local;}export const after=state;while(false){const local=0;}export default state;')
        const loops = module.body.statements.flatMap(statement => statement[0] === 'while' ? [statement[1]] : [])
        assertEq(loops.length, 2)
        assert(loops[0].target !== loops[1].target)
        assert(loops[0].target.index !== loops[1].target.index)
        const state = assertNotNullish(module.origins.find(origin => origin.name === 'state')).id
        const fact = assertNotNullish(module.bindings.find(binding => binding.id === state))
        assertEq(fact.isMutable, true)
        assertEq(fact.capturedBy.length, 0)
        assert(loops[0].events.some(event => event[0] === 'read' && event[1] === state))
        assert(loops[0].events.some(event => event[0] === 'region'))
        assert(module.scope.events.every(event => event[0] !== 'function'))
        const locals = module.origins.filter(origin => origin.name === 'local')
        assertEq(locals.length, 2)
        assert(locals[0].id !== locals[1].id)
        assert(module.body.exit[0] === 'yield')
        assertEq(module.scope.target.kind, 'function')
        assertStructurallySame(result('let state=0;export const before=state;while(state<2){let local=1;local=local+1;state=state+local;}export const after=state;export default state;'), { after: 2, before: 0, default: 2 })
    },
    snapshotsSequentialAndZeroState: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['while(false){}export default 7;', { default: 7 }],
            ['while(false){break;}export default 1;', { default: 1 }],
            ['while(false){while(false){}}export default 1;', { default: 1 }],
            ['let r = 0; while (r) { r = 1; } export default r;', { default: 0 }],
            ['let i=0;let sum=0;export const before=i;while(i<3){sum=sum+i;i=i+1;}export const middle=sum;while(i<5){i=i+1;sum=sum+2;}export const after=i;export default sum;', { after: 5, before: 0, default: 7, middle: 3 }],
            ['let current=[0];export const before=current;let i=0;while(i<2){current=[i+1];i=i+1;}export const after=current;export default [before===after,before[0],after[0]];', { after: [2], before: [0], default: [false, 0, 2] }],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(result(source), expected, source)
        }
        parsed('let state=0;const snapshot=state;export const read=()=>snapshot;while(state<2){state=state+1;}export default [read(),state];')
        // A body-local shadow does not assign the condition's outer variable.
        parsed('while(false){const hidden=null.x;}let state=0;while(state<1){const state=9;}export default 1;')
        assertStructurallySame(result('let state=0;const snapshot=state;const read=()=>snapshot;while(state<2){state=state+1;}export default [read(),state];'), { default: [0, 2] })
        assertStructurallySame(result('let state=0\nwhile(state<1){state=state+1}export const value=state\nwhile(false){}export default value'), { default: 1, value: 1 })
    },
    importsAndStateSignatures: () => {
        const module = parsed('import limit from "./limit.f.js";let z=0;let a=1;while(z<limit){a=a+z;z=z+1;}export default [z,a];')
        const limit = assertNotNullish(module.origins.find(origin => origin.name === 'limit')).id
        const imported = assertNotNullish(module.bindings.find(binding => binding.id === limit))
        assertEq(imported.isMutable, false)
        assertEq(imported.capturedBy.length, 0)
        assertEq(module.imports.length, 1)
        const fast = normalize(module, [3])
        const statement = fast.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        assertEq(statement[1].parameters.length, 2)
        assertEq(statement[1].results.length, 2)
        assert(statement[1].parameters[0] !== statement[1].parameters[1])
        const width = /** @type {const} */ (18)
        const declarations = Array.from({ length: width }, (_, i) => `let s${i}=${i};`).join('')
        const updates = Array.from({ length: width }, (_, i) => `s${i}=s${i}+1;`).join('')
        const source = /** @type {string} */ (`${declarations}while(s0<3){${updates}}export default [s0,s17];`)
        const wide = normalize(parsed(source), []).body.statements.find(statement => statement[0] === 'loop')
        assert(wide !== undefined && wide[0] === 'loop')
        assertEq(wide[1].parameters.length, width)
        assertEq(wide[1].results.length, width)
        assertStructurallySame(result(source), { default: [3, 20] })
    },
    reachedInitializationAndTerminalFailures: () => {
        for (const source of /** @type {const} */ ([
            'const required=null.x;while(false){}export default 7;',
            'while(null.x){}export default 7;',
            'while(true){const required=null.x;}export default 7;',
            'let i=0;let sum=0;while(i<1){sum=null.x;sum=1;i=i+1;}export default sum;',
            'let limit=null.x;limit=limit;let i=0;while(i<0){const unused=limit;i=i+1;}export default i;',
            'export const value=1;while(false){}throw 9;',
        ])) { assertError(evaluated(source)) }
    },
    refusalsAndTerminatorBoundaries: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['let state=0 while(state<1){state=state+1;}export default state;', 'unexpected token'],
            ['while(missing){}export default 1;', 'const not found'],
            ['while(false){const value=missing;}export default 1;', 'const not found'],
            ['while(false){const local=1;}export default local;', 'const not found'],
            ['const state=0;while(false){state=1;}export default state;', 'assignment to const'],
            ['import state from "./state.f.js";while(false){state=1;}export default state;', 'assignment to const'],
            ['let state=0;const held=()=>state;while(false){state=1;}export default held;', 'reassigned variable captured'],
            ['let state=0;while(false){const held=()=>state;state=1;}export default state;', 'reassigned variable captured'],
            ['let state=0;while(state<1){state=state+1;}export default ()=>state;', 'reassigned variable captured'],
            ['export const {}={};while(false){}', 'module exports nothing'],
            ['while(false){}', 'unexpected end'],
            ['while(false){};export default 1;', 'unexpected token'],
            ['export default 1;while(false){}', 'unexpected token'],
            ['while(false){}throw 1;while(false){}', 'unexpected token'],
            ['while(false){if(true){return 1;}}export default 1;', 'unexpected token'],
            ['while(false){break label;}export default 1;', 'unexpected token'],
        ])) { assertEq(assertError(parse('')(source)).message, expected, source) }
    },
})
