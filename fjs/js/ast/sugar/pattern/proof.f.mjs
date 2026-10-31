/**
 * Structural expansion remains independent of source name and key policy.
 *
 * @import { BindingTarget } from '../../../../compiler/parser/syntax/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../../../compiler/tokenizer/types.ts'
 * @import { Policy } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { error, ok } from '../../../../types/result/module.f.js'
import { planPattern } from './module.f.js'

/** @type {(value: string, column?: number) => ModuleTokenWithMetadata} */
const token = (value, column = 1) => ({ token: { kind: 'id', value }, metadata: { path: 'pattern', line: 1, column }, newline: false })

/** @type {(value: ModuleTokenWithMetadata) => string} */
const word = value => { assert(value.token.kind === 'id'); return value.token.value }

/** @type {Policy} */
const policy = {
    bindingName: value => word(value) === 'badName' ? error({ message: 'name policy', metadata: value.metadata }) : ok(word(value)),
    key: value => word(value) === 'badKey' ? error({ message: 'key policy', metadata: value.metadata }) : ok(word(value) === '7' ? 7 : word(value)),
    namespaceMember: (namespace, key) => word(namespace) === 'Object' && word(key) === 'is' ? ok(['Object.is']) : error({ message: 'namespace policy', metadata: namespace.metadata }),
    refused: (reason, value) => ({ message: reason, metadata: value.metadata }),
}

const plan = planPattern(policy)

export const proof = {
    identitiesAndDiscard: () => {
        const name = token('value')
        const first = assertOk(plan(['name', name], null))
        const second = assertOk(plan(['name', name], token('Object')))
        assertStructurallySame(first.reads, [{ source: null, spread: false }])
        assertStructurallySame(first.names, [[name, 0]])
        assertEq(first.metadata, name.metadata)
        assertEq(first.ids[0].index, second.ids[0].index)
        assert(first.ids[0] !== second.ids[0])
        const discard = assertOk(plan(['discard', name], null))
        assertStructurallySame(discard.reads, [{ source: null, spread: false }])
        assertEq(discard.names.length, 0)
        assertEq(discard.ids.length, 1)
    },
    orderedPatternReads: () => {
        const opening = token('opening')
        const a = token('a')
        const b = token('b')
        const c = token('c')
        const array = assertOk(plan(['array', opening, [
            ['name', a], ['elision', token('comma')], ['name', b], ['array', opening, [['name', c]]],
        ]], null))
        assertStructurallySame(array.reads, [
            { source: null, spread: true }, { source: [0, 0], spread: false },
            { source: [0, 2], spread: false }, { source: [0, 3], spread: true }, { source: [3, 0], spread: false },
        ])
        assertStructurallySame(array.names, [[a, 1], [b, 2], [c, 4]])
        assertStructurallySame(array.ids.map(id => id.index), [0, 1, 2, 3, 4])
        const object = assertOk(plan(['object', opening, [
            { key: token('7'), target: ['name', a] },
            { key: token('nested'), target: ['object', opening, [{ key: token('key'), target: ['name', b] }]] },
        ]], null))
        assertStructurallySame(object.reads, [
            { source: null, spread: false }, { source: [0, 7], spread: false },
            { source: [0, 'nested'], spread: false }, { source: [2, 'key'], spread: false },
        ])
        assertStructurallySame(object.names, [[a, 1], [b, 3]])
    },
    emptyPatternsAndNamespaces: () => {
        const opening = token('opening')
        assertStructurallySame(assertOk(plan(['array', opening, []], null)).reads, [{ source: null, spread: true }])
        const object = assertOk(plan(['object', opening, []], null))
        assertStructurallySame(object.reads, [{ source: null, spread: false }, { source: [0, 'length'], spread: false }])
        assertEq(object.names.length, 0)
        assertEq(object.ids.length, 2)
        const namespace = token('Object')
        const member = assertOk(plan(['object', opening, [{ key: token('is'), target: ['name', token('same')] }]], namespace))
        assertStructurallySame(member.reads, [{ source: ['Object.is'], spread: false }])
        assertEq(member.ids.length, 1)
        assertEq(assertOk(plan(['object', opening, []], namespace)).ids.length, 0)
    },
    structuralRefusals: () => {
        const opening = token('opening')
        const first = token('same', 2)
        const second = token('same', 9)
        assertStructurallySame(assertError(plan(['array', opening, [['name', first], ['name', second]]], null)), { message: 'duplicate', metadata: second.metadata })
        const invalid = token('invalid')
        assertStructurallySame(assertError(plan(['invalid', invalid], null)), { message: 'invalid', metadata: invalid.metadata })
        const rest = token('rest')
        const name = /** @type {const} */ (['name', first])
        assertStructurallySame(assertError(plan(['array', opening, [['...', rest, name]]], null)), { message: 'rest', metadata: rest.metadata })
        assertStructurallySame(assertError(plan(['object', opening, [['...', rest, name]]], null)), { message: 'rest', metadata: rest.metadata })
        const computed = token('computed')
        assertStructurallySame(assertError(plan(['object', opening, [{ key: ['[]', ['primitive', 1], computed], target: name }]], null)), { message: 'computed', metadata: computed.metadata })
    },
    policyAndDiagnosticOrder: () => {
        const opening = token('opening')
        const badName = token('badName')
        assertStructurallySame(assertError(plan(['name', badName], null)), { message: 'name policy', metadata: badName.metadata })
        const badKey = token('badKey')
        const target = /** @type {const} */ (['invalid', token('invalid')])
        assertStructurallySame(assertError(plan(['object', opening, [{ key: badKey, target }]], null)), { message: 'key policy', metadata: badKey.metadata })
        const namespace = token('Unknown')
        assertStructurallySame(assertError(plan(['object', opening, [{ key: token('member'), target }]], namespace)), { message: 'namespace policy', metadata: namespace.metadata })
    },
    deepPatterns: () => {
        const opening = token('opening')
        /** @type {BindingTarget} */
        let target = ['name', token('last')]
        for (let depth = 0; depth < 20_000; depth += 1) { target = ['array', opening, [target]] }
        const result = assertOk(plan(target, null))
        assertEq(result.reads.length, 20_001)
        assertStructurallySame(result.reads[20_000], { source: [19_999, 0], spread: false })
        assertEq(result.names[0][1], 20_000)
    },
}
