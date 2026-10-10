import { assertEq } from '../../asserts/module.f.mjs'
import { arrayIndex } from './module.f.js'

export const proof = {
    // The canonical spellings, up to the last index the language admits.
    index: () => [0, 7, 2 ** 32 - 2].forEach(i => assertEq(arrayIndex(String(i)), i, i)),
    // Every non-canonical spelling `Number` would still map to an integer,
    // and the first key past the bound, are ordinary properties.
    property: () => [
        '-1', '01', '1.5', '1e3', ' 1', '1 ', '0x1', '-0', '+0', '0.0', '', 'length',
        'NaN', 'Infinity', '-Infinity', '4294967294.0', '4294967295', '4294967296',
    ].forEach(key => assertEq(arrayIndex(key), null, key)),
}
