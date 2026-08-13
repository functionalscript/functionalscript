/**
 * DJS serializer for formatting AST values back to source text.
 *
 * @module
 *
 * @import { Unknown, Object } from '../types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { Entry as ObjectEntry } from '../../types/object/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { fold } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { flat, flatMap, map, concat as listConcat } from '../../types/list/module.f.mjs'
const { entries } = Object
import { compose, fn } from '../../types/function/module.f.mjs'
import { serialize as bigintSerialize } from '../../types/bigint/module.f.mjs'
import { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from '../../media/json/serializer/module.f.mjs'

const colon = [':']

export const undefinedSerialize = ['undefined']

/** @typedef {readonly [number, number]} _RefCounter */

/** @typedef {(entries: List<ObjectEntry<Unknown>>) => List<ObjectEntry<Unknown>>} _MapEntries */

/** @typedef {ReadonlyMap<Unknown, _RefCounter>} _Refs */

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

/** @typedef {{
 *   readonly added: ReadonlySet<Unknown>
 *   readonly consts: List<Unknown>
 * }} _GetConstsState */

/** @type {(refs: _Refs) => (djs: Unknown) => List<Unknown>} */
const getConstants = refs => {
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

/**
 * A pre-hook consulted before each value's default serialization.
 * Returning a non-null list short-circuits the default path; this is how
 * `serializeWithConst` substitutes repeated values with `c<N>` references.
 * @typedef {(value: Unknown) => List<string> | null} _RefLookup
 */

/** @type {_RefLookup} */
const noRef = () => null

/** @type {(refLookup: _RefLookup) => (sort: _MapEntries) => (value: Unknown) => List<string>} */
const buildSerialize = refLookup => sort => {
    /** @type {(kv: readonly [string, Unknown]) => List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
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

/** @type {(mapEntries: _MapEntries) => (value: Unknown) => List<string>} */
export const serializeWithoutConst = buildSerialize(noRef)

/** @type {(sort: _MapEntries) => (refs: _Refs) => (root: Unknown) => (djs: Unknown) => List<string>} */
const serializeWithConst = sort => refs => {
    const shared = sharedRef(refs)
    return root => buildSerialize(value => {
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

/** @type {(sort: _MapEntries) => (djs: Unknown) => string} */
export const stringify = sort => djs => {
    const refs = countRefs(djs)
    const consts = getConstants(refs)(djs)
    /** @type {(entry: Unknown) => List<string>} */
    const constSerialize = entry => {
        const refCounter = refs.get(entry)
        if (refCounter === undefined) {
            throw 'unexpected behavior'
        }
        return flat([['const c'], numberSerialize(refCounter[0]), [' = '], serializeWithConst(sort)(refs)(entry)(entry), ['\n']])
    }
    const constStrings = flatMap(constSerialize)(consts)
    const rootStrings = listConcat(['export default '])(serializeWithConst(sort)(refs)(djs)(djs))
    return concat(listConcat(constStrings)(rootStrings))
}

/** @type {(mapEntries: _MapEntries) => (value: Unknown) => string} */
export const stringifyAsTree = sort => compose(serializeWithoutConst(sort))(concat)


/** @type {(djs: Unknown) => _Refs} */
export const countRefs = djs => {
    return countRefsOp(djs)(new Map())
}
