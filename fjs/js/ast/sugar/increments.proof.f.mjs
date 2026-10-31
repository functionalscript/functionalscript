/** Increment statements retain source binding checks and lower in AST sugar. */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { unresolved } from '../../../compiler/edag/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'

/** @param {string} source */
const evaluate = source => memo(assertOk(analysis(unresolved(assertOk(parse('/increments.f.js')(source))).edag)))({ args: [] })

export const proof = /** @type {const} */ ({
    sourceRetainsIncrement: () => {
        for (const update of ['++i', 'i++']) {
            const ast = assertOk(parse('/increments.f.js')(`let i=0;${update};export default i;`))
            const statement = ast.body.statements[1]
            assertEq(statement[0], 'increment')
            assertEq(statement[1], ast.bindings[0].id)
        }
    },
    increments: () => {
        for (const update of ['++i', 'i++']) {
            for (const initial of ['0', '-2', '"a"']) {
                const source = `let i=${initial};${update};export default i;`
                const expanded = `let i=${initial};i=i+1;export default i;`
                assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), assertOk(toData(assertOk(evaluate(expanded)))))
            }
            for (const source of [
                `let i=0;for(;i<3;${update}){}export default i;`,
                `export default (()=>{let i=0;while(i<3){${update};}return i;})();`,
                `export default ((i)=>{if(true){${update};return i;}return i;})(2);`,
            ]) { assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: 3 }, source) }
            assertStructurallySame(assertOk(toData(assertOk(evaluate(`let i=0\n${update}\nexport default i`)))), { default: 1 })
        }
    },
    commentsAndNewlines: () => {
        for (const source of [
            'let i=0;i/* comment */++;export default i;',
            'let i=0;++\ni;export default i;',
            'let i=0;i++\n++i;export default i-1;',
            'let from=0;from++;export default from;',
            'let as=0;as++;export default as;',
        ]) { assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: 1 }, source) }
    },
    refused: () => {
        for (const update of ['++i', 'i++']) {
            for (const source of [
                `const i=0;${update};export default i;`,
                `${update};export default 0;`,
                `${update};let i=0;export default i;`,
                `let i=0;const f=()=>i;${update};export default f;`,
                `let i=0;export default ${update};`,
                `let i=0;const x=${update};export default x;`,
                `let i=0;export default (x=>x)(${update});`,
                `let i=0;export default ()=>{return ${update};};`,
            ]) { assertEq(parse('/increments.f.js')(source)[0], 'error', source) }
        }
        for (const source of [
            'let i=0;i\n++;export default i;',
            'let i=0;i++ + 1;export default i;',
            'let i={x:0};i.x++;export default i;',
            'let i={x:0};++i.x;export default i;',
        ]) { assertEq(parse('/increments.f.js')(source)[0], 'error', source) }
    },
    throw: {
        bigintUsesNumberOne: () => { assertOk(evaluate('let i=0n;i++;export default i;')) },
    },
})
