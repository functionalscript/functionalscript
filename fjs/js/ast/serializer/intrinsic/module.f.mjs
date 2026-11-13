/** JavaScript syntax for EDAG intrinsic function values. @module
 * @import { HelperId, IntrinsicId } from '../../../../edag/types.ts'
 * @import { Chunk } from '../../../../text/marked/types.ts'
 */

import { chunksText, keyword, literal } from '../../../../text/marked/module.f.mjs'
import { helperLength } from '../../../../edag/module.f.js'
import { _name as name, _binding as binding, _arg as argName } from '../names/module.f.mjs'

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

/**
 * The empty reference map's text, the one spelling of `['refMap']`
 * ([proposal](../../../../../spec/todo/reference-map.md)), as
 * {@link _entryText} is of `['entry']`. The body names itself, so that a
 * read of the empty map answers the empty map, and a helper is written
 * wherever a value stands, so the text binds that name itself: a `const`
 * inside an arrow called at once, the form the writer gives every function
 * that refers to itself.
 *
 * ```js
 * (()=>{const $0=($1,$2)=>{…return $2===undefined?[undefined,$0]:$10(undefined)($1,$2);};return $0;})()
 * ```
 *
 * @type {(path: string) => string}
 */
export const _refMapText = path => chunksText(_refMapChunks(path))

/** {@link _refMapText} as chunks, as {@link _entryChunks}. @type {(path: string) => readonly Chunk[]} */
export const _refMapChunks = path => {
    /** @type {(key: string) => string} */
    const local = key => name(`${path}/${key}`)
    const self = local('self')
    const key = argName(path, 0)
    const value = argName(path, 1)
    const ids = local('ids')
    const next = local('next')
    const get = local('get')
    const getNode = local('get/node')
    const getId = local('get/id')
    const set = local('set')
    const setNode = local('set/node')
    const setId = local('set/id')
    const setValue = local('set/value')
    const nodeValue = local('set/node/value')
    const zero = local('set/node/zero')
    const one = local('set/node/one')
    const make = local('make')
    const root = local('make/root')
    const map = local('map')
    const mapKey = local('map/key')
    const mapValue = local('map/value')
    const existing = local('map/existing')
    const old = local('map/old')
    const id = local('map/id')
    const constant = keyword('const')
    const returns = keyword('return')
    const absent = literal('undefined')
    return [
        '(()=>{', constant, ` ${binding(self)}=(${binding(key)},${binding(value)})=>{`,
        constant, ` ${binding(ids)}=`, keyword('new'), ' WeakMap();',
        keyword('let'), ` ${binding(next)}=1n;`,
        constant, ` ${binding(get)}=(${binding(getNode)},${binding(getId)})=>{`,
        keyword('while'), '(', literal('true'), '){',
        keyword('if'), `(${getNode}===`, absent, '){', returns, ' ', absent, ';}',
        keyword('if'), `(${getId}===1n){`, returns, ` ${getNode}.value;}`,
        `${getNode}=${getId}&1n?${getNode}.one:${getNode}.zero;${getId}>>=1n;}};`,
        constant, ` ${binding(set)}=(${binding(setNode)},${binding(setId)},${binding(setValue)})=>{`,
        constant, ` {value:${binding(nodeValue)},zero:${binding(zero)},one:${binding(one)}}=${setNode}??{};`,
        returns, ` ${setId}===1n?{value:${setValue},zero:${zero},one:${one}}`,
        `:${setId}&1n?{value:${nodeValue},zero:${zero},one:${set}(${one},${setId}>>1n,${setValue})}`,
        `:{value:${nodeValue},zero:${set}(${zero},${setId}>>1n,${setValue}),one:${one}};};`,
        constant, ` ${binding(make)}=${binding(root)}=>{`,
        constant, ` ${binding(map)}=(${binding(mapKey)},${binding(mapValue)})=>{`,
        constant, ` ${binding(existing)}=${ids}.get(${mapKey});`,
        constant, ` ${binding(old)}=${existing}===`, absent, '?', absent, `:${get}(${root},${existing});`,
        keyword('if'), `(${mapValue}===`, absent, '){', returns, ` [${old},${map}];}`,
        constant, ` ${binding(id)}=${existing}??${next}++;`,
        `${ids}.set(${mapKey},${id});`,
        returns, ` [${old},${make}(${set}(${root},${id},${mapValue}))];};`,
        returns, ` ${map};};`,
        returns, ` ${value}===`, absent, '?[', absent, `,${self}]:${make}(`, absent, `)(${key},${value});};`,
        returns, ` ${self};})()`,
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
    const names = indices(helperLength(id)).map(k => argName(path, k))
    const [receiver, ...rest] = names
    return [`(${names.map(binding).join(',')})=>${receiver}.${id}(${rest.join(',')})`]
}

/**
 * A helper's text by its tag, {@link _entryChunks}, {@link _hasEntryChunks},
 * {@link _refMapChunks} or {@link _intrinsicChunks}: the one dispatch from a helper node to its
 * spelling, which every writer asks.
 *
 * @type {(id: HelperId) => (path: string) => readonly Chunk[]}
 */
export const _helperChunks = id => id === 'entry' ? _entryChunks : id === 'hasEntry' ? _hasEntryChunks : id === 'refMap' ? _refMapChunks : _intrinsicChunks(id)

/** {@link _helperChunks} as text. @type {(id: HelperId) => (path: string) => string} */
export const _helperText = id => path => chunksText(_helperChunks(id)(path))
