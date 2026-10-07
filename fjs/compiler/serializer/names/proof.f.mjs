import { assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { _name as name, _binding as binding, _resolve as resolve } from './module.f.mjs'

export const proof = {
    manyBindings: () => {
        const references = Array.from({ length: 20000 }, (_, i) => name(`binding${i}`))
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
            Array.from({ length: 10000 }, (_, i) => `$${9999 - i}`)).join(''), '$10000,$10001')
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
    throw: {
        missing: () => resolve([name('missing')]),
    },
}
