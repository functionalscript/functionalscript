/**
 * Template expressions through the parser's name resolution and existing
 * EDAG interpreter: chunk boundaries are preserved in the AST, while full
 * substitutions, nested templates and coercion evaluate as source expressions.
 *
 * @import { AstConst } from '../ast/types.ts'
 */

import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'

/** The parsed module's sole default expression. @type {(source: string) => AstConst} */
const expression = source => {
    const [, body] = assertOk(parseFromTokens(tokenizeString(`export default ${source};`)))
    const exported = body[body.length - 1]
    assert(exported instanceof Array && exported[0] === 'object')
    const [member] = exported[1]
    assert(member[0] === ':' && member[1] === 'default')
    return member[2]
}

/** A default value evaluated through the same represented interpreter as compiled source. @type {(source: string) => unknown} */
const evaluated = source => {
    const ast = assertOk(parseFromTokens(tokenizeString(`export default ${source};`)))
    const compiled = assertOk(analysis(unresolved(ast).edag))
    return assertOk(toData(assertOk(memo(compiled)({ args: [] }))))
}

export const proof = {
    chunks: () => {
        assertEq(expression('``'), '')
        assertEq(expression('`a\nb`'), 'a\nb')
        assertStructurallySame(expression('`a${1}b`'), ['+', ['+', 'a', ['String', 1]], 'b'])
        assertStructurallySame(expression('`${1}${2}`'), ['+', ['+', ['+', ['+', '', ['String', 1]], ''], ['String', 2]], ''])
        assertStructurallySame(expression('`${true}${null}${undefined}${2n}`'), ['+', ['+', ['+', ['+', ['+', ['+', ['+', ['+', '', ['String', true]], ''], ['String', null]], ''], ['String', undefined]], ''], ['String', 2n]], ''])
    },
    substitutions: () => {
        assertStructurallySame(evaluated('`a${1 + 2 * 3}b${false ? 0 : 4}c`'), { default: 'a7b4c' })
        assertStructurallySame(evaluated('`${({ a: { b: 2 } }).a.b}:${(() => { const x = 3; return x; })()}`'), { default: '2:3' })
        assertStructurallySame(evaluated('`outer${`inner${1}`}tail`'), { default: 'outerinner1tail' })
        assertStructurallySame(evaluated('`${true}:${null}:${undefined}:${2n}:${[1, 2]}:${{ a: 1 }}`'), { default: 'true:null:undefined:2:1,2:[object Object]' })
        assertStructurallySame(evaluated('((x) => `value:${x}`)(7)'), { default: 'value:7' })
    },
    primary: () => {
        assertStructurallySame(evaluated('`${1}`.length'), { default: 1 })
        assertStructurallySame(evaluated('-`2` + `3` ** 2'), { default: 7 })
        assertStructurallySame(evaluated('1 + `${2}`'), { default: '12' })
        assertStructurallySame(evaluated('typeof `${1}`'), { default: 'string' })
    },
    locatedRefusal: () => {
        for (const [source, column] of /** @type {const} */ ([
            ['export default tag`plain`;', 19],
            ['export default tag`${1}`;', 19],
            ['export default tag?.x`plain`;', 22],
            ['export default tag?.x`${1}`;', 22],
            ['export default tag?.()`plain`;', 23],
            ['export default `${}`;', 19],
            ['export default `${1 + }`;', 23],
            ['export default `${true ? : 1}`;', 26],
            ['export default `${1}`};', 22],
        ])) {
            const [tag, failure] = parseFromTokens(tokenizeString(source))
            assert(tag === 'error')
            assertEq(failure.message, 'unexpected token')
            assertEq(failure.metadata?.column, column)
        }
        const [tag, failure] = parseFromTokens(tokenizeString('export default `${missing}`;'))
        assert(tag === 'error')
        assertEq(failure.message, 'const not found')
        assertEq(failure.metadata?.column, 19)
    },
}
