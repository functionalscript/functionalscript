/** @import { AstModule } from '../../../compiler/ast/types.ts' */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { normalize } from './module.f.mjs'

export const proof = {
    identities: () => {
        const ast = assertOk(parse('')('const a = [1]; const b = a; export default [a, b];'))
        const fast = normalize(ast, [])
        const graph = /** @type {readonly ['{}', readonly (readonly [':', string, readonly ['[]', readonly unknown[]]])[]]} */ (fromFast(fast.body))
        const pair = graph[1][0][2][1]
        assert(pair[0] === pair[1])
        assertEq(fast.body.statements.length, 1)
    },
    blocks: () => {
        const ast = assertOk(parse('')('export default (() => { const x = [1]; return [x, x]; })();'))
        const fast = normalize(ast, [])
        assertStructurallySame(fromFast(fast.body), ['{}', [[':', 'default', ['[]', [['[]', [1]], ['[]', [1]]]]]]])
        const fn = normalize(assertOk(parse('')('export default a => { const b = a; return () => [a, b]; };')), [])
        assertStructurallySame(fromFast(fn.body), ['{}', [[':', 'default', ['=>', 1, [], ['=>', 0, [['arg', 0]], ['[]', [['frame', 0], ['frame', 0]]]]]]]])
    },
    imports: () => {
        const ast = assertOk(parse('')('import a from "./a"; import b from "./a"; export default a;'))
        const imported = ['same']
        const fast = normalize(ast, [imported, imported])
        assertStructurallySame(fromFast(fast.body, fast.parameters.map(id => [id, 1])), ['{}', [[':', 'default', 1]]])
    },
    throwing: () => {
        const ast = assertOk(parse('')('export default () => { throw 4; };'))
        assertStructurallySame(fromFast(normalize(ast, []).body), ['{}', [[':', 'default', ['=>', 0, [], ['throw', 4]]]]])
    },
    primitiveCapture: () => {
        const ast = /** @type {AstModule} */ ([[], [['object', [[':', 'default', ['()', ['=>', 0, [['fref', 0]], [null]], []]]]]]])
        assertStructurallySame(fromFast(normalize({ ast, scope: { target: { kind: 'function', index: 0 }, bindings: [], events: [] }, bindings: [], origins: [] }, []).body), ['{}', [[':', 'default', null]]])
    },
}
