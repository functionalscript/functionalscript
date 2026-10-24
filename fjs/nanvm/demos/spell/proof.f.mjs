import { assertEq } from '../../../asserts/module.f.js'
import { spell } from './module.f.mjs'

export const proof = {
    scalars: () => assertEq([undefined, null, true, 1.5, -0, NaN, 1n, -2n].map(spell).join(' '), 'undefined null true 1.5 0 NaN 1n -2n'),
    // Quoted and escaped as JSON quotes a string.
    string: () => assertEq(spell('a"\n\u0001'), '"a\\"\\n\\u0001"'),
    // What `String` would flatten keeps its shape.
    containers: () => assertEq(spell([undefined, null, '', [1, [2]], { a: 1n, 'b c': {} }]), '[undefined,null,"",[1,[2]],{"a":1n,"b c":{}}]'),
    function: () => assertEq(spell(() => 1), '(function)'),
}
