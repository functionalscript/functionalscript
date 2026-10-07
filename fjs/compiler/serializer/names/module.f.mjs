/**
 * Symbolic binding names resolved to one counter at the output boundary.
 * Renderers identify bindings by scope and slot, mark declarations explicitly,
 * and reuse the same symbol at every reference. Allocation follows declaration
 * order across the complete document, including nested scopes. External frame
 * slots precede declarations, including unused slots.
 *
 * NUL delimits internal symbols. JavaScript literals escape NUL, so serialized
 * user data cannot introduce a symbol. This is a document representation, not
 * a parser or a rewrite of JavaScript identifiers.
 *
 * @module
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'

/** A reference to a binding identified by its rendering scope and slot. @type {(key: string) => string} */
export const name = key => `\0${key}\0`

/** Mark the declaration of a symbolic reference. @type {(reference: string) => string} */
export const binding = reference => name(`!${reference.slice(1, -1)}`)

/** The next counter value whose spelling is not externally reserved. @type {(n: number, reserved: readonly string[]) => number} */
const available = (n, reserved) => reserved.includes(`$${n}`) ? available(n + 1, reserved) : n

/**
 * Resolve symbolic chunks, preserving chunk boundaries. Forward references
 * are supported by allocating all declarations before replacing references.
 * Every call owns its counter; no renderer carries mutable allocation state.
 *
 * @type {(chunks: readonly string[], reserved?: readonly string[], external?: readonly string[]) => readonly string[]}
 */
export const resolve = (chunks, reserved = [], external = []) => {
    const keys = [...new Set([
        ...external.map(reference => reference.slice(1, -1)),
        ...chunks.flatMap(chunk => chunk.split('\0').filter((part, i) => i % 2 === 1 && part.startsWith('!')).map(part => part.slice(1))),
    ])]
    const numbers = keys.reduce(
        /** @type {(state: readonly [readonly number[], number], key: string) => readonly [readonly number[], number]} */
        (([all, next], _key) => {
            const n = available(next, reserved)
            return [[...all, n], n + 1]
        }),
        /** @type {readonly [readonly number[], number]} */ ([[], 0]),
    )[0]
    return chunks.map(chunk => chunk.split('\0').map((part, i) => {
        if (i % 2 === 0) { return part }
        const key = part.startsWith('!') ? part.slice(1) : part
        return `$${assertNotNullish(numbers[keys.indexOf(key)], ['undeclared serializer binding', key])}`
    }).join(''))
}
