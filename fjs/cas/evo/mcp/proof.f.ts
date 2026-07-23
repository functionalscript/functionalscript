import { assert, assertEq } from '../../../asserts/module.f.ts'
import { fileCas } from '../../module.f.ts'
import { sha256 } from '../../../crypto/sha2/module.f.ts'
import { emptyState, virtual } from '../../../effects/node/virtual/module.f.ts'
import { vec8 } from '../../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.ts'
import { initEvo, evo, type Evo } from '../module.f.ts'
import { evoToolRegistry } from './module.f.ts'
import type { ToolEntry, ToolsCallResult } from '../../../mcp/module.f.ts'
import type { Operation } from '../../../effects/module.f.ts'

const home = '/home/user'

const findEntry = <O extends Operation>(registry: readonly ToolEntry<O>[], name: string): ToolEntry<O> => {
    const entry = registry.find(e => e.name === name)
    assert(entry !== undefined, ['missing tool entry', name])
    return entry
}

const textOf = (result: ToolsCallResult): string => {
    const [item] = result.content
    assert(item.type === 'text', ['expected a text content item', item])
    return item.text
}

export const proof = {
    toolNamesMatchTheDesign: () => {
        const e: Evo<never> = { list: () => { throw 'unused' }, head: () => { throw 'unused' }, add: () => { throw 'unused' } }
        assertEq(evoToolRegistry(e).map(entry => entry.name).join(','), 'evo_list,evo_head,evo_add')
    },
    evoListReflectsTheCache: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [, result] = virtual(state0)(entry.handle({}))
        assert(!result.isError)
        assertEq(textOf(result), '[]')
    },
    // Regression: subjects are arbitrary strings, not constrained to a
    // newline-free alphabet like hashes, so evo_list must not join them with
    // '\n' — a subject containing a newline, or an empty subject, would be
    // indistinguishable from multiple/no subjects in that format. JSON
    // encoding preserves both exactly.
    evoListEncodesArbitrarySubjectsAsJson: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [state1, addA] = virtual(state0)(e.add({ parents: [], subject: 'line one\nline two', snapshot: vecToCBase32(vec8(0x2an)) }))
        assert(addA[0] === 'ok', ['expected add ok', addA])
        const [state2, addB] = virtual(state1)(e.add({ parents: [], subject: '', snapshot: vecToCBase32(vec8(0x2bn)) }))
        assert(addB[0] === 'ok', ['expected add ok', addB])
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [, result] = virtual(state2)(entry.handle({}))
        assert(!result.isError)
        const subjects = JSON.parse(textOf(result)) as readonly string[]
        assertEq(subjects.length, 2)
        assert(subjects.includes('line one\nline two'), ['unexpected subjects', subjects])
        assert(subjects.includes(''), ['unexpected subjects', subjects])
    },
    evoHeadReflectsTheCache: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_head')
        const [, result] = virtual(state0)(entry.handle({ subject: 'nope' }))
        assert(!result.isError)
        assertEq(textOf(result), '')
    },
    evoHeadMissingSubjectIsInvalidArguments: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_head')
        const [, result] = virtual(state0)(entry.handle({}))
        assertEq(result.isError, true)
    },
    // Covers evo_add's success branch: a valid revision is stored and its
    // hash comes back as plain, non-error text.
    evoAddSuccessReturnsHash: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_add')
        const args = { parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x1n)) }
        const [, result] = virtual(state0)(entry.handle(args))
        assert(!result.isError)
        assert(textOf(result).length > 0)
    },
    // Covers evo_add's error branch: a domain-level failure (Evo.add's
    // Result) is surfaced as isError with the failure message as text.
    evoAddDomainErrorIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_add')
        const [, result] = virtual(state0)(entry.handle({ parents: [] }))
        assertEq(result.isError, true)
        assert(textOf(result).includes('subject is required'))
    },
}
