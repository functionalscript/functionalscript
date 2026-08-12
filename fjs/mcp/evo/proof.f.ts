import { assert, assertEq } from '../../asserts/module.f.mjs'
import { fileCas } from '../../cas/module.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { vec8 } from '../../types/bit_vec/module.f.mjs'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { initEvo, evo } from '../../cas/evo/module.f.mjs'
import type { Evo } from '../../cas/evo/types.ts'
import { evoToolRegistry } from './module.f.ts'
import type { ToolEntry, ToolsCallResult } from '../../protocol/mcp/module.f.ts'
import type { Operation } from '../../effects/types.ts'
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { array, string as rttiString } from '../../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const home = '/home/user'

const parseSubjects = rttiParse(array(rttiString))

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
        const e: Evo<never> = {
            list: () => { throw 'unused' },
            head: () => { throw 'unused' },
            add: () => { throw 'unused' },
            revision: () => { throw 'unused' },
        }
        assertEq(evoToolRegistry(e).map(entry => entry.name).join(','), 'evo_list,evo_head,evo_revision,evo_add')
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
        const subjects = unwrap(parseSubjects(unwrap(parseJson(textOf(result)))))
        assertEq(subjects.length, 2)
        assert(subjects.includes('line one\nline two'), ['unexpected subjects', subjects])
        assert(subjects.includes(''), ['unexpected subjects', subjects])
    },
    // The `archived` argument is a pass-through to `Evo.list`'s status filter:
    // omitted lists the active subjects, `true` the archived ones.
    evoListForwardsTheArchivedFilter: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [state1, add] = virtual(state0)(e.add({ parents: [], subject: 'gone', snapshot: vecToCBase32(vec8(0x2cn)), archived: true }))
        assert(add[0] === 'ok', ['expected add ok', add])
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [state2, active] = virtual(state1)(entry.handle({}))
        assert(!active.isError)
        assertEq(textOf(active), '[]')
        const [, archived] = virtual(state2)(entry.handle({ archived: true }))
        assert(!archived.isError)
        assertEq(textOf(archived), '["gone"]')
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
    // Covers evo_revision's success branch: the stored revision comes back as
    // the JSON of `RevisionData` — `dialect` dropped, `generation` and the
    // resolved `snapshot` included.
    evoRevisionReturnsRevisionJson: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const subject = vecToCBase32(vec8(0x3n))
        const [state1, added] = virtual(state0)(e.add({ parents: [], subject }))
        assert(added[0] === 'ok', ['expected add ok', added])
        const entry = findEntry(evoToolRegistry(e), 'evo_revision')
        const [, result] = virtual(state1)(entry.handle({ hash: added[1] }))
        assert(!result.isError)
        assertEq(textOf(result), `{"subject":"${subject}","parents":[],"snapshot":"${subject}","generation":0}`)
    },
    // Covers evo_revision's error branch: a domain-level failure (a hash the
    // store has nothing under) is surfaced as isError with the message.
    evoRevisionDomainErrorIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_revision')
        const [, result] = virtual(state0)(entry.handle({ hash: vecToCBase32(vec8(0x4n)) }))
        assertEq(result.isError, true)
        assert(textOf(result).includes('revision not found'))
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
