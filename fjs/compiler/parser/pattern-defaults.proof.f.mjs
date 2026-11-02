/** Source admission and graph lowering for defaults inside binding patterns. */

import { _evaluate, expectModule, expectRefused, tokenizeString } from './proof.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'

/** @type {(source: string) => unknown} */
const evaluated = source => assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source))))))

export const proof = {
    bindingDefaultsAreNotValueExpressions: () => {
        for (const source of [
            'export default { a = 1 };',
            'export default [a = 1];',
            'export default { key: a = 1 };',
        ]) {
            expectRefused(source, 'unexpected token', source.indexOf('=') + 1)
        }
    },
    objectDefaultLowersToUndefinedSelection: () => {
        expectModule('export default ({ a = 5 }) => a;', '["{}",[[":","default",["=>",1,[],["?:",["===",[".",["arg",0],"a"],["undefined"]],5,[".",["arg",0],"a"]]]]]]')
    },
    declarationBindingsKeepTheirOriginalIdentities: () => {
        assertStructurallySame(evaluated('let { a = 2, b = a } = {}; a += 3; export default [a, b];'), { default: [5, 2] })
    },
    selectedFallbackWritesAndSkippedFallbackDoesNot: () => {
        assertStructurallySame(evaluated(`
            const f = o => {
                let { a = 1, b = (() => { a = 2; return 3; })() } = o;
                return [a, b];
            };
            export default [f({}), f({ a: 4 }), f({ b: 9 })];
        `), { default: [[2, 3], [2, 3], [1, 9]] })
    },
    loopDeclarationsInitializeOnEachIteration: () => {
        assertStructurallySame(evaluated(`
            const f = n => {
                let total = 0;
                for (let { index = 0 } = {}; index < n; index += 1) {
                    const [step = 2] = [];
                    total += step;
                }
                return total;
            };
            export default [f(0), f(3)];
        `), { default: [0, 6] })
    },
    followingParametersAndRestKeepTheirPositions: () => {
        assertStructurallySame(evaluated('const f = ({ a = 1 }, b, ...rest) => [a, b, rest]; export default [f.length, f({}, 2, 3)];'), { default: [2, [1, 2, [3]]] })
    },
    explicitUndefinedAndEmptyPatternDefaults: () => {
        assertStructurallySame(evaluated('const { a = undefined, nested: {} = {} } = {}; export default a === undefined;'), { default: true })
    },
    functionWrittenAsFallbackHasItsOwnParameters: () => {
        assertStructurallySame(evaluated('const { f = ({ a = 3 } = {}) => a } = {}; export default [f.length, f(), f({ a: 7 })];'), { default: [0, 3, 7] })
    },
    bindingLegality: () => {
        const duplicate = 'export default ({ a = 1, source: a = 2 }) => a;'
        expectRefused(duplicate, 'duplicate id', duplicate.indexOf('a = 2') + 1)
        const reserved = 'const { a: if = 1 } = {}; export default 0;'
        expectRefused(reserved, 'reserved word', reserved.indexOf('if') + 1)
        const prohibited = 'const { toString = 1 } = {}; export default 0;'
        expectRefused(prohibited, 'prohibited property name', prohibited.indexOf('toString') + 1)
    },
    futureAndSelfReferences: () => {
        const self = 'export default ({ a = a }) => a;'
        expectRefused(self, 'const not found', self.indexOf('a })') + 1)
        const future = 'export default ({ a = b, b }) => a;'
        expectRefused(future, 'const not found', future.indexOf('b,') + 1)
        const local = 'const { a = b, b } = {}; export default a;'
        expectRefused(local, 'const not found', local.indexOf('b,') + 1)
    },
    futureReferencesDoNotCaptureAnOuterName: () => {
        const parameter = 'const b = 9; export default ({ a = b, b }) => a;'
        expectRefused(parameter, 'capture shadowed', parameter.indexOf('b })') + 1)
        const local = 'const b = 9; export default () => { const { a = b, b } = {}; return a; };'
        expectRefused(local, 'capture shadowed', local.indexOf('b }') + 1)
        const self = 'const a = 9; export default ({ a = a }) => a;'
        expectRefused(self, 'capture shadowed', self.indexOf('a = a') + 1)
    },
    writeAndCapturePolicy: () => {
        const source = 'export default ({ a = 1 }) => { const read = () => a; a = 2; return read(); };'
        expectRefused(source, 'reassigned variable captured', source.indexOf('a;') + 1)
    },
}
