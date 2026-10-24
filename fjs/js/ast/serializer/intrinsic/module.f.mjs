/** JavaScript syntax for EDAG intrinsic function values. @module
 * @import { IntrinsicId } from '../../../../edag/types.ts'
 * @import { Chunk } from '../../../../text/marked/types.ts'
 */

import { chunksText, keyword, literal } from '../../../../text/marked/module.f.mjs'
import { intrinsicLength } from '../../../../edag/module.f.mjs'
import { _name as name, _binding as binding, _arg as argName } from '../../../../compiler/serializer/names/module.f.mjs'

/**
 * The `entry` helper's text, the one spelling of `['entry']` — the
 * FunctionalScript writer's and this renderer's alike, so that `String(f)`
 * and the source output agree — over the symbolic names of its three
 * bindings at `path`: the two parameters, named as every function's are,
 * and the descriptor `const`.
 *
 * ```js
 * ($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}
 * ```
 *
 * @type {(path: string) => string}
 */
export const _entryText = path => chunksText(_entryChunks(path))

/**
 * {@link _entryText} as chunks: its keywords carry their kind, so the one
 * text has one spelling for the plain and the marked writer.
 *
 * @type {(path: string) => readonly Chunk[]}
 */
export const _entryChunks = path => {
    const a = argName(path, 0)
    const b = argName(path, 1)
    const x = name(`${path}/descriptor`)
    return [
        `(${binding(a)},${binding(b)})=>{`,
        keyword('const'),
        ` ${binding(x)}=Object.getOwnPropertyDescriptor(${a},${b});`,
        keyword('return'),
        ` ${x}?.enumerable?${x}.value:`,
        literal('undefined'),
        ';}',
    ]
}

/**
 * The `hasEntry` helper's text, the one spelling of `['hasEntry']`, as
 * {@link _entryText} is of `['entry']`: the same descriptor, the presence
 * returned.
 *
 * ```js
 * ($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;}
 * ```
 *
 * @type {(path: string) => string}
 */
export const _hasEntryText = path => chunksText(_hasEntryChunks(path))

/** {@link _hasEntryText} as chunks, as {@link _entryChunks}. @type {(path: string) => readonly Chunk[]} */
export const _hasEntryChunks = path => {
    const a = argName(path, 0)
    const b = argName(path, 1)
    const x = name(`${path}/descriptor`)
    return [
        `(${binding(a)},${binding(b)})=>{`,
        keyword('const'),
        ` ${binding(x)}=Object.getOwnPropertyDescriptor(${a},${b});`,
        keyword('return'),
        ` ${x}?.enumerable===`,
        literal('true'),
        ';}',
    ]
}

/** `0` to `n - 1`, in order. @type {(n: number) => readonly number[]} */
const indices = n => n <= 0 ? [] : [...indices(n - 1), n - 1]

/**
 * An intrinsic's helper's text, the one spelling of its node, `['slice']`,
 * as {@link _entryText} is of `['entry']`: the member call of the name on
 * the first parameter with the rest, over the parameters' symbolic names
 * at `path`, as many as the intrinsic's `length`.
 *
 * ```js
 * ($0,$1,$2)=>$0.slice($1,$2)
 * ```
 *
 * @type {(id: IntrinsicId) => (path: string) => string}
 */
export const _intrinsicText = id => path => chunksText(_intrinsicChunks(id)(path))

/** {@link _intrinsicText} as chunks, as {@link _entryChunks}: one, since the text holds no keyword and no literal. @type {(id: IntrinsicId) => (path: string) => readonly Chunk[]} */
export const _intrinsicChunks = id => path => {
    const names = indices(intrinsicLength(id)).map(k => argName(path, k))
    const [receiver, ...rest] = names
    return [`(${names.map(binding).join(',')})=>${receiver}.${id}(${rest.join(',')})`]
}
