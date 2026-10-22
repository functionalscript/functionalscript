/**
 * Resolution keeps the source binding and control structure that sugar needs.
 *
 * @import { SourceFunction } from '../../js/ast/sugar/source.ts'
 */

import { assert, assertEq, assertNotNullish, assertOk } from '../../asserts/module.f.js'
import { parse } from '../source/module.f.mjs'

/** @type {(source: string) => { readonly fn: SourceFunction; readonly module: import('./types.ts').ResolvedModule }} */
const sourceFunction = source => {
    const module = assertOk(parse('')(source))
    assert(module.body.exit[0] === 'yield')
    const exports = module.body.exit[1]
    assert(exports instanceof Array && exports[0] === 'object')
    const entry = exports[1][0]
    assert(entry[0] === ':')
    const value = entry[2]
    assert(value instanceof Array && value[0] === 'function')
    return { fn: value[1], module }
}

export const proof = {
    parameterPlans: () => {
        const { fn, module } = sourceFunction('export default ([head],next=head,...rest)=>[head,next,rest];')
        assertEq(fn.length, 1)
        assertEq(fn.parameters.length, 2)
        assert(fn.parameters[0].plan.reads.some(read => read.spread))
        assertEq(fn.parameters[0].default, null)
        const head = assertNotNullish(module.origins.find(origin => origin.name === 'head')).id
        const fallback = assertNotNullish(fn.parameters[1].default).value
        assert(fallback instanceof Array && fallback[0] === 'ref')
        assertEq(fallback[1], head)
        assertNotNullish(fn.rest)
        assertEq(fn.body.statements.length, 0)
        assertEq(fn.body.exit[0], 'return')
    },
    lexicalControl: () => {
        const { fn, module } = sourceFunction('export default n=>{if(n){const snapshot=n;return ()=>snapshot;}let state=0;while(state<n){const before=state;state=before+1;}return state;};')
        assert(fn.body.exit[0] === 'if')
        const [, , consequent, alternate] = fn.body.exit
        assertEq(consequent.exit[0], 'return')
        assertEq(alternate.statements.length, 2)
        const [declaration, statement] = alternate.statements
        assert(declaration[0] === 'initialize' && statement[0] === 'while')
        const state = assertNotNullish(module.origins.find(origin => origin.name === 'state')).id
        assertEq(declaration[1].ids[0], state)
        assertEq(statement[1].variable, state)
        const assignment = statement[1].body.statements[1]
        assert(assignment[0] === 'write')
        assertEq(assignment[1], state)
        assertEq(statement[1].body.exit[0], 'yield')
        assertEq(assertNotNullish(module.bindings.find(binding => binding.id === state)).isMutable, true)
        assert(alternate.exit[0] === 'return')
        assertEq(alternate.exit[1], fn.target)
    },
}
