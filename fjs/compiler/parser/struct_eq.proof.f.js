import { assert, assertEq, assertOk } from '../../asserts/module.f.js'
import { vm } from '../../edag/amnesia/module.f.js'
import { parse } from '../transpiler/module.f.js'
import { structEqSource } from '../../types/object/struct_eq/source.f.js'
import { _helperText } from '../../js/ast/serializer/intrinsic/module.f.js'
import { compile, execute, expectEdag } from '../edag/proof.f.js'

export const proof = /** @type {const} */ ({
    pattern: () => {
        const renamed = structEqSource.replaceAll('structEq', 'compare').replaceAll('pending', 'todo')
        expectEdag(compile(`${renamed}\nexport default compare`).edag, ['structEq'])
        const text = _helperText('structEq')('helper')
        expectEdag(compile(`export default ${text}`).edag, ['structEq'])
        const changed = structEqSource.replace('left.length !== right.length', 'left.length === right.length')
        const graph = compile(`${changed}\nexport default structEq`).edag
        assert(graph instanceof Array && graph[0] === '=>')
        const extra = structEqSource.replace('return true', 'const used = 1; return true')
        const ordinary = compile(`${extra}\nexport default structEq`).edag
        assert(ordinary instanceof Array && ordinary[0] === '=>')
        const shadowed = `export default Object => {
${structEqSource}
return structEq }`
        assertEq(parse('')(shadowed)[0], 'error')
        const invalid = structEqSource.replace('return true', 'return\ntrue')
        assertEq(parse('')(`${invalid}\nexport default structEq`)[0], 'error')
    },
    execution: () => {
        const graph = compile(`${structEqSource}\nconst alias = structEq; export default alias([{ x: NaN }], [{ x: NaN }]);`).edag
        assertEq(execute(graph), true)
        assertEq(assertOk(vm({ frame: [], args: [] })(graph)), true)
    },
})
