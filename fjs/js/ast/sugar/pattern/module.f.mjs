/**
 * Plan source patterns before binding analysis, preserving tokens and original
 * identities. The parser supplies source legality; this owner chooses ordered
 * reads, iterable copies, empty-pattern checks and hidden temporary bindings.
 *
 * @module
 *
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { OrderedMap } from '../../../../types/ordered_map/types.ts'
 * @import { ParseError } from '../../../../compiler/parser/types.ts'
 * @import { BindingElement, BindingProperty, BindingTarget, Discard } from '../../../../compiler/parser/syntax/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../../../compiler/tokenizer/types.ts'
 * @import { PatternPlan, Policy } from './types.ts'
 * @import { Pending, Read, Source, Stack } from './private.ts'
 */

import { error, ok } from '../../../../types/result/module.f.js'
import { reverse } from '../../../../types/list/module.f.mjs'
import { toArray } from '../../../../types/list/alt/module.f.mjs'
import { at, empty, setReplace } from '../../../../types/ordered_map/module.f.mjs'
import { hasEntry } from '../../../../types/object/entry/module.f.js'
import { pushAll } from '../../../../types/stack_walk/module.f.js'

/** @type {(rest: Stack, top: Pending) => Stack} */
const pushed = (rest, top) => ({ top, rest })

/** @type {(pending: Stack, list: readonly BindingProperty[], parent: number | ModuleTokenWithMetadata) => Stack} */
const properties = (pending, list, parent) => pushAll(list.map(property => ({ property, parent })), pending)

/**
 * One structural walk follows document order: a property key precedes its
 * target, and an elision holds its position without introducing a read.
 * Namespace members are already values, so they introduce no source read.
 *
 * @type {(policy: Policy) => (target: BindingTarget | Discard, namespace: ModuleTokenWithMetadata | null) => Result<PatternPlan, ParseError>}
 */
export const planPattern = policy => (target, namespace) => {
    if (target[0] === 'discard') { return ok({ reads: [{ source: null, spread: false }], names: [], ids: [{ index: 0 }], metadata: target[1].metadata }) }
    /** @type {Stack} */
    let pending = namespace === null || target[0] !== 'object' ? pushed(null, { target, source: null }) : properties(null, target[2], namespace)
    /** @type {List<Read>} */
    let reads = null
    /** @type {List<readonly [ModuleTokenWithMetadata, number]>} */
    let names = null
    /** @type {OrderedMap<boolean>} */
    let seen = empty
    let count = 0
    while (pending !== null) {
        /** @type {Pending} */
        const item = pending.top
        pending = pending.rest
        if (hasEntry(item, 'property')) {
            const { property, parent } = item
            if (property instanceof Array) { return error(policy.refused('rest', property[1])) }
            const { key, target: element } = property
            if (key instanceof Array) { return error(policy.refused('computed', key[2])) }
            /** @type {Result<Source, ParseError>} */
            const found = typeof parent === 'number'
                ? (() => { const result = policy.key(key); return result[0] === 'error' ? result : ok(/** @type {const} */ ([parent, result[1]])) })()
                : policy.namespaceMember(parent, key)
            if (found[0] === 'error') { return found }
            pending = pushed(pending, { target: element, source: found[1] })
            continue
        }
        if (hasEntry(item, 'element')) {
            const { element, source } = item
            if (element[0] === '...') { return error(policy.refused('rest', element[1])) }
            if (element[0] !== 'elision') { pending = pushed(pending, { target: element, source }) }
            continue
        }
        const { target: current, source } = item
        switch (current[0]) {
            case 'invalid': { return error(policy.refused('invalid', current[1])) }
            case 'name': {
                const found = policy.name(current[1])
                if (found[0] === 'error') { return found }
                const word = found[1]
                if (at(word)(seen) !== null) { return error(policy.refused('duplicate', current[1])) }
                seen = setReplace(word)(true)(seen)
                reads = { first: { source, spread: false }, tail: reads }
                names = { first: [current[1], count], tail: names }
                count += 1
                break
            }
            case 'array': {
                const parent = count
                reads = { first: { source, spread: true }, tail: reads }
                count += 1
                pending = pushAll(current[2].map((element, index) => /** @type {Pending} */ ({ element, source: [parent, index] })), pending)
                break
            }
            case 'object': {
                const parent = count
                reads = { first: { source, spread: false }, tail: reads }
                count += 1
                if (current[2].length === 0) { reads = { first: { source: [parent, 'length'], spread: false }, tail: reads }; count += 1 }
                pending = properties(pending, current[2], parent)
                break
            }
        }
    }
    return ok({ reads: toArray(reverse(reads)), names: toArray(reverse(names)), ids: Array.from({ length: count }, (_, index) => ({ index })), metadata: target[1].metadata })
}
