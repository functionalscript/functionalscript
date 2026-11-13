/** Explicit octal source literals become the existing number and bigint values. */
import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { tryParse as parseDataJs } from '../../media/datajs/parser/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => import('./types.ts').ResolvedModule} */
const parsed = source => assertOk(parseFromTokens(tokenizeString(source)))

export const proof = /** @type {const} */ ({
    fastMatchesDecimalValues: () => {
        assertStructurallySame(normalize(parsed('export default [0o17,0O17n,0o7_7,-0o0,-0O17n];'), []),
            normalize(parsed('export default [15,15n,63,-0,-15n];'), []))
    },
    evaluationPreservesRoundingPrecisionAndNegativeZero: () => {
        const source = /** @type {const} */ ('export default [0o400000000000000001,0O400000000000000001n,-0o0,0o7_7];')
        assertStructurallySame(assertOk(toData(_evaluate(parsed(source)))), {
            default: [0x20_0000_0000_0000,0x20_0000_0000_0001n,-0,63],
        })
        const overflow = `export default 0o${'7'.repeat(400)};`
        assertStructurallySame(assertOk(toData(_evaluate(parsed(overflow)))), { default: Infinity })
    },
    numericKeysUseTheirDecodedValue: () => {
        assertStructurallySame(assertOk(toData(_evaluate(parsed('export default {0o17:"octal"}[15];')))), { default: 'octal' })
    },
    jsonAndDataJsKeepTheirOwnNumberGrammar: () => {
        assertError(parseJson('0o17'))
        assertError(parseDataJs('export default 0o17;'))
    },
    strictModeAndMalformedBoundariesRemainErrors: () => {
        for (const literal of ['017','08','09','017n','0o8','0o','0o_1','0o1_','0o1.2']) {
            assertError(parseFromTokens(tokenizeString(`export default ${literal};`)))
        }
        assertEq(assertError(parseFromTokens(tokenizeString('export default 0o8;'))).metadata?.column, 18)
    },
})
