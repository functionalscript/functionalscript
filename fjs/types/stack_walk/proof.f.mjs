/**
 * @import { Step } from './types.ts'
 */

import { pushOk, walk, walkFold } from './module.f.js'
import { error, ok } from '../result/module.f.js'
import { assertEq } from '../../asserts/module.f.js'

/**
 * Two walks over a tree of numbers — a number leaf, an array of trees, or
 * anything else standing for a refusal: the sum of its leaves, and the same
 * sum with the leaves visited counted on the way.
 */
const sums = () => {
    /** @typedef {{ readonly node: readonly unknown[], readonly index: number, readonly sum: number }} Frame */

    /** @type {(frame: Frame) => Step<unknown, Frame, number, string>} */
    const round = frame => frame.index < frame.node.length
        ? ['push', frame, frame.node[frame.index]]
        : ok(frame.sum)

    /** @type {(frame: Frame, value: number) => Step<unknown, Frame, number, string>} */
    const next = ({ node, index, sum }, value) => round({ node, index: index + 1, sum: sum + value })

    const sum = walk({
        /** @type {(node: unknown) => Step<unknown, Frame, number, string>} */
        enter: node => typeof node === 'number' ? ok(node)
            : node instanceof Array ? round({ node, index: 0, sum: 0 })
            : error(String(node)),
        resume: next,
    })

    const counted = walkFold({
        /** @type {(acc: number, node: unknown) => readonly [number, Step<unknown, Frame, number, string>]} */
        enter: (acc, node) => typeof node === 'number' ? [acc + 1, ok(node)]
            : node instanceof Array ? [acc, round({ node, index: 0, sum: 0 })]
            : [acc, error(String(node))],
        /** @type {(acc: number, frame: Frame, value: number) => readonly [number, Step<unknown, Frame, number, string>]} */
        resume: (acc, frame, value) => [acc, next(frame, value)],
    })(0)

    return { sum, counted }
}

const { sum, counted } = sums()

/** A tree nested `depth` levels deep around one leaf. @type {(depth: number) => unknown} */
const nested = depth => {
    /** @type {unknown} */
    let tree = 1
    for (let i = 0; i < depth; ++i) { tree = [tree] }
    return tree
}

/** @type {(r: unknown, expected: unknown) => void} */
const same = (r, expected) => assertEq(JSON.stringify(r), JSON.stringify(expected))

export const proof = {
    walk: {
        leaf: () => same(sum(5), ok(5)),
        empty: () => same(sum([]), ok(0)),
        nested: () => same(sum([1, [2, [3, []]], 4]), ok(10)),
        error: () => same(sum([1, [2, 'bad', 3], 'worse']), error('bad')),
        rootError: () => same(sum('bad'), error('bad')),
    },
    walkFold: {
        nested: () => same(counted([1, [2, [3, []]], 4]), ok([4, 10])),
        error: () => same(counted([1, ['bad']]), error('bad')),
    },
    pushOk: {
        ok: () => same(pushOk('frame')(ok(1)), ['push', 'frame', 1]),
        error: () => same(pushOk('frame')(error('bad')), error('bad')),
    },
    // the depth is a property of the driver: no call stack per level
    depth: () => same(sum(nested(100_000)), ok(1)),
}
