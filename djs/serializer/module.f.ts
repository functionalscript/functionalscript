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

type RefCounter = [number, number, boolean]

type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

type MapEntries = (entries: Entries) => Entries

type Refs = Map<Unknown, RefCounter>

type GetConstsState = {
    refs: Refs,
    consts: List<Unknown>
}

const getConstantsOp
    : Fold<Unknown, GetConstsState>
    = djs => state => {
        switch (typeof djs) {
            case 'boolean': { return state }
            case 'number':
            case 'string':
            case 'bigint': { return getConstantSelf(djs)(state) }
            default: {
                if (djs === null) { return state }
                if (djs === undefined) { return state }
                if (djs instanceof Array) {
                    return getConstantSelf(djs)(fold(getConstantsOp)(state)(djs))
                }

                return getConstantSelf(djs)(fold(getConstantsOp)(state)(map(entryValue)(entries(djs))))
            }
        }
    }

const getConstantSelf
    : Fold<Unknown, GetConstsState>
    = djs => state => {
        const refs = state.refs
        const refCounter = refs.get(djs)
        if (refCounter !== undefined && refCounter[1] > 1 && !refCounter[2]) {
            refCounter[2] = true
            refs.set(djs, refCounter)
            return { refs, consts: { head: state.consts, tail: [djs] } }
        }
        return state
    }

const getConstants
    : Fold<Unknown, GetConstsState>
    = djs => refs => {
        return getConstantsOp(djs)(refs)
    }

const entryValue
    : (kv: readonly [string, Unknown]) => Unknown
    = kv => kv[1]

export const serializeWithoutConst
    : (mapEntries: MapEntries) => (value: Unknown) => List<string>
    = sort => {
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

const serializeWithConst
    : (sort: MapEntries) => (refs: Refs) => (root: Unknown) => (djs: Unknown) => List<string>
    = sort => refs => root => {
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
                if (value !== root) {
                    const refCounter = refs.get(value)
                    if (refCounter !== undefined && refCounter[1] > 1) {
                        return [`c${refCounter[0]}`]
                    }
                }
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
        if (refCounter === undefined) {
            return refs.set(djs, [refs.size, 1, false])
        }
        return refs.set(djs, [refCounter[0], refCounter[1] + 1, false])
    }

export const stringify
    : (sort: MapEntries) => (djs: Unknown) => string
    = sort => djs => {
        const refs = countRefs(djs)
        const consts = getConstants(djs)({ refs, consts: [] }).consts
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
