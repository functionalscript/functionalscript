/** Numeric object keys preserve computed-key execution and all existing outputs. */

import { assertEq } from '../asserts/module.f.js'
import { compileSource, fjsRoundTrip, moduleRefused } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    numericLiteralSpellingsUseTheirNumberValue: () => {
        const source = /** @type {const} */ (`
            const value = { 0: 'zero', 1.5: 'fraction', 0x70: 'hex', 0b11: 'binary', 1_000: 'separator', 1e2: 'exponent', 9_007_199_254_740_993: 'rounded', 1e309: 'overflow' };
            export default [value['0'], value['1.5'], value['112'], value['3'], value['1000'], value['100'], value['9007199254740992'], value['Infinity']];
        `)
        assertEq(compileSource(source)('output.json'), '["zero","fraction","hex","binary","separator","exponent","rounded","overflow"]')
    },
    duplicateCanonicalKeysKeepTheLastValue: () => {
        assertEq(compileSource('export default { 0x70: 1, 112: 2, "112": 3, [112]: 4 };')('output.json'), '{"112":4}')
        assertEq(compileSource('export default { 1e2: "first", 100: "second", 0b1100100: "last" };')('output.json'), '{"100":"last"}')
    },
    memberValuesRetainTheirEvaluationOrder: () => {
        const source = /** @type {const} */ (`
            const make = () => {
                let count = 0;
                const value = {
                    0: (() => { count += 1; return count; })(),
                    1: (() => { count += 10; return count; })(),
                    0: (() => { count += 100; return count; })(),
                };
                return [count, value[0], value[1]];
            };
            export default make();
        `)
        assertEq(compileSource(source)('output.json'), '[111,111,11]')
    },
    anOverwrittenInitializerStillRuns: () => {
        assertEq(moduleRefused('export default { 0x70: null.x, 112: "last" };'), 'input.f.js - error: module initialization failed')
        assertEq(moduleRefused('const value = { 0: null.x }; export default 9;'), 'input.f.js - error: module initialization failed')
    },
    numericPatternsRetainDefaultsAndFunctionLength: () => {
        const source = /** @type {const} */ (`
            const { 0x70: first, 1: { 2: nested = 4 } = {} } = { 112: 7 };
            const choose = ({ 0: value = 5 }) => value;
            const optional = ({ 0: value = 6 } = {}) => value;
            export default [first, nested, choose.length, optional.length, choose({}), choose({ 0: undefined }), choose({ 0: null }), optional()];
        `)
        assertEq(compileSource(source)('output.json'), '[7,4,1,0,5,5,null,6]')
    },
    generatedOutputsReuseComputedKeyLowering: () => {
        const bare = /** @type {const} */ ('export default (value) => ({ 0x70: value });')
        const computed = /** @type {const} */ ('export default (value) => ({ [0x70]: value });')
        for (const extension of ['output.js', 'output.f.js', 'output.edag.data.js', 'output.rs']) {
            assertEq(compileSource(bare)(extension), compileSource(computed)(extension), extension)
        }
        assertEq(compileSource('export default { 0x70: "a" };')('output.json'), '{"112":"a"}')
        assertEq(compileSource('export default { 0x70: "a" };')('output.data.js'), 'export default {"112":"a"};')
    },
    emittedSourceParsesAndSerializesAgain: () => {
        for (const source of [
            'export default { 0x70: "a", 0b11: "b" };',
            'export default value => ({ 0: value, 1: value });',
            'export default ({ 0x70: value = 3 }) => ({ 0: value });',
        ]) {
            const first = fjsRoundTrip(source)
            assertEq(fjsRoundTrip(first), first)
        }
    },
})
