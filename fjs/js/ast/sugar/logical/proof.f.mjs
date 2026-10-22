/**
 * Logical source sugar preserves exact operand values, identities and regions.
 *
 * @import { Exp } from '../../../../edag/types.ts'
 * @import { Block, Function as FastFunction, Value } from '../../types.ts'
 * @import { LogicalTag, SourceValue } from '../source.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { analysis } from '../../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../../edag/memo/module.f.mjs'
import { toData } from '../../../../edag/value/to_unknown/module.f.mjs'
import { parse } from '../../../../compiler/source/module.f.mjs'
import { normalize } from '../module.f.mjs'
import { logicalValue } from './module.f.js'

/** @type {(value: Value) => Block} */
const yielded = value => ({ statements: [], exit: ['yield', [value]] })

/** @type {(graph: Exp) => ReturnType<ReturnType<typeof memo>>} */
const evaluated = graph => memo(assertOk(analysis(graph)))({ args: [] })

/** @type {(source: string) => Block} */
const sourceBlock = source => normalize(assertOk(parse('')(source)), []).body

/** @type {(source: string) => Exp} */
const sourceGraph = source => fromFast(sourceBlock(source))

/** @param {string} source */
const sourceData = source => assertOk(toData(assertOk(evaluated(sourceGraph(source)))))

/** @type {(source: string) => Exp} */
const defaultGraph = source => {
    const graph = sourceGraph(`export default ${source};`)
    assert(graph instanceof Array && graph[0] === '{}')
    const member = graph[1][0]
    assert(member[0] === ':')
    return member[2]
}

const tags = /** @type {readonly LogicalTag[]} */ (['&&', '||', '??'])

export const proof = {
    exactPrimitiveValues: () => {
        const values = [null, undefined, false, 0, -0, NaN, '', true, 2, 'value', 0n, 1n]
        for (const tag of tags) {
            for (const left of values) {
                const expected = tag === '&&' ? left && 37 : tag === '||' ? left || 37 : left ?? 37
                const actual = assertOk(toData(assertOk(evaluated(fromFast(yielded(logicalValue(tag, left, 37)))))))
                assert(Object.is(actual, expected), [tag, left, actual, expected])
            }
            for (const right of values) {
                const left = tag === '&&' ? true : tag === '||' ? false : null
                const actual = assertOk(toData(assertOk(evaluated(fromFast(yielded(logicalValue(tag, left, right)))))))
                assert(Object.is(actual, right), [tag, right, actual])
            }
        }
        const literals = ['null', 'undefined', 'false', '0', '-0', 'NaN', '""', 'true', '2', '"value"', '0n', '1n']
        for (const tag of tags) {
            for (const [index, literal] of literals.entries()) {
                const left = values[index]
                const expected = tag === '&&' ? left && 37 : tag === '||' ? left || 37 : left ?? 37
                const actual = /** @type {{ readonly default: unknown }} */ (sourceData(`export default ${literal} ${tag} 37;`))
                assert(Object.is(actual.default, expected), [literal, tag, actual.default, expected])
            }
        }
    },
    immutableLeftIdentity: () => {
        const read = /** @type {const} */ (['ref', { index: 0 }])
        const reused = logicalValue('||', read, 2)
        assert(reused instanceof Array && reused[0] === 'if')
        assertEq(reused[1], read)
        assert(reused[2].exit[0] === 'yield')
        assertEq(reused[2].exit[1][0], read)
        const left = /** @type {Value} */ (['array', []])
        const expanded = logicalValue('||', left, 2)
        assert(expanded instanceof Array && expanded[0] === 'block')
        const definition = expanded[1].statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[2], left)
        assertEq(definition[3], 'required')
        assert(expanded[1].exit[0] === 'yield')
        const choice = expanded[1].exit[1][0]
        assert(choice instanceof Array && choice[0] === 'if' && choice[1] instanceof Array && choice[1][0] === 'ref')
        assertEq(choice[1][1], definition[1])
        assert(definition[1] !== read[1])
        const another = logicalValue('||', left, 2)
        assert(another instanceof Array && another[0] === 'block' && another[1].statements[0][0] === 'define')
        assert(another[1].statements[0][1] !== definition[1])
        const collision = logicalValue('||', ['array', [read]], 2)
        const collisionResult = assertOk(evaluated(fromFast(yielded(collision), [[read[1], 7]])))
        assertStructurallySame(assertOk(toData(collisionResult)), [7])
        for (const expression of ['(x=>[])(1)', '[]', '({value:1})', '(()=>1)']) {
            for (const tag of tags) {
                const graph = defaultGraph(`(${expression}) ${tag} 2`)
                assert(graph instanceof Array && graph[0] === '?:')
                if (tag === '??') {
                    const predicate = graph[1]
                    assert(predicate instanceof Array && predicate[0] === '?:')
                    const first = predicate[1]
                    const second = predicate[3]
                    assert(first instanceof Array && first[0] === '===' && second instanceof Array && second[0] === '===')
                    assertEq(first[1], graph[3])
                    assertEq(second[1], graph[3])
                } else { assertEq(graph[1], graph[tag === '||' ? 2 : 3]) }
            }
        }
    },
    returnedReferenceIdentity: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [], body: { statements: [], exit: ['return', target, 1] } })
        const values = /** @type {readonly Value[]} */ ([['array', []], ['object', [[':', 'value', 1]]], ['function', fn]])
        for (const left of values) {
            for (const tag of ['||', '??']) {
                const binding = { index: 0 }
                const read = /** @type {const} */ (['ref', binding])
                const selected = logicalValue(/** @type {LogicalTag} */ (tag), read, 2)
                const graph = fromFast({ statements: [['define', binding, left, 'required']], exit: ['yield', [['array', [read, selected]]]] })
                const result = assertOk(evaluated(graph))
                assert(result instanceof Array && result[0] === '[]')
                assertEq(result[1][0], result[1][1])
            }
        }
        assertStructurallySame(sourceData('const make=()=>[]||null.x; export default [make()===make(),typeof make()];'), { default: [false, 'object'] })
        assertStructurallySame(sourceData('export default (()=>{let state=[];while(state.length<3){const item=[]||null.x;state=[...state,item];}return [state[0]===state[1],state[1]===state[2]];})();'), { default: [false, false] })
        assertStructurallySame(sourceData('const token=[];export default (value=>[value||token,value??token])(token);'), { default: [[], []] })
        assertStructurallySame(sourceData('const token=[];const make=value=>()=>value||null.x;const read=make(token);export default [read()===token,read()===read()];'), { default: [true, true] })
        assertStructurallySame(sourceData('const make=value=>()=>value??[];const read=make(null);export default read()===read();'), { default: false })
    },
    originalLazyRegions: () => {
        for (const source of [
            'false && null.x', 'true || null.x', '0 ?? null.x', '-0 ?? null.x', 'NaN ?? null.x', '"" ?? null.x',
            'false ? (null.x || 1) : 9', 'true ? 9 : (null.x ?? 1)',
            'false && (()=>{const required=null.x;return 1;})()',
            'true || (()=>{throw 1;})()', 'true ?? (()=>{throw 1;})()',
            'null?.value(null.x || 1)', 'null?.[Number(null.x ?? 1)]',
        ]) { assertOk(evaluated(sourceGraph(`export default ${source};`))) }
        for (const source of [
            'null.x && 1', 'null.x || 1', 'null.x ?? 1', 'true && null.x', 'false || null.x', 'null ?? null.x', 'undefined ?? null.x',
            'true && (()=>{const required=null.x;return 1;})()', 'false || (()=>{throw 1;})()',
        ]) { assertError(evaluated(sourceGraph(`export default ${source};`))) }
        assertError(evaluated(sourceGraph('const required=null.x||1;export default 2;')))
        assertStructurallySame(sourceData('const value=9;export default ((value=3)=>value||2)(0);'), { default: 2 })
        assertStructurallySame(sourceData('export default (([value],other=null,...rest)=>[value||other,other??rest.length])([0],undefined,4);'), { default: [null, 1] })
    },
    primitiveUndefinedHygiene: () => {
        const binding = { index: 0 }
        const selected = logicalValue('??', ['ref', binding], 2)
        assert(selected instanceof Array && selected[0] === 'if')
        const condition = selected[1]
        assert(condition instanceof Array && condition[0] === 'if' && condition[3].exit[0] === 'yield')
        const comparison = condition[3].exit[1][0]
        assert(comparison instanceof Array && comparison[0] === '===')
        assertEq(comparison[2], undefined)
        assertError(parse('')('const undefined=1;export default null??undefined;'))
        for (const source of ['1 ?? 2 || 3', '1 && 2 ?? 3', '1 || 2 ?? 3']) { assertError(parse('')(`export default ${source};`)) }
    },
    deepSourceOperators: () => {
        const resolved = assertOk(parse('')('export default 1;'))
        /** @type {SourceValue} */
        let left = 1
        /** @type {SourceValue} */
        let right = 1
        for (let depth = 0; depth < 20_000; depth += 1) { left = ['&&', left, 1]; right = ['??', 1, right] }
        for (const [direction, value] of [/** @type {const} */ (['left', left]), /** @type {const} */ (['right', right])]) {
            const block = normalize({ ...resolved, body: { statements: [], exit: ['yield', value] } }, []).body
            assert(block.exit[0] === 'yield')
            let normalized = block.exit[1][0]
            let count = 0
            while (normalized instanceof Array && normalized[0] === 'block') {
                const definition = normalized[1].statements[0]
                assert(definition[0] === 'define')
                if (direction === 'left') { normalized = definition[2] }
                else {
                    const exit = normalized[1].exit
                    assert(exit[0] === 'yield')
                    const choice = exit[1][0]
                    assert(choice instanceof Array && choice[0] === 'if' && choice[2].exit[0] === 'yield')
                    normalized = choice[2].exit[1][0]
                }
                count += 1
            }
            assertEq(count, 20_000)
            assertEq(normalized, 1)
            let graph = fromFast(block)
            let graphCount = 0
            while (graph instanceof Array) {
                assertEq(graph[0], '?:')
                const choice = /** @type {readonly ['?:', Exp, Exp, Exp]} */ (graph)
                if (direction === 'left') { assertEq(choice[1], choice[3]); graph = choice[1] }
                else { graph = choice[2] }
                graphCount += 1
            }
            assertEq(graphCount, 20_000)
            assertEq(graph, 1)
        }
    },
    tailPositionValues: () => {
        assertStructurallySame(sourceData('const self=n=>n&&self(n-1);export default self(4);'), { default: 0 })
        assertStructurallySame(sourceData('const self=n=>n?self(n-1)||n:0;export default self(3);'), { default: 1 })
    },
}
