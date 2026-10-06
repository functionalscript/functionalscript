/**
 * @import { Exp } from '../../edag/types.ts'
 * @import { EdagValue, Values } from '../../edag/value/types.ts'
 * @import { Invoke } from '../../edag/value/call/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis, bindingError } from '../../edag/analysis/module.f.mjs'
import { vm, invoke as amnesiaInvoke } from '../../edag/amnesia/module.f.mjs'
import { invoke, memo } from '../../edag/memo/module.f.mjs'
import { call } from '../../edag/value/call/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { toUnknown } from '../../edag/value/to_unknown/module.f.mjs'
import { isArray } from '../../types/array/module.f.mjs'
import { maxLength } from '../../types/function/length/module.f.mjs'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { unresolved, resolve, _defaultExport } from '../edag/module.f.mjs'
import { tryStringify, tryModuleStringify } from '../serializer/module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => _defaultExport(unresolved(unwrap(parse('parameters.f.mjs')(source))).edag)

/** @type {(e: Exp) => EdagValue} */
const interpret = e => unwrap(memo(assertOk(analysis(e)))({ args: [] }))

/** @type {(value: EdagValue) => Values} */
const elements = value => {
    assert(isArray(value) && value[0] === '[]')
    return value[1]
}

/** @type {(source: string) => Exp} */
const roundTrip = source => {
    const e = graph(source)
    assertEq(bindingError(assertOk(analysis(e))), null)
    const restored = graph(unwrap(tryStringify(e)))
    assertStructurallySame(assertOk(analysis(restored)), assertOk(analysis(e)))
    return restored
}

/** The compiler's parameter contract holds under both execution models.
 * @type {(interpret: (e: Exp) => EdagValue, invoke: Invoke) => object}
 */
const forInterpreter = (interpret, invoke) => {
    /** @type {(fn: EdagValue, args: Values) => EdagValue} */
    const apply = (fn, args) => assertOk(call(ok(fn), args.map(arg => () => ok(arg)), invoke))
    return {
        importsAndCaptures: () => {
            const root = {
                'main.f.mjs': [utf8('import a from "./a.f.mjs"; import b from "./b.f.mjs"; export default (x,...rest)=>(y)=>[a,b,x,rest,y];')],
                'a.f.mjs': [utf8('export default [1];')],
                'b.f.mjs': [utf8('export default [2];')],
            }
            const linked = unwrap(virtual({ ...emptyState, root })(resolve('main.f.mjs'))[1])
            assert(assertOk(analysis(linked)).nodes.every(n => n[0] !== 'args'))
            const e = _defaultExport(linked)
            const represented = apply(apply(interpret(e), [3,4,5]), [6])
            assertStructurallySame(assertOk(toUnknown(represented)), [[1],[2],3,[4,5],6])
        },
        syntax: () => {
            for (const [parameters, body, length] of /** @type {const} */ ([
                ['()', '7', 0], ['(...x)', 'x', 0], ['a', 'a', 1], ['(a)', 'a', 1],
                ['(a,)', 'a', 1], ['(a,b,c)', '[a,b,c]', 3], ['(a,b,c,)', '[a,b,c]', 3],
                ['(a,b,c,...x)', '[a,b,c,x]', 3], ['(a, /*x*/ b,\n...x)', '[a,b,x]', 2],
            ])) {
                const e = roundTrip(`export default ${parameters} => ${body};`)
                assertEq(assertOk(read(ok(interpret(e)), 'length')), length)
            }
            roundTrip('export default (a, b, ...x) => { const y = [a,b]; return [y,x]; };')
        },
        binding: () => {
            const e = roundTrip('export default (a,b,c,...x)=>[a,b,c,x];')
            assertStructurallySame(e, ['=>', 3, [], ['[]', [['arg', 0], ['arg', 1], ['arg', 2], ['rest']]]])
            /** @type {(a?: unknown, b?: unknown, c?: unknown, ...x: readonly unknown[]) => readonly unknown[]} */
            const native = (a, b, c, ...x) => [a,b,c,x]
            const represented = interpret(e)
            for (const args of [[], [undefined], [1], [1,2], [1,2,3], [1,2,3,undefined], [-0,2,3,4,5]]) {
                const expected = native(args[0], args[1], args[2], ...args.slice(3))
                // These fixtures contain only numbers and undefined; no host
                // containers or callbacks cross into the interpreter.
                const values = args.map(arg => arg === undefined ? /** @type {const} */ (['undefined']) : arg)
                assertStructurallySame(assertOk(toUnknown(apply(represented, values))), expected)
            }
        },
        capturesAndIdentity: () => {
            const e = roundTrip('export default (a,...x)=>(b,...y)=>[a,x,b,y,x,y];')
            const represented = interpret(e)
            const first = apply(represented, [1,2,3])
            const second = apply(represented, [1,2,3])
            assertEq(assertOk(read(ok(represented), 'length')), 1)
            assertEq(assertOk(read(ok(first), 'length')), 1)
            assert(first !== second)
            const av = apply(first, [4,5])
            const bv = elements(apply(first, [6]))
            const cv = elements(apply(second, [4,5]))
            assertStructurallySame(assertOk(toUnknown(av)), [1,[2,3],4,[5],[2,3],[5]])
            const aa = elements(av)
            assert(aa[1] === aa[4] && aa[3] === aa[5])
            assert(aa[1] === bv[1] && aa[3] !== bv[3] && aa[1] !== cv[1])
        },
        factoryTable: () => {
            // The table's first entries, spelled as `fjs/types/function/length` spells them; `lengthLimit` covers its width.
            const table = unresolved(unwrap(parse('factories.f.mjs')([
                'export const factories = [',
                '    g => (...rest) => g([], rest),',
                '    g => (a0, ...rest) => g([a0], rest),',
                '    g => (a0, a1, ...rest) => g([a0, a1], rest),',
                '];',
            ].join('\n')))).edag
            // Interpreted calls receive represented callbacks. Ordinary runtime
            // callbacks belong at the separate runtime-compilation boundary.
            const callback = interpret(graph('export default (fixed, rest) => [fixed, rest];'))
            const factories = elements(assertOk(read(ok(interpret(table)), 'factories')))
            assertEq(factories.length, 3)
            for (const [length, factory] of factories.entries()) {
                const f = apply(factory, [callback])
                assertEq(assertOk(read(ok(f), 'length')), length)
                assertStructurallySame(assertOk(toUnknown(apply(f, [1,2,3]))), [Array.from({ length }, (_, i) => [1,2,3][i]), [1,2,3].slice(length)])
            }
        },
        lengthLimit: () => {
            /** @type {(length: number) => string} */
            const source = length => `export default (${Array.from({ length }, (_, i) => `a${i},`).join('')}...x)=>x;`
            const e = roundTrip(source(maxLength))
            assert(e instanceof Array && e[0] === '=>')
            assertEq(e[1], maxLength)
            assertEq(assertOk(read(ok(interpret(e)), 'length')), maxLength)
            assertEq(parse('bad.f.mjs')(source(maxLength + 1))[0], 'error')
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
            assertEq(tryModuleStringify(['{}', [[':', 'f', ['=>', 1, [], ['args']]]]])[0], 'error')
        },
        invalidLengthMetadata: () => {
            for (const length of [-0,-1,0.5,Infinity,NaN]) {
                assertEq(assertError(analysis(['=>',length,[],1])), 'invalid function length')
            }
        },
    }
}

export const proof = {
    amnesia: forInterpreter(e => assertOk(vm({ frame: [], args: [] })(e)), amnesiaInvoke),
    memo: forInterpreter(interpret, invoke),
    // Memo's public entry admits complete analyzed graphs. Amnesia instead
    // trusts the supplied graph and contextual bindings, like its dispatcher.
    throw: {
        overLimit: () => interpret(['=>',maxLength + 1,[],1]),
        arg: () => interpret(['=>',1,[],['arg',1]]),
        moduleRest: () => interpret(['rest']),
        functionArgs: () => interpret(['=>',1,[],['args']]),
    },
}
