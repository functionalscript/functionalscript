/**
 * JSON utilities: `serialize`, `stringify`, `parse`, and `setProperty` for
 * immutable nested updates.
 *
 * `parse` is the total, `Result`-returning `text → Unknown` entry point built
 * on this module's own tokenizer and parser.
 *
 * The JSON value types (`Unknown`, `Primitive`, `Object`, `Array`) live in
 * [`./types.ts`](./types.ts), and the rtti schemas they are pinned against in
 * [`./rtti/module.f.mjs`](./rtti/module.f.mjs).
 *
 * This is the standard, bigint-free codec: numbers are JavaScript `number`s.
 * [`./extended/module.f.mjs`](./extended/module.f.mjs) is the sibling codec
 * that keeps JSON's bare integer syntax as `bigint`. Both are numeric policies
 * over the same tokenizer and the same structural parser — see
 * [`./README.md`](./README.md).
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { _MapEntries, Primitive, Unknown, } from './types.ts'
 * @import { NumberPolicy } from './parser/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { next } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { parse as parseTokens } from './parser/module.f.mjs'
import { tokenize } from './tokenizer/module.f.mjs'
import { at } from '../../types/object/module.f.mjs'
import { compose } from '../../types/function/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { treeSerialize, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from './serializer/module.f.mjs'

// ── JSON utilities ────────────────────────────────────────────────────────────

/**
 * @param {Unknown} value
 */
export const setProperty = value => {
    /** @type {(path: List<string>) => (src: Unknown) => Unknown} */
    const f = path => src =>{
        const result = next(path)
        if (result === null) { return value }
        const srcObject = (src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(at(first)(srcObject)) }
    }
    return f
}

/**
 * The standard codec's leaf spelling. The containers around it are
 * `treeSerialize`'s, shared with every other JSON codec.
 *
 * @type {(value: Primitive) => List<string>}
 */
const primitiveSerialize = value => {
    switch (typeof value) {
        case 'boolean': { return boolSerialize(value) }
        case 'number': { return numberSerialize(value) }
        case 'string': { return stringSerialize(value) }
        default: { return nullSerialize }
    }
}

/** @type {(mapEntries: _MapEntries) => (value: Unknown) => List<string>} */
export const serialize = treeSerialize(primitiveSerialize)

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 * https://tc39.es/ecma262/#sec-serializejsonproperty
 *
 * @type {(mapEntries: _MapEntries) => (value: Unknown) => string}
 */
export const stringify = sort => compose(serialize(sort))(concat)

/**
 * The standard codec's numeric policy: every JSON number token becomes a
 * JavaScript `number`, read from the token's own lexeme.
 *
 * It is total — no valid JSON number is rejected — so a magnitude outside the
 * finite `number` range materializes the way JavaScript itself reads that
 * text (`1e400` is `Infinity`, `1e-400` is `0`). The bigint-free domain has
 * nothing more exact to offer; the extended codec keeps such distinctions,
 * from the same token, without this one having to.
 *
 * @type {NumberPolicy<number>}
 */
const numberPolicy = token => ok(parseFloat(token.value))

/**
 * Parses `text` as JSON with this module's own pure tokenizer and parser,
 * reporting failure as a `Result` rather than throwing: malformed input is
 * *available* as an `error` to branch on. Whether to branch or to `unwrap` it
 * back into a panic is the caller's decision — the parser no longer makes it
 * for them.
 *
 * The result is an untyped {@link Unknown}; narrow it to a domain type with an
 * rtti schema (`fjs/types/rtti/parse`) rather than with an `as` cast.
 *
 * @type {(text: string) => Result<Unknown, string>}
 */
export const parse = text => parseTokens(numberPolicy)(tokenize(stringToList(text)))
