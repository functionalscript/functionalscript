/**
 * @import { Evo } from '../../cas/evo/types.ts'
 * @import { ToolEntry, ToolsCallResult } from '../../protocol/mcp/types.ts'
 * @import { NotImplemented, Operation } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { State } from '../../effects/node/virtual/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { fileCas } from '../../cas/module.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { pureError } from '../../effects/module.f.mjs'
import { unwrap as unwrapResult } from '../../types/result/module.f.mjs'
import { vec8 } from '../../types/bit_vec/module.f.mjs'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { initEvo, evo } from '../../cas/evo/module.f.mjs'
import { evoAddArgs, evoToolRegistry } from './module.f.mjs'
import { toJsonSchema } from '../../media/json/schema/module.f.mjs'
import { at } from '../../types/object/module.f.mjs'

/**
 * Unwraps what a run answered, keeping the state beside it.
 *
 * These cases drive the tools against a virtual filesystem that always
 * cooperates, so a channel failure here is a broken fixture rather than a case
 * under test — and the unwrap is where that assumption is stated.
 *
 * @type {<T, E>(r: readonly [State, Result<T, E>]) => readonly [State, T]}
 */
const unwrapRun = ([state, r]) => [state, unwrapResult(r)]
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { array, string as rttiString } from '../../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const home = '/home/user'

const parseSubjects = rttiParse(array(rttiString))

/**
 * @template {Operation} O
 * @param {readonly ToolEntry<O>[]} registry
 * @param {string} name
 * @returns {ToolEntry<O>}
 */
const findEntry = (registry, name) => {
    const entry = registry.find(e => e.name === name)
    assert(entry !== undefined, ['missing tool entry', name])
    return entry
}

/** @type {(result: ToolsCallResult) => string} */
const textOf = result => {
    const [item] = result.content
    assert(item.type === 'text', ['expected a text content item', item])
    return item.text
}

export const proof = {
    // Every Evo tool answers a channel failure — a cache slot the runner
    // cannot reach — as an ordinary `isError` result. The client asked a
    // question the server could not answer, which is a tool-level failure,
    // not a reason to take the server down.
    channelFailureIsToolError: () => {
        /** @type {NotImplemented} */
        const boom = ['notImplemented', 'memRead']
        /** @type {Evo<never>} */
        const failing = {
            list: () => pureError(boom),
            head: () => pureError(boom),
            add: () => pureError(boom),
            revision: () => { throw 'unused' },
        }
        const registry = evoToolRegistry(failing)
        for (const [name, args] of /** @type {const} */ ([
            ['evo_list', {}],
            ['evo_head', { subject: 'x' }],
            ['evo_add', { parents: [] }],
        ])) {
            const [r] = runPure(findEntry(registry, name).handle(args))
            const result = r === undefined ? undefined : r[1]
            assert(result !== undefined && result.isError === true, ['expected isError', name, result])
            assert(textOf(result).includes('memRead'), ['expected the command name in the message', name])
        }
    },
    toolNamesMatchTheDesign: () => {
        /** @type {Evo<never>} */
        const e = {
            list: () => { throw 'unused' },
            head: () => { throw 'unused' },
            add: () => { throw 'unused' },
            revision: () => { throw 'unused' },
        }
        assertEq(evoToolRegistry(e).map(entry => entry.name).join(','), 'evo_list,evo_head,evo_revision,evo_add')
    },
    evoListReflectsTheCache: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [, [, result]] = virtual(state0)(entry.handle({}))
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
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const [state1] = unwrapRun(virtual(state0)(e.add({ parents: [], subject: 'line one\nline two', snapshot: vecToCBase32(vec8(0x2an)) })))
        const [state2] = unwrapRun(virtual(state1)(e.add({ parents: [], subject: '', snapshot: vecToCBase32(vec8(0x2bn)) })))
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [, [, result]] = virtual(state2)(entry.handle({}))
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
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const [state1] = unwrapRun(virtual(state0)(e.add({ parents: [], subject: 'gone', snapshot: vecToCBase32(vec8(0x2cn)), archived: true })))
        const entry = findEntry(evoToolRegistry(e), 'evo_list')
        const [state2, [, active]] = virtual(state1)(entry.handle({}))
        assert(!active.isError)
        assertEq(textOf(active), '[]')
        const [, [, archived]] = virtual(state2)(entry.handle({ archived: true }))
        assert(!archived.isError)
        assertEq(textOf(archived), '["gone"]')
    },
    evoHeadReflectsTheCache: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_head')
        const [, [, result]] = virtual(state0)(entry.handle({ subject: 'nope' }))
        assert(!result.isError)
        assertEq(textOf(result), '')
    },
    evoHeadMissingSubjectIsInvalidArguments: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_head')
        const [, [, result]] = virtual(state0)(entry.handle({}))
        assertEq(result.isError, true)
    },
    // Covers evo_revision's success branch: the stored revision comes back as
    // the JSON of `RevisionData` — `dialect` dropped, `generation` and the
    // resolved `snapshot` included.
    evoRevisionReturnsRevisionJson: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const subject = vecToCBase32(vec8(0x3n))
        const [state1, added] = unwrapRun(virtual(state0)(e.add({ parents: [], subject })))
        const entry = findEntry(evoToolRegistry(e), 'evo_revision')
        const [, [, result]] = virtual(state1)(entry.handle({ hash: added }))
        assert(!result.isError)
        assertEq(textOf(result), `{"subject":"${subject}","parents":[],"snapshot":"${subject}","generation":0}`)
    },
    // Covers evo_revision's error branch: a domain-level failure (a hash the
    // store has nothing under) is surfaced as isError with the message.
    evoRevisionDomainErrorIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_revision')
        const [, [, result]] = virtual(state0)(entry.handle({ hash: vecToCBase32(vec8(0x4n)) }))
        assertEq(result.isError, true)
        assert(textOf(result).includes('revision not found'))
    },
    // Covers evo_add's success branch: a valid revision is stored and its
    // hash comes back as plain, non-error text.
    evoAddSuccessReturnsHash: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_add')
        const args = { parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x1n)) }
        const [, [, result]] = virtual(state0)(entry.handle(args))
        assert(!result.isError)
        assert(textOf(result).length > 0)
    },
    // `evo_add` accepts a nested lock map and `evo_revision` gives it back —
    // the two tools speak one recursive schema, so a revision read out can be
    // added again as-is however deep its lock nests.
    evoAddAndRevisionCarryNestedLocks: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const registry = evoToolRegistry(e)
        const snapshot = vecToCBase32(vec8(0x1n))
        const d1 = vecToCBase32(vec8(0x2n))
        const d2 = vecToCBase32(vec8(0x3n))
        const args = {
            parents: [], subject: 'doc', snapshot,
            lock: { B: { D: d1 }, C: { D: d2 } },
        }
        const [state1, [, added]] = virtual(state0)(findEntry(registry, 'evo_add').handle(args))
        assert(!added.isError)
        const [, [, read]] = virtual(state1)(findEntry(registry, 'evo_revision').handle({ hash: textOf(added) }))
        assert(!read.isError)
        assertEq(
            textOf(read),
            `{"subject":"doc","parents":[],"snapshot":"${snapshot}","generation":0,"lock":{"B":{"D":"${d1}"},"C":{"D":"${d2}"}}}`)
    },
    // The advertised `inputSchema` publishes both halves of the format's
    // `lock` field: either a shared-lock reference (a string) or an inline
    // map, and the map's recursion the way JSON Schema expresses one — a named
    // `$defs` rule reached through a local `$ref`, rather than a flat-only
    // shape or an infinitely inlined one.
    evoAddInputSchemaPublishesTheLockRecursion: () => {
        const schema = toJsonSchema(evoAddArgs)
        const lock = at('lock')(schema.properties ?? {})
        assert(lock !== null, ['expected a lock property', schema])
        const ref = '#/$defs/lockValue'
        const [sharedRef, inlineMap] = lock.anyOf ?? []
        assertEq(sharedRef?.type, 'string')
        assertEq(inlineMap?.type, 'object')
        assertEq(at('$ref')(inlineMap?.additionalProperties ?? {}), ref)
        const rule = at('lockValue')(schema.$defs ?? {})
        assert(rule !== null, ['expected a lockValue definition', schema])
        const [directHash, nestedMap] = rule.anyOf ?? []
        assertEq(directHash?.type, 'string')
        assertEq(nestedMap?.type, 'object')
        assertEq(at('$ref')(nestedMap?.additionalProperties ?? {}), ref)
    },
    // Covers evo_add's error branch: a domain-level failure (Evo.add's
    // Result) is surfaced as isError with the failure message as text.
    evoAddDomainErrorIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = unwrapRun(virtual(emptyState)(initEvo(c)))
        const e = evo(c)(cacheKey)
        const entry = findEntry(evoToolRegistry(e), 'evo_add')
        const [, [, result]] = virtual(state0)(entry.handle({ parents: [] }))
        assertEq(result.isError, true)
        assert(textOf(result).includes('subject is required'))
    },
}
