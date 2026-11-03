/** Number literal keys reuse computed-key graphs and the existing binding policy. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { expectRefused, stringifyModule, tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => ReturnType<typeof stringifyModule>} */
const graph = source => stringifyModule(assertOk(parseFromTokens(tokenizeString(source))))

export const proof = /** @type {const} */ ({
    usesTheExistingComputedKeyGraph: () => {
        for (const literal of ['0', '1.5', '0x70', '0b11', '1_000', '1e2', '9_007_199_254_740_993', '1e309']) {
            assertEq(graph(`export default { ${literal}: 'a' };`), graph(`export default { [${literal}]: 'a' };`), literal)
        }
    },
    preservesTheNumericFastOperand: () => {
        const parsed = assertOk(parseFromTokens(tokenizeString('export default { 0x70: "a" };')))
        const computed = assertOk(parseFromTokens(tokenizeString('export default { [0x70]: "a" };')))
        assertStructurallySame(normalize(parsed, []), normalize(computed, []))
        assertEq(graph('export default { 0x70: "a" };'), '["{}",[[":","default",["{}",[[":",112,"a"]]]]]]')
    },
    numericPatternKeysUseExistingLiteralReads: () => {
        for (const [bare, computed] of [
            ['const { 0: value } = { 0: 7 }; export default value;', 'const { [0]: value } = { [0]: 7 }; export default value;'],
            ['export default ({ 0x70: value = 3 }) => value;', 'export default ({ [0x70]: value = 3 }) => value;'],
            ['const { 0: { 1: value = 4 } = {} } = {}; export default value;', 'const { [0]: { [1]: value = 4 } = {} } = {}; export default value;'],
        ]) { assertEq(graph(bare), graph(computed), bare) }
    },
    prototypeAndBindingChecksRemainInForce: () => {
        const proto = /** @type {const} */ ('export default { 0: 1, __proto__: null };')
        expectRefused(proto, '__proto__ requires the computed key form', proto.indexOf('__proto__') + 1)
        const duplicate = /** @type {const} */ ('export default ({ 0: value, 1: value }) => value;')
        expectRefused(duplicate, 'duplicate id', duplicate.indexOf('value })') + 1)
        const future = /** @type {const} */ ('export default ({ 0: a = b, 1: b }) => a;')
        expectRefused(future, 'const not found', future.indexOf('b,') + 1)
        const self = /** @type {const} */ ('export default ({ 0: a = a }) => a;')
        expectRefused(self, 'const not found', self.indexOf('a })') + 1)
    },
    otherKeySyntaxPoliciesRemainSeparate: () => {
        for (const source of [
            'export default { 1n: 0 };',
            'export default { -1: 0 };',
            'import value from "./data.json" with { 0: "json" }; export default value;',
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
        const pattern = /** @type {const} */ ('const key = 0; const { [key]: value } = {}; export default value;')
        expectRefused(pattern, 'computed key in a binding pattern not supported', pattern.indexOf('key]:') + 1)
    },
})
