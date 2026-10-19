/**
 * TypeScript source-emitter helpers: the `Equal`/`Assert` compile-time
 * predicates and a `Printer` that renders tuples, structs, arrays, records,
 * primitive literals, and unions as TypeScript type expressions.
 *
 * @module
 *
 * @import { Printer } from './types.ts'
 */

import { serialize as bigintSerialize } from '../bigint/module.f.mjs'
import { stringLiteral } from '../../js/string_escape/module.f.mjs'
import { tagged, untagged } from '../../text/marked/module.f.mjs'

/**
 * Marks a piece of the output. The printers build their text by templates, so
 * they tag what they spell ({@link tagged}) and the public functions strip the
 * tags: a type name such as `string` or `readonly` is a `keyword`, a literal
 * type is the `literal`, `string` or `number` it writes, and the `k` of
 * `[k in string]` an `identifier`.
 */
const kw = tagged('keyword')

const lit = tagged('literal')

const str = tagged('string')

const num = tagged('number')

const id = tagged('identifier')

/** @type {(open: string, close: string) => (i: readonly string[]) => string} */
const complex = (open, close) => i =>
    `${open}${i.join(',')}${close}`

const structX = complex('{', '}')

/**
 * Creates a `Printer` of tagged text, for a producer that resolves the tags
 * itself: `fjs/rtti/ts`. Pass `true` to emit mutable (non-`readonly`) types.
 *
 * @type {(mut?: true) => Printer}
 */
export const _taggedPrinter = (mut = undefined) => {
    const ro = mut ? '' : kw('readonly')
    return {
        tuple: complex(`${ro}[`, ']'),
        struct: fields =>
            structX(fields.map(([k, v, opt]) => `${ro}${str(stringLiteral(k))}${opt === true ? '?' : ''}:${v}`)),
        array: type => `${ro}(${type})[]`,
        // `[k:string]?:` is invalid TypeScript — optional keys on an infinite
        // key set require mapped-type syntax.
        record: type => structX([`${ro}[${id('k')} ${kw('in')} ${kw('string')}]?:${type}`]),
    }
}

/**
 * Creates a `Printer`. Pass `true` to emit mutable (non-`readonly`) types.
 *
 * @type {(mut?: true) => Printer}
 */
export const printer = mut => {
    const p = _taggedPrinter(mut)
    return {
        tuple: types => untagged(p.tuple(types)),
        struct: fields => untagged(p.struct(fields)),
        array: type => untagged(p.array(type)),
        record: type => untagged(p.record(type)),
    }
}

/**
 * A primitive type as tagged text.
 *
 * @type {(c: bigint|string|undefined|boolean|number|null) => string}
 */
export const _taggedPrimitive = c => {
    if (c === null) { return lit('null') }
    switch (typeof c) {
        case 'bigint': return num(bigintSerialize(c))
        case 'string': return str(stringLiteral(c))
        case 'number': return Number.isFinite(c) ? num(String(c)) : kw('number')
        case 'undefined': return kw('undefined')
        case 'boolean': return lit(String(c))
    }
}

/**
 * @type {(c: bigint|string|undefined|boolean|number|null) => string}
 */
export const primitive = c => untagged(_taggedPrimitive(c))

/** @type {(types: readonly string[]) => string} */
export const _taggedUnion = types =>
    types.length === 0 ? kw('never') : types.join('|')

/** @type {(types: readonly string[]) => string} */
export const union = types => untagged(_taggedUnion(types))
