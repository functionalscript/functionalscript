/** @import { Exp } from '../../edag/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis, bindingError } from '../../edag/analysis/module.f.mjs'
import { vm } from '../../edag/amnesia/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { factories } from '../../edag/callable/table.f.mjs'
import { generate } from '../../edag/callable/generate/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { unresolved, resolve, _defaultExport } from '../edag/module.f.mjs'
import { tryStringify, tryModuleStringify } from '../serializer/module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => _defaultExport(unresolved(unwrap(parse('parameters.f.mjs')(source))).edag)

/** @type {readonly ((e: Exp) => any)[]} */
const evaluators = [vm({ frame: null, args: [] }), e => memo(analysis(e))({ frame: null, args: [] })]

/** @type {(source: string) => Exp} */
const roundTrip = source => {
    const e = graph(source)
    assertEq(bindingError(analysis(e)), null)
    const restored = graph(unwrap(tryStringify(e)))
    assertStructurallySame(analysis(restored), analysis(e))
    return restored
}

export const proof = {
    importsAndCaptures: () => {
        const root = {
            'main.f.mjs': [utf8('import a from "./a.f.mjs"; import b from "./b.f.mjs"; export default (x,...rest)=>(y)=>[a,b,x,rest,y];')],
            'a.f.mjs': [utf8('export default [1];')],
            'b.f.mjs': [utf8('export default [2];')],
        }
        const linked = unwrap(virtual({ ...emptyState, root })(resolve('main.f.mjs'))[1])
        assert(analysis(linked).nodes.every(n => n[0] !== 'args'))
        for (const run of evaluators) {
            const f = run(_defaultExport(linked))
            assertStructurallySame(f(3,4,5)(6), [[1],[2],3,[4,5],6])
        }
    },
    syntax: () => {
        for (const [parameters, body, length] of /** @type {const} */ ([
            ['()', '7', 0], ['(...x)', 'x', 0], ['a', 'a', 1], ['(a)', 'a', 1],
            ['(a,)', 'a', 1], ['(a,b,c)', '[a,b,c]', 3], ['(a,b,c,)', '[a,b,c]', 3],
            ['(a,b,c,...x)', '[a,b,c,x]', 3], ['(a, /*x*/ b,\n...x)', '[a,b,x]', 2],
        ])) {
            const e = roundTrip(`export default ${parameters} => ${body};`)
            for (const run of evaluators) { assertEq(run(e).length, length) }
        }
        roundTrip('export default (a, b, ...x) => { const y = [a,b]; return [y,x]; };')
    },
    binding: () => {
        const e = roundTrip('export default (a,b,c,...x)=>[a,b,c,x];')
        assertStructurallySame(e, ['=>', 3, null, ['[]', [['arg', 0], ['arg', 1], ['arg', 2], ['rest']]]])
        /** @type {(a?: unknown, b?: unknown, c?: unknown, ...x: readonly unknown[]) => readonly unknown[]} */
        const native = (a, b, c, ...x) => [a,b,c,x]
        for (const run of evaluators) {
            const f = run(e)
            for (const args of [[], [undefined], [1], [1,2], [1,2,3], [1,2,3,undefined], [-0,2,3,4,5]]) {
                assertStructurallySame(f(...args), native(args[0], args[1], args[2], ...args.slice(3)))
            }
        }
    },
    capturesAndIdentity: () => {
        const e = roundTrip('export default (a,...x)=>(b,...y)=>[a,x,b,y,x,y];')
        for (const run of evaluators) {
            const f = run(e)
            const one = f(1,2,3)
            const two = f(1,2,3)
            assertEq(f.length, 1)
            assertEq(one.length, 1)
            assert(one !== two)
            const a = one(4,5)
            const b = one(6)
            const c = two(4,5)
            assertStructurallySame(a, [1,[2,3],4,[5],[2,3],[5]])
            assert(a[1] === a[4] && a[3] === a[5])
            assert(a[1] === b[1] && a[3] !== b[3] && a[1] !== c[1])
        }
    },
    generatedTable: () => {
        const table = unresolved(unwrap(parse('table.f.mjs')(generate(32)))).edag
        for (const run of evaluators) {
            const { factories: compiled } = run(table)
            for (const [length, factory] of compiled.entries()) {
                const f = factory((/** @type {unknown} */ fixed, /** @type {unknown} */ rest) => [fixed, rest])
                assertEq(f.length, length)
                assertStructurallySame(f(1,2,3), [Array.from({ length }, (_, i) => [1,2,3][i]), [1,2,3].slice(length)])
            }
        }
    },
    capacity: () => {
        const length = factories.length
        const parameters = Array.from({ length }, (_, i) => `a${i}`).join(',')
        const e = roundTrip(`export default (${parameters},...x)=>x;`)
        assert(e instanceof Array && e[0] === '=>')
        assertEq(e[1], length)
    },
    refusals: () => {
        for (const params of [
            '(a,a)', '(a,a,b)', '(a,...a)', '(a,...x,)', '(a,...x,b)', '(a,...x,...y)',
            '(a,,b)', '(a=1)', '([a])', '({a})', '(a.b)', '((a))', '(a+b)',
            '(a,1)', '(a,(b))', '(a,await)', '(a,undefined)', '(a,return)',
            '(a)\n', 'a\n', '(a)/*\n*/', '(a,...x)\n',
        ]) { assertEq(parse('bad.f.mjs')(`export default ${params}=>1;`)[0], 'error', params) }
        assertEq(parse('bad.f.mjs')('export default (a,...x)=>{const a=1;return a;};')[0], 'error')
    },
    writerRefusesModuleBinding: () => {
        assertEq(tryModuleStringify(['{}', [[':', 'f', ['=>', 1, null, ['args']]]]])[0], 'error')
    },
    throw: {
        metadata: [-0,-1,0.5,Infinity,NaN].map(length => () => analysis(['=>',length,null,1])),
        capacity: evaluators.map(run => () => run(['=>',factories.length,null,1])),
        arg: evaluators.map(run => () => run(['=>',1,null,['arg',1]])()),
        moduleRest: evaluators.map(run => () => run(['rest'])),
        functionArgs: evaluators.map(run => () => run(['=>',1,null,['args']])()),
    },
}
