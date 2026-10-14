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
 * A chunk may be a marked run, `[text, kind]` (`fjs/text/marked`): a symbol
 * inside one is resolved in its text, and the run keeps its kind.
 *
 * A function's parameters are named here once, by the function's rendering
 * scope: {@link _arg} and {@link _rest} for a read and {@link _parameters}
 * for the declarations, so that every writer reads a parameter by the name
 * its list declares.
 *
 * @module
 *
 * @import { Chunk } from '../../../text/marked/types.ts'
 * @import { Analysis } from '../../../edag/analysis/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { scopeHolds } from '../../../edag/analysis/module.f.mjs'
import { chunkText } from '../../../text/marked/module.f.mjs'

/** A reference to a binding identified by its rendering scope and slot. @type {(key: string) => string} */
export const _name = key => `\0${key}\0`

/** Mark the declaration of a symbolic reference. @type {(reference: string) => string} */
export const _binding = reference => _name(`!${reference.slice(1, -1)}`)

/** A reference to fixed parameter `k` of the function at `path`. @type {(path: string, k: number) => string} */
export const _arg = (path, k) => _name(`${path}/arg${k}`)

/** A reference to the rest parameter of the function at `path`. @type {(path: string) => string} */
export const _rest = path => _name(`${path}/rest`)

/**
 * The parameter declarations of the function that is entry `i`, of `length`
 * fixed parameters, at `path`, comma-separated: one per fixed parameter,
 * and the rest parameter only where the body reads it — `()=>1` and not
 * `(...$0)=>1`, the two being one node, and the shorter what a reader
 * expects.
 *
 * @type {(a: Analysis, path: string, i: number, length: number) => string}
 */
export const _parameters = (a, path, i, length) => {
    const fixed = Array.from({ length }, (_, k) => _binding(_arg(path, k)))
    const rest = scopeHolds(a, i, 'rest') ? [`...${_binding(_rest(path))}`] : []
    return [...fixed, ...rest].join(',')
}

/**
 * Resolve symbolic chunks, preserving chunk boundaries. Forward references
 * are supported by allocating all declarations before replacing references.
 * Every call owns its counter; no renderer carries mutable allocation state.
 *
 * A chunk's kind is kept: a symbol inside a marked chunk is resolved in its
 * text.
 *
 * @type {(chunks: readonly Chunk[], reserved?: readonly string[], external?: readonly string[]) => readonly Chunk[]}
 */
export const _resolve = (chunks, reserved = [], external = []) => {
    const reservedNames = new Set(reserved)
    const keys = [...new Set([
        ...external.map(reference => reference.slice(1, -1)),
        ...chunks.flatMap(chunk => chunkText(chunk).split('\0').filter((part, i) => i % 2 === 1 && part.startsWith('!')).map(part => part.slice(1))),
    ])]
    // At most reservedNames.size candidates can be occupied. Generate enough
    // numbers once, without recursion or copying an accumulated prefix.
    const available = Array.from({ length: keys.length + reservedNames.size }, (_, n) => n)
        .filter(n => !reservedNames.has(`$${n}`))
    const numbers = new Map(keys.map((key, i) => [key, available[i]]))
    /** @type {(text: string) => string} */
    const resolveText = text => text.split('\0').map((part, i) => {
        if (i % 2 === 0) { return part }
        const key = part.startsWith('!') ? part.slice(1) : part
        return `$${assertNotNullish(numbers.get(key), ['undeclared serializer binding', key])}`
    }).join('')
    /** @type {(chunk: Chunk) => Chunk} */
    const resolveChunk = chunk => {
        if (typeof chunk === 'string') { return resolveText(chunk) }
        const [text, kind] = chunk
        return kind === undefined ? [resolveText(text)] : [resolveText(text), kind]
    }
    return chunks.map(resolveChunk)
}
