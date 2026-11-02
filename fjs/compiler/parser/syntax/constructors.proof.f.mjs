/** Generic construction syntax retains operands, precedence and original tokens. */

/** @import { Node } from './types.ts' */

import { assert, assertEq, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => Node} */
const expression = source => assertNotNullish(assertOk(parseSyntax(tokenizeString(`export default ${source};`))).exported).value

export const proof = /** @type {const} */ ({
    operandsAndSourcePosition: () => {
        const source = /** @type {const} */ ('export default\nnew factories["Ctor"](first,...rest,);')
        const node = assertNotNullish(assertOk(parseSyntax(tokenizeString(source))).exported).value
        assert(node[0] === 'new')
        assertStructurallySame(node[3].metadata, { path: '', line: 2, column: 1 })
        assertEq(node[3].token.kind, 'id')
        assert(node[3].token.kind === 'id')
        assertEq(node[3].token.value, 'new')
        const callee = node[1]
        assert(callee[0] === '.' && callee[1][0] === 'ref' && !(callee[2] instanceof Array))
        assert(callee[1][1].token.kind === 'id' && callee[2].token.kind === 'string')
        assertEq(callee[1][1].token.value, 'factories')
        assertEq(callee[2].token.value, 'Ctor')
        const [first, spread] = node[2]
        assert(first[0] === 'ref' && spread[0] === '...' && spread[1][0] === 'ref')
        assert(first[1].token.kind === 'id' && spread[1][1].token.kind === 'id')
        assertEq(first[1].token.value, 'first')
        assertEq(spread[1][1].token.value, 'rest')
    },
    constructionAndCallPrecedence: () => {
        const called = expression('new namespace.Ctor(1)(2)')
        assert(called[0] === '()' && called[1][0] === 'new')
        const created = called[1]
        assert(created[1][0] === '.' && !(created[1][2] instanceof Array))
        assert(created[1][2].token.kind === 'id')
        assertEq(created[1][2].token.value, 'Ctor')
        assertStructurallySame(created[2], [['primitive', 1]])
        assertStructurallySame(called[2], [['primitive', 2]])
        const member = expression('new Ctor().value')
        assert(member[0] === '.' && member[1][0] === 'new')
        const grouped = expression('new (factory())(3)')
        assert(grouped[0] === 'new' && grouped[1][0] === '()')
        assertStructurallySame(grouped[2], [['primitive', 3]])
    },
    nestedAndGroupedCallees: () => {
        const nested = expression('new new Factory(1)(2)')
        assert(nested[0] === 'new' && nested[1][0] === 'new')
        assertStructurallySame(nested[2], [['primitive', 2]])
        assertStructurallySame(nested[1][2], [['primitive', 1]])
        const member = expression('new new Factory().Ctor()')
        assert(member[0] === 'new' && member[1][0] === '.' && member[1][1][0] === 'new')
        const comma = expression('new (left,right)()')
        assert(comma[0] === 'new' && comma[1][0] === ',')
        assertEq(comma[1][1].length, 2)
        const optional = expression('new (source?.Ctor).member()')
        assert(optional[0] === 'new' && optional[1][0] === '.' && optional[1][1][0] === '?.')
        const followed = expression('new Ctor()?.value')
        assert(followed[0] === '?.' && followed[1][0] === 'new')
    },
    unaryBinaryAndBodyPositions: () => {
        const negative = expression('-new Ctor()')
        assert(negative[0] === '-' && negative.length === 2 && negative[1][0] === 'new')
        const typed = expression('typeof new Ctor()')
        assert(typed[0] === 'typeof' && typed[1][0] === 'new')
        const sum = expression('1+new Ctor()**2')
        assert(sum[0] === '+' && sum[2][0] === '**' && sum[2][1][0] === 'new')
        const body = expression('x=>new factory.new({new:x})')
        assert(body[0] === '=>' && body[2][0] === 'new' && body[2][1][0] === '.')
        assert(!(body[2][1][2] instanceof Array) && body[2][1][2].token.kind === 'id')
        assertEq(body[2][1][2].token.value, 'new')
    },
    statementStartsAndDiscardTargets: () => {
        const module = assertOk(parseSyntax(tokenizeString('new Ctor().method();export default ()=>{new Ctor();while(false){new Ctor()();}return 0;};')))
        const first = module.statements[0]
        assert(first[0] === 'const' && first[1].declaration.target[0] === 'discard')
        assertEq(first[1].declaration.start.metadata.column, 1)
        assert(first[1].declaration.value[0] === '()')
        const fn = assertNotNullish(module.exported).value
        assert(fn[0] === '=>' && fn[2][0] === 'block')
        const [body, loop] = fn[2][1]
        assert(body[0] === 'const' && body[1].target[0] === 'discard' && body[1].value[0] === 'new')
        assert(loop[0] === 'while')
        const statement = loop[1].block[1][0]
        assert(statement[0] === 'const' && statement[1].target[0] === 'discard' && statement[1].value[0] === '()')
    },
})
