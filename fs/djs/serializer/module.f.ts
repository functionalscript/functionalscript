/**
 * DJS serializer for formatting AST values back to source text.
 *
 * @module
 */
import type { Unknown, Object } from '../module.f.ts'
import type { Fold } from '../../types/function/operator/module.f.ts'
import type { Entry as ObjectEntry } from '../../types/object/module.f.ts'
import { fold } from '../../types/list/module.f.ts'
import { concat } from '../../types/string/module.f.ts'
import { type List, flat, flatMap, map, concat as listConcat } from '../../types/list/module.f.ts'
const { entries } = Object
import { compose, fn } from '../../types/function/module.f.ts'
import { serialize as bigintSerialize } from '../../types/bigint/module.f.ts'
import { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from '../../json/serializer/module.f.ts'

const colon = [':']

export const undefinedSerialize = ['undefined']

type RefCounter = readonly [number, number]

type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

type MapEntries = (entries: Entries) => Entries

type Refs = ReadonlyMap<Unknown, RefCounter>

/**
 * Returns the value's `RefCounter` only if it is *shared* (referenced more
 * than once) — otherwise `undefined`. Names the single predicate that drives
 * const hoisting in both `getConstants` (decide which values become consts)
 * and `serializeWithConst` (emit a `c<N>` reference to one).
 */
const sharedRef = (refs: Refs) => (v: Unknown): RefCounter | undefined => {
    const rc = refs.get(v)
    return rc !== undefined && rc[1] > 1 ? rc : undefined
}

type GetConstsState = {
    readonly added: ReadonlySet<Unknown>
    readonly consts: List<Unknown>
}

const getConstants
    : (refs: Refs) => (djs: Unknown) => List<Unknown>
    = refs => {
        const shared = sharedRef(refs)
        const checkSelf
            : Fold<Unknown, GetConstsState>
            = djs => state => {
                if (shared(djs) !== undefined && !state.added.has(djs)) {
                    return {
                        added: new Set([...state.added, djs]),
                        consts: { head: state.consts, tail: [djs] }
                    }
                }
                return state
            }
        const op
            : Fold<Unknown, GetConstsState>
            = djs => state => {
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
        const init: GetConstsState = { added: new Set(), consts: [] }
        return djs => op(djs)(init).consts
    }

const entryValue
    : (kv: readonly [string, Unknown]) => Unknown
    = kv => kv[1]

/**
 * A pre-hook consulted before each value's default serialization.
 * Returning a non-null list short-circuits the default path; this is how
 * `serializeWithConst` substitutes repeated values with `c<N>` references.
 */
type RefLookup = (value: Unknown) => List<string> | null

const noRef: RefLookup = () => null

const buildSerialize
    : (refLookup: RefLookup) => (sort: MapEntries) => (value: Unknown) => List<string>
    = refLookup => sort => {
        const propertySerialize
            : (kv: readonly [string, Unknown]) => List<string>
            = ([k, v]) => flat([
                stringSerialize(k),
                colon,
                f(v)
            ])
        const mapPropertySerialize = map(propertySerialize)
        const objectSerialize
            : (object: Object) => List<string>
            = fn(entries)
                .map(sort)
                .map(mapPropertySerialize)
                .map(objectWrap)
                .result
        const f
            : (value: Unknown) => List<string>
            = value => {
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

export const serializeWithoutConst
    : (mapEntries: MapEntries) => (value: Unknown) => List<string>
    = buildSerialize(noRef)

const serializeWithConst
    : (sort: MapEntries) => (refs: Refs) => (root: Unknown) => (djs: Unknown) => List<string>
    = sort => refs => {
        const shared = sharedRef(refs)
        return root => buildSerialize(value => {
            if (value === root) { return null }
            const rc = shared(value)
            if (rc !== undefined) { return [`c${rc[0]}`] }
            return null
        })(sort)
    }

const countRefsOp
    : Fold<Unknown, Refs>
    = djs => refs => {
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

const addRef
    : Fold<Unknown, Refs>
    = djs => refs => {
        const refCounter = refs.get(djs)
        const newCounter: RefCounter = refCounter === undefined
            ? [refs.size, 1]
            : [refCounter[0], refCounter[1] + 1]
        return new Map([...refs, [djs, newCounter]])
    }

export const stringify
    : (sort: MapEntries) => (djs: Unknown) => string
    = sort => djs => {
        const refs = countRefs(djs)
        const consts = getConstants(refs)(djs)
        const constSerialize
            : (entry: Unknown) => List<string>
            = entry => {
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

export const stringifyAsTree
    : (mapEntries: MapEntries) => (value: Unknown) => string
    = sort => compose(serializeWithoutConst(sort))(concat)


export const countRefs
    : (djs: Unknown) => Refs
    = djs => {
        return countRefsOp(djs)(new Map())
    }
