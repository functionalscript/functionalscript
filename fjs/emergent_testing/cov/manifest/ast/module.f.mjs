/**
 * Refuse runtime inputs that the static coverage dependency graph cannot name.
 * This inspects parsed reference nodes, never source text or property spellings.
 * @module
 * @import { Module } from '../../../../compiler/parser/syntax/types.ts'
 * @import { Unknown } from '../../../../media/datajs/types.ts'
 * @import { IdToken } from '../../../../ebnf/lib/js/types.ts'
 */

import { definedValues } from '../../../../types/object/module.f.mjs'

/** @type {readonly string[]} */
const untracked = ['import', 'require', 'eval', 'Function', 'process', 'globalThis', 'global', 'Buffer', 'Deno', 'Bun']

/** Defined children of the syntax tree's object nodes. @type {typeof definedValues<Unknown>} */
const values = definedValues

/** The first unsupported reference in source-tree order. @type {(values: readonly Unknown[]) => string | null} */
const first = values => values.map(visit).find(value => value !== null) ?? null

/** The syntax reader constructs each ref with its identifier token. @type {(value: Unknown) => string | null} */
const visit = value => {
    if (value instanceof Array) {
        if (value[0] === 'ref') {
            const [, { token: { value: name } }] = /** @type {readonly ['ref', { readonly token: IdToken }]} */ (value)
            return untracked.includes(name) ? `untracked runtime input: ${name}` : null
        }
        return first(value)
    }
    if (value !== null && typeof value === 'object') {
        return first(values(value))
    }
    return null
}

/** A conservative cache refusal leaves the ordinary coverage run available. @type {(module: Module) => string | null} */
export const validate = module => visit(module)
