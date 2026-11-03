import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parseSyntax } from '../syntax/module.f.mjs'
import { tokenizeString } from '../proof.f.mjs'
import { declarations } from './module.f.js'

/** @type {(source: string) => import('../syntax/types.ts').Const} */
const written = source => {
    const first = assertOk(parseSyntax(tokenizeString(source))).statements[0]
    assert(first[0] === 'const')
    return first[1].declaration
}

export const proof = {
    singleDeclarationKeepsItsRecord: () => {
        const first = written('const a=1;export default a;')
        assertEq(declarations(first)[0], first)
        const empty = { ...first, following: [] }
        assertEq(declarations(empty)[0], empty)
    },
    groupedSeparatorsKeepTheWrittenEnd: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['const a=1,b=a,c=b;export default c;', [true,true,true]],
            ['const a=1,b=a,c=b\nexport default c;', [true,true,false]],
        ])) {
            const group = written(source)
            assertEq(group.following?.length, 2)
            const expanded = declarations(group)
            assertStructurallySame(expanded.map(declaration => declaration.semicolon), expected)
            assertEq(expanded[0].following, undefined)
            assertEq(group.following?.length, 2)
            assertStructurallySame(expanded.map(declaration => declaration.start.metadata.column), [1,10,14])
        }
    },
}
