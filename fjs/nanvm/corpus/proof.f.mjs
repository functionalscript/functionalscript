/**
 * Proofs for the corpus rule: everything is compared unless an exception says
 * why not.
 */

import { assert, assertStructurallySame } from '../../asserts/module.f.mjs'
import { structurallySame } from '../../types/object/structurally_same/module.f.mjs'
import { corpus, exceptions, undefinedDefault, withAliasing, withoutNegativeZero } from './module.f.mjs'

export const proof = {
    corpus: {
        keepsModulesAndLeavesExceptionsOut: () => {
            assertStructurallySame(
                corpus(['a.mjs', 'function.mjs', 'b.mjs', 'rest-function.mjs', 'function-text.mjs']),
                ['a.mjs', 'b.mjs'])
        },
        leavesNonModulesOut: () => {
            assertStructurallySame(corpus(['README.md', 'a.mjs', 'helpers']), ['a.mjs'])
        },
        newFixtureIsComparedByDefault: () => {
            assertStructurallySame(corpus(['brand-new.mjs']), ['brand-new.mjs'])
        },
    },
    exceptions: {
        everyOneIsAModuleWithAReason: () => {
            const entries = Object.entries(exceptions)
            assert(entries.length > 0)
            for (const [file, reason] of entries) {
                assert(file.endsWith('.mjs'))
                assert(reason.length > 0)
            }
        },
    },
    undefinedDefault: {
        everyOneIsAModuleWithAReason: () => {
            const entries = Object.entries(undefinedDefault)
            assert(entries.length > 0)
            for (const [file, reason] of entries) {
                assert(file.endsWith('.mjs'))
                assert(reason.length > 0)
                assert(exceptions[file] === undefined)
            }
        },
    },
    withAliasing: {
        leavesPrimitivesAlone: () => {
            for (const v of [1, 'a', true, null, undefined, 2n, NaN]) {
                assertStructurallySame(withAliasing(v), v)
            }
        },
        numbersContainersInOrderOfFirstSight: () => {
            assertStructurallySame(withAliasing([[], {}]), ['node', 0, 'array', [['node', 1, 'array', []], ['node', 2, 'object', []]]])
        },
        sharedIsAnAlias: () => {
            const shared = { x: 1 }
            assertStructurallySame(
                withAliasing([shared, shared]),
                ['node', 0, 'array', [['node', 1, 'object', [['x', 1]]], ['alias', 1]]])
        },
        copiesAreNotAliases: () => {
            assert(!structurallySame(withAliasing([{ x: 1 }, { x: 1 }]), withAliasing((s => [s, s])({ x: 1 }))))
        },
        aliasInsideAnObjectAndAcrossSiblings: () => {
            const inner = [1]
            assertStructurallySame(
                withAliasing({ a: inner, b: [inner] }),
                ['node', 0, 'object', [
                    ['a', ['node', 1, 'array', [1]]],
                    ['b', ['node', 2, 'array', [['alias', 1]]]],
                ]])
        },
    },
    withoutNegativeZero: {
        writesNegativeZeroAsZero: () => {
            assert(Object.is(withoutNegativeZero(-0), 0))
        },
        keepsEveryOtherLeaf: () => {
            for (const v of [0, 1, -1, 'a', true, null, undefined, 2n, NaN, 1e21]) {
                assert(Object.is(withoutNegativeZero(v), v))
            }
        },
        reachesInsideArraysAndObjects: () => {
            assertStructurallySame(
                withoutNegativeZero([-0, { a: -0, b: [1, -0], c: 'x' }]),
                [0, { a: 0, b: [1, 0], c: 'x' }])
            assert(Object.is(/** @type {any} */ (withoutNegativeZero([-0]))[0], 0))
        },
        keepsOrder: () => {
            assertStructurallySame(Object.keys(/** @type {object} */ (withoutNegativeZero({ b: 1, a: -0 }))), ['b', 'a'])
        },
    },
}
