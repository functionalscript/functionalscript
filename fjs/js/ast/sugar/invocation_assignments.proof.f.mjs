/**
 * Direct literal callees read mutable enclosing bindings at invocation, after
 * their arguments have established the latest immutable versions.
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { unresolved } from '../../../compiler/edag/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'

/** @param {string} source */
const evaluate = source => memo(assertOk(analysis(unresolved(assertOk(parse('/invocation.f.js')(source))).edag)))({ args: [] })

export const proof = {
    argumentWritesPrecedeInvocationReads: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let n=0;const r=((a,b)=>[a,b,n])((()=>{n=n+1;return n;})(),(()=>{n=n+1;return n;})());return [r,n];})();', [[1, 2, 2], 2]],
            ['export default (()=>{let n=0;const r=((a,b)=>[a,b,n])(...[n],(()=>{n=n+1;return n;})());return [r,n];})();', [[0, 1, 1], 1]],
            ['export default (()=>{let n=0;const r=((a)=>[a,n])?.((()=>{n=n+1;return n;})());return [r,n];})();', [[1, 1], 1]],
            ['export default (()=>{let n=0;const r=((a)=>[a,n])?.((()=>{n=n+1;return n;})()).length;return [r,n];})();', [2, 1]],
            ['export default (()=>{let n=0;const r=((a)=>[a,n])?.((()=>{n=n+1;return n;})()).at(1);return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const r=((a=n)=>[a,n])((()=>{n=n+1;return undefined;})());return [r,n];})();', [[1, 1], 1]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: expected }, source) }
    },
    failingArgumentSkipsInvocationDefaults: () => {
        const source = 'const fail=()=>{throw 2;};export default (()=>{let n=0;return ((a=fail())=>[a,n])((()=>{n=n+1;throw 1;})());})();'
        assertEq(assertError(evaluate(source)), 1)
    },
}
