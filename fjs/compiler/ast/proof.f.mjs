/** Source vocabulary agrees with grammar layers and distinguishes unary arity. */
import { binaryTags, eagerLayers, isBinary, isUnary, lazyLayers, unaryTags } from './module.f.js'
import { assert, assertEq } from '../../asserts/module.f.js'

export const proof = {
    binary: () => {
        for (const tag of binaryTags) { assert(isBinary([tag, 1, 2])) }
        assertEq(isBinary(['+', 1]), false)
        assertEq(isBinary(['unknown', 1, 2]), false)
        assertEq(isBinary(['+', 1, 2, 3]), false)
    },
    unary: () => {
        for (const tag of unaryTags) { assert(isUnary([tag, 1])) }
        assertEq(isUnary(['-', 1, 2]), false)
        assertEq(isUnary(['unknown', 1]), false)
        assertEq(isUnary(['-', 1, 2, 3]), false)
    },
    layers: () => {
        const tags = [...eagerLayers, ...lazyLayers].flatMap(Object.values)
        assert(tags.includes('instanceof'))
        for (const tag of binaryTags.filter(tag => tag !== '**')) { assert(tags.includes(tag)) }
        assertEq(new Set(tags).size, tags.length)
    },
}
