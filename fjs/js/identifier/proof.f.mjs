import { assert } from '../../asserts/module.f.js'
import { one } from '../../text/ascii/module.f.js'
import { isIdentifier, isIdentifierPart, isInteger } from './module.f.mjs'

export const proof = {
    isInteger: () => {
        assert(isInteger('0'))
        assert(isInteger('123'))
        assert(!isInteger(''))
        assert(!isInteger('01'))
        assert(!isInteger('1a'))
        assert(!isInteger('-1'))
    },
    // A letter, `_`, `$` and a digit continue an identifier; nothing else
    // does, the Kelvin sign included.
    isIdentifierPart: () => {
        assert([...'aZ_$09'].map(one).every(isIdentifierPart))
        assert(![...'-. \u212A'].map(one).some(isIdentifierPart))
    },
    isIdentifier: () => {
        assert(isIdentifier('abc'))
        assert(isIdentifier('Abc'))
        assert(isIdentifier('_x'))
        assert(isIdentifier('$y'))
        assert(isIdentifier('a1'))
        assert(isIdentifier('a_$'))
        assert(!isIdentifier(''))
        assert(!isIdentifier('1a'))
        assert(!isIdentifier('a-b'))
        // The Kelvin sign lowercases to `k`, and is still no Latin letter.
        assert(!isIdentifier('K'))
        assert(!isIdentifier('aK'))
        // A lone surrogate is tagged, never a letter.
        assert(!isIdentifier('\uD800'))
    },
}
