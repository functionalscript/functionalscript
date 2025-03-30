import type * as djs from '../module.f.ts'
import type { Fold } from '../../types/function/operator/module.f.ts'
import type * as O from '../../types/object/module.f.ts'
import { fold } from '../../types/list/module.f.ts'
import * as list from '../../types/list/module.f.ts'
import { type List, flat, flatMap } from '../../types/list/module.f.ts'
const { map } = list
const { entries } = Object
import * as f from '../../types/function/module.f.ts'
const { compose, fn } = f
import * as bi from '../../types/bigint/module.f.ts'
const { serialize: bigintSerialize } = bi
import * as serializer from '../../json/serializer/module.f.ts'
import { todo } from '../../dev/module.f.ts'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = serializer

const colon = [':']

export const undefinedSerialize = ['undefined']

type RefCounter = [number, number]

type Entry = O.Entry<djs.Unknown>

type Entries = List<Entry>

type MapEntries = (entries: Entries) => Entries

type Refs = Map<djs.Unknown, RefCounter>

const getConstantsOp
    :(refs: Refs) => (djs: djs.Unknown) => List<djs.Unknown>
    = refs => djs =>
    {        
        switch (typeof djs) {
            case 'boolean': { return null }
            case 'number':
            case 'string':
            case 'bigint': { return getConstantSelf(refs)(djs) }
            default: {
                if (djs === null) { return null }
                if (djs === undefined) { return null }
                if (djs instanceof Array) {
                    return { head: flatMap(getConstantsOp(refs))(djs), tail: getConstantSelf(refs)(djs) }
                }

                return { head: flatMap(getConstantsOp(refs))(map(entryValue)(entries(djs))), tail: getConstantSelf(refs)(djs) }
            }
        }
    }

const getConstantSelf
    :(refs: Refs) => (djs: djs.Unknown) => List<djs.Unknown>
    = refs => djs => {
        const refCounter = refs.get(djs)
        if (refCounter !== undefined && refCounter[1] > 1)
        {
            return [djs]
        }
        return null
    }

const getConstants 
    :(refs: Refs) => (djs: djs.Unknown) => List<djs.Unknown>
    = refs => djs => {
        return getConstantsOp(refs)(djs)
    }

const entryValue
    : (kv: readonly[string, djs.Unknown]) => djs.Unknown
    = kv => kv[1]

const serialize
    : (sort: MapEntries) => (refs: Refs) => (value: djs.Unknown) => List<string>
    = sort => refs => {
    const propertySerialize
    :(kv: readonly[string, djs.Unknown]) => List<string>
    = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    const objectSerialize
    : (object: djs.Object) => List<string>
    = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    const f
    : (value: djs.Unknown) => List<string>
    = value => {
        const refCounter = refs.get(value)
        if (refCounter !== undefined)
        {
            return [`c${refCounter[0]}`]
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
    :Fold<djs.Unknown, Refs>
    = djs => refs => {
        switch (typeof djs) {
            case 'boolean': { return refs }
            case 'number':
            case 'string':
            case 'bigint': { return addRef(djs)(refs) }
            default: {
                if (djs === null) { return refs }
                if (djs === undefined) { return refs }
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
    :Fold<djs.Unknown, Refs>
    = djs => refs => {
        const refCounter = refs.get(djs)
        if (refCounter === undefined)
        {
            return refs.set(djs, [refs.size, 1])
        }
        return refs.set(djs, [refCounter[0], refCounter[1] + 1])
    }

export const serializeWithConstants
    :(djs: djs.Unknown) => string
    = djs => {
        const refs = countRefs(djs)
        const consts = getConstants(refs)(djs)
        return todo()
    }

export const countRefs
    :(djs: djs.Unknown) => Refs
    = djs => {
        return countRefsOp(djs)(new Map())
    }