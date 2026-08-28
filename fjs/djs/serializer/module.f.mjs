/**
 * DJS serializer for formatting AST values back to source text.
 *
 * Two output formats share this one walk over the value: `stringify` emits a
 * JavaScript module and `stringifyAsTree` a JSON tree. They differ in `const`
 * hoisting and in how a property key is spelled — see `_KeySerialize`.
 *
 * @module
 *
 * @import { Unknown, Object, _MapEntries } from '../types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { _RefCounter, _Refs } from './types.ts'
 * @import { _KeySerialize, _RefLookup } from './private.ts'
 */

import { fold } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { flat, flatMap, map, concat as listConcat } from '../../types/list/module.f.mjs'
const { entries } = Object
import { compose, fn } from '../../types/function/module.f.mjs'
import { serialize as bigintSerialize } from '../../types/bigint/module.f.mjs'
import { objectWrap, arrayWrap, colon, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from '../../media/json/serializer/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

export const undefinedSerialize = ['undefined']

/**
 * Returns the value's `RefCounter` only if it is *shared* (referenced more
 * than once) — otherwise `undefined`. Names the single predicate that drives
 * const hoisting in both `getConstants` (decide which values become consts)
 * and `serializeWithConst` (emit a `c<N>` reference to one).
 * @type {(refs: _Refs) => (v: Unknown) => _RefCounter | undefined}
 */
const sharedRef = refs => v => {
    const rc = refs.get(v)
    return rc !== undefined && rc[1] > 1 ? rc : undefined
}

/** @type {(refs: _Refs) => (djs: Unknown) => List<Unknown>} */
const getConstants = refs => {
    /** @typedef {{
     *   readonly added: ReadonlySet<Unknown>
     *   readonly consts: List<Unknown>
     * }} _GetConstsState */
    const shared = sharedRef(refs)
    /** @type {Fold<Unknown, _GetConstsState>} */
    const checkSelf = djs => state => {
        if (shared(djs) !== undefined && !state.added.has(djs)) {
            return {
                added: new Set([...state.added, djs]),
                consts: { head: state.consts, tail: [djs] }
            }
        }
        return state
    }
    /** @type {Fold<Unknown, _GetConstsState>} */
    const op = djs => state => {
        switch (typeof djs) {
            case 'boolean': { return state }
            case 'number':
            case 'string':
            case 'bigint': { return checkSelf(djs)(state) }
            default: {
                if (djs === null) { return state }
                if (djs === undefined) { return state }
                if (djs instanceof Array) {
                    return checkSelf(djs)(fold(op)(state)(djs))
                }
                return checkSelf(djs)(fold(op)(state)(map(entryValue)(entries(djs))))
            }
        }
    }
    /** @type {_GetConstsState} */
    const init = { added: new Set(), consts: [] }
    return djs => op(djs)(init).consts
}

/** @type {(kv: readonly [string, Unknown]) => Unknown} */
const entryValue = kv => kv[1]

/** @type {_RefLookup} */
const noRef = () => null

const protoKey = '__proto__'

/**
 * JSON spells every key as a quoted string. `"__proto__"` included: `JSON.parse`
 * has no prototype special case, so the plain spelling already round-trips, and
 * the computed form below is not JSON at all.
 *
 * @type {_KeySerialize}
 */
const jsonKeySerialize = stringSerialize

/**
 * JavaScript reads `{"__proto__": v}` as a prototype assignment, so a module
 * emitting that spelling would not read back the value it was given. The
 * computed form is the only spelling whose evaluation reproduces the property,
 * which makes it a requirement of round-tripping rather than a style choice.
 * See [spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key).
 *
 * @type {_KeySerialize}
 */
const jsKeySerialize = key => key === protoKey
    ? flat([['['], stringSerialize(key), [']']])
    : stringSerialize(key)

/** @type {(keySerialize: _KeySerialize) => (refLookup: _RefLookup) => (sort: _MapEntries) => (value: Unknown) => List<string>} */
const buildSerialize = keySerialize => refLookup => sort => {
    /** @type {(kv: readonly [string, Unknown]) => List<string>} */
    const propertySerialize = ([k, v]) => flat([
        keySerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: Object) => List<string>} */
    const objectSerialize = fn(entries)
        .map(sort)
        .map(mapPropertySerialize)
        .map(objectWrap)
        .result
    /** @type {(value: Unknown) => List<string>} */
    const f = value => {
        const ref = refLookup(value)
        if (ref !== null) { return ref }
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return [bigintSerialize(value)] }
            default: {
                if (value === null) { return nullSerialize }
                if (value === undefined) { return undefinedSerialize }
                if (value instanceof Array) { return arraySerialize(value) }
                return objectSerialize(value)
            }
        }
    }
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

/**
 * Serializes a value as a JSON tree — no `const` hoisting, and JSON's key
 * spelling.
 *
 * @type {(mapEntries: _MapEntries) => (value: Unknown) => List<string>}
 */
export const serializeWithoutConst = buildSerialize(jsonKeySerialize)(noRef)

/** @type {(sort: _MapEntries) => (refs: _Refs) => (root: Unknown) => (djs: Unknown) => List<string>} */
const serializeWithConst = sort => refs => {
    const shared = sharedRef(refs)
    return root => buildSerialize(jsKeySerialize)(value => {
        if (value === root) { return null }
        const rc = shared(value)
        if (rc !== undefined) { return [`c${rc[0]}`] }
        return null
    })(sort)
}

/** @type {Fold<Unknown, _Refs>} */
const countRefsOp = djs => refs => {
    switch (typeof djs) {
        case 'boolean':
        case 'number': { return refs }
        case 'string':
        case 'bigint': { return addRef(djs)(refs) }
        default: {
            switch (djs) {
                case null:
                case undefined: { return refs }
            }

            if (djs instanceof Array) {
                if (refs.has(djs))
                    return addRef(djs)(refs)
                return addRef(djs)(fold(countRefsOp)(refs)(djs))
            }

            if (refs.has(djs))
                return addRef(djs)(refs)

            return addRef(djs)(fold(countRefsOp)(refs)(map(entryValue)(entries(djs))))
        }
    }
}

/** @type {Fold<Unknown, _Refs>} */
const addRef = djs => refs => {
    const refCounter = refs.get(djs)
    /** @type {_RefCounter} */
    const newCounter = refCounter === undefined
        ? [refs.size, 1]
        : [refCounter[0], refCounter[1] + 1]
    return new Map([...refs, [djs, newCounter]])
}

/**
 * Serializes a value as a JavaScript module: a shared value becomes a `const`,
 * and a `__proto__` key is written in the computed form the language requires.
 *
 * @type {(sort: _MapEntries) => (djs: Unknown) => string}
 */
export const stringify = sort => djs => {
    const refs = countRefs(djs)
    const consts = getConstants(refs)(djs)
    // `consts` only ever holds values `getConstants` found `shared` for, i.e.
    // values with an entry already in `refs` — so `refs.get(entry)` here is
    // always defined.
    /** @type {(entry: Unknown) => List<string>} */
    const constSerialize = entry => {
        const refCounter = assertNotNullish(refs.get(entry))
        return flat([['const c'], numberSerialize(refCounter[0]), [' = '], serializeWithConst(sort)(refs)(entry)(entry), ['\n']])
    }
    const constStrings = flatMap(constSerialize)(consts)
    const rootStrings = listConcat(['export default '])(serializeWithConst(sort)(refs)(djs)(djs))
    return concat(listConcat(constStrings)(rootStrings))
}

/**
 * Serializes a value as a JSON tree: shared values are expanded, and keys keep
 * JSON's plain spelling.
 *
 * @type {(mapEntries: _MapEntries) => (value: Unknown) => string}
 */
export const stringifyAsTree = sort => compose(serializeWithoutConst(sort))(concat)


/** @type {(djs: Unknown) => _Refs} */
export const countRefs = djs => {
    return countRefsOp(djs)(new Map())
}
