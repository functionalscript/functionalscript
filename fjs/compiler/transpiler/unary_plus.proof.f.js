/** Represented interpretation of unary plus: JavaScript's `ToNumber`, a bigint refused. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { _transpileDefault, noRuntime } from './module.f.js'

/** A module's default export as data, or why the module has none. */
const interpreted = (/** @type {string} */ source) => virtualAt({ 'input.f.js': [utf8(source)] })(_transpileDefault(noRuntime)('input.f.js'))[1]

/** The data a module's default export is. @type {(source: string) => unknown} */
const valueOf = source => assertOk(assertOk(interpreted(source)))

export const proof = /** @type {const} */ ({
    // The conversion every operand type has: a string read as a number, a
    // boolean and `null` as their numbers, an array through its text, and
    // an object through `valueOf` and then `toString`.
    converts: () => {
        assertStructurallySame(valueOf('export default [+1,+"5",+true,+false,+null,+[],+[7],+"",+" 12 "];'), [1, 5, 1, 0, 0, 0, 7, 0, 12])
        assertEq(valueOf('export default +{valueOf:()=>7};'), 7)
        assertEq(valueOf('export default +{valueOf:()=>({}),toString:()=>"3"};'), 3)
    },
    // The results no other number equals: `NaN` where the text is no
    // number, and the sign of zero kept.
    nanAndSignedZero: () => {
        assert(Object.is(valueOf('export default +"x";'), NaN))
        assert(Object.is(valueOf('export default +undefined;'), NaN))
        assert(Object.is(valueOf('export default +-0;'), -0))
        assert(Object.is(valueOf('export default +"-0";'), -0))
    },
    // The operand is evaluated once, and the result is a key as `Number`'s is.
    index: () => {
        assertEq(valueOf('export default ((a,x)=>a[+x])([10,20],"1");'), 20)
        assertEq(valueOf('export default ((a,x)=>a?.[+x])([10,20],true);'), 20)
    },
    // Where `Number(1n)` is `1`, `+1n` throws, and so does an object whose
    // primitive is a bigint: the module fails to initialize.
    bigintIsRefused: () => {
        for (const source of ['export default +1n;', 'export default +{valueOf:()=>1n};', 'export default ((a,x)=>a[+x])([1],0n);']) {
            assertEq(assertError(interpreted(source)).message, 'module initialization failed')
        }
        assertEq(valueOf('export default Number(1n);'), 1)
    },
})
