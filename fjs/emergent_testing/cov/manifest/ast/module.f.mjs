/**
 * Refuse runtime inputs that the static coverage dependency graph cannot name.
 * This inspects parsed references and permits deterministic Math members only
 * when their receiver and property are statically known.
 * @module
 * @import { Key, Module, Node } from '../../../../compiler/parser/syntax/types.ts'
 * @import { Unknown } from '../../../../media/datajs/types.ts'
 * @import { IdToken } from '../../../../ebnf/lib/js/types.ts'
 */

import { definedValues } from '../../../../types/object/module.f.mjs'

/** @type {readonly string[]} */
const untracked = ['import', 'require', 'eval', 'Function', 'process', 'globalThis', 'global', 'Buffer', 'Deno', 'Bun', 'Date', 'Math']

/** Static access cannot expose the random generator or alias the Math namespace. @type {readonly string[]} */
const deterministicMath = [
    'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2',
    'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
    'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp', 'expm1', 'f16round',
    'floor', 'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2',
    'max', 'min', 'pow', 'round', 'sign', 'sin', 'sinh', 'sqrt',
    'sumPrecise', 'tan', 'tanh', 'trunc',
]

/** Defined children of the syntax tree's object nodes. @type {typeof definedValues<Unknown>} */
const values = definedValues

/** The first unsupported reference in source-tree order. @type {(values: readonly Unknown[]) => string | null} */
const first = values => values.map(visit).find(value => value !== null) ?? null

/** The syntax reader constructs each ref with its identifier token. @type {(value: Unknown) => string | null} */
const visit = value => {
    if (value instanceof Array) {
        if (value[0] === '.') {
            const [, receiver, key] = /** @type {readonly ['.', Node, Key]} */ (value)
            if (receiver[0] === 'ref' && /** @type {IdToken} */ (receiver[1].token).value === 'Math') {
                if (key instanceof Array) { return 'untracked runtime input: Math' }
                const name = 'value' in key.token ? `${key.token.value}` : key.token.kind
                return deterministicMath.includes(name)
                    ? first(value.slice(2)) : `untracked runtime input: Math.${name}`
            }
        }
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
