/**
 * Groups are decided on resolved identities, before FAST builds captures.
 * @import { ResolvedModule } from '../types.ts'
 */
import { parseFromTokens } from '../module.f.js'
import { tokenizeString, expectRefused } from '../proof.f.js'
import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'

/** @type {(source: string) => ResolvedModule} */
const parsed = source => assertOk(parseFromTokens(tokenizeString(source)))

export const proof = {
    moduleGroups: () => {
        const source = parsed('const p=()=>0; export const a=()=>b,b=()=>c,c=()=>a; const x=()=>y; const y=()=>[x,p]; export default x')
        const groups = source.groups ?? []
        assertStructurallySame(groups.map(group => group.length), [3, 2])
    },
    nestedCaptures: () => {
        const source = parsed('export default n => { const a = () => () => [b,n]; const b = (x=a) => x; return [a,b] }')
        assertEq(source.groups?.[0].length, 2)
        const shadowed = parsed('const a = b => b; const b = () => a; export default b')
        assertEq(shadowed.groups, undefined)
        const local = parsed('const b=()=>{ const a=()=>b; const b=()=>a; return a }; export default b')
        assertEq(local.groups?.[0].length, 2)
    },
    localGroupsInsideModuleGroups: () => {
        const source = parsed('const a = () => { const x=()=>[y,b]; const y=()=>x; return x }; const b=()=>a; export default b')
        assertStructurallySame(source.groups?.map(group => group.length), [2, 2])
    },
    refusals: () => {
        expectRefused('const a = () => b; const b = () => 1; export default a', 'const not found', 17)
        expectRefused('const a = () => b; const x = a(); const b = () => a; export default x', 'const not found', 17)
        expectRefused('const a = () => b; const b = () => a; const b = () => a; export default b', 'duplicate id', 45)
        expectRefused('const a = () => c; const b = () => a; const c = () => a; export default a', 'const not found', 17)
        expectRefused('const a = () => [b,c]; const b = () => a; const c = () => 0; export default a', 'const not found', 18)
        expectRefused('export default () => { const a=()=>b; const b=()=>1; return a }', 'const not found', 36)
        expectRefused('const f = () => g; let g = () => f; export default g', 'const not found', 17)
    },
}
