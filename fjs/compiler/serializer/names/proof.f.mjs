import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { _name as name, _binding as binding, _resolve as resolve, _arg as arg, _rest as rest, _parameters as parameters } from './module.f.mjs'

export const proof = {
    manyBindings: () => {
        const references = Array.from({ length: 20_000 }, (_, i) => name(`binding${i}`))
        assertEq(resolve([references.map(binding).join(',')]).join(''),
            references.map((_, i) => `$${i}`).join(','))
    },
    order: () => {
        const a = name('outer/const0')
        const b = name('inner/arg0')
        assertStructurallySame(resolve([`const ${binding(a)}=`, `(${binding(b)})=>${a}+${b}`, ';']),
            ['const $0=', '($1)=>$0+$1', ';'])
        assertEq(resolve([`${binding(b)}=${a};${binding(a)}=1;`]).join(''), '$0=$1;$1=1;')
        assertEq(resolve([`${binding(a)}=1;${a}`]).join(''), '$0=1;$0')
    },
    reserved: () => {
        const a = name('a')
        const b = name('b')
        assertEq(resolve([`${binding(a)},${binding(b)}`], ['$0', '$1', '$3']).join(''), '$2,$4')
        assertEq(resolve([`${binding(a)}`], ['$99']).join(''), '$0')
        assertEq(resolve([`${binding(a)},${binding(b)}`],
            Array.from({ length: 10_000 }, (_, i) => `$${9999 - i}`)).join(''), '$10000,$10001')
    },
    external: () => {
        const a = name('capture0')
        const b = name('capture1')
        const c = name('arg0')
        assertEq(resolve([`(${binding(c)})=>${b}+${c}`], [], [a, b]).join(''), '($2)=>$1+$2')
        assertEq(resolve([a], [], [a, a]).join(''), '$0')
    },
    data: () => {
        assertEq(resolve(['"\\u0000!binding\\u0000"']).join(''), '"\\u0000!binding\\u0000"')
        assertEq(resolve(['"$0",{"$a":1}']).join(''), '"$0",{"$a":1}')
        assertEq(resolve([]).join(''), '')
    },
    marked: () => {
        const a = name('a')
        // a marked chunk keeps its kind, and a symbol in its text is resolved
        assertStructurallySame(resolve([[`${binding(a)}`, 'string'], [a], [`x${a}`], 'y']), [['$0', 'string'], ['$0'], ['x$0'], 'y'])
    },
    parameters: () => {
        // `(a, b, ...c) => c`: the rest parameter is declared where the body reads it
        const withRest = assertOk(analysis(['=>', 2, [], ['rest']]))
        assertEq(resolve([`(${parameters(withRest, 'f', 1, 2)})=>${rest('f')}`]).join(''), '($0,$1,...$2)=>$2')
        // `(a) => a`: and not where it does not
        const fixed = assertOk(analysis(['=>', 1, [], ['arg', 0]]))
        assertEq(resolve([`(${parameters(fixed, 'f', 1, 1)})=>${arg('f', 0)}`]).join(''), '($0)=>$0')
        // `() => 1`: no parameters at all
        const none = assertOk(analysis(['=>', 0, [], 1]))
        assertEq(resolve([`(${parameters(none, 'f', 0, 0)})=>1`]).join(''), '()=>1')
        // a read is the name its function's list declares, and no other function's
        assertEq(resolve([`${binding(arg('f', 1))},${binding(arg('g', 1))},${arg('f', 1)}`]).join(''), '$0,$1,$0')
    },
    throw: {
        missing: () => resolve([name('missing')]),
    },
}
