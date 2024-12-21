import * as list from '../types/list/module.f.mjs'
const { next, flat, map } = list
import * as string  from '../types/string/module.f.mjs'
const { concat } = string
import * as object from '../types/object/module.f.mjs'
const { at } = object
import * as f from '../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import * as s from './serializer/module.f.mjs'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = s

type Object = {
   readonly [k in string]: Unknown
}

type Array = readonly Unknown[]

export type Unknown = Object|boolean|string|number|null|Array

export const setProperty
    : (value: Unknown) => (path: list.List<string>) => (src: Unknown) => Unknown
    = value => {
    const f
        : (path: list.List<string>) => (src: Unknown) => Unknown
        = path => src => {
        const result = next(path)
        if (result === null) { return value }
        const srcObject = (src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(at(first)(srcObject)) }
    }
    return f
}

const colon = [':']

export type Entry = object.Entry<Unknown>

type Entries = list.List<Entry>

type MapEntries = (entries: Entries) => Entries

export const serialize
    : (mapEntries: MapEntries) => (value: Unknown) => list.List<string>
    = sort => {
    const propertySerialize
        : (kv: readonly[string, Unknown]) => list.List<string>
        = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    const objectSerialize
        : (object: Object) => list.List<string>
        = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    const f
        : (value: Unknown) => list.List<string>
        = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            default: {
                if (value === null) { return nullSerialize }
                if (value instanceof Array) { return arraySerialize(value) }
                return objectSerialize(value)
            }
        }
    }
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 */
export const stringify
    : (mapEntries: MapEntries) => (value: Unknown) => string
    = sort => compose(serialize(sort))(concat)

export const parse
    : (value: string) => Unknown
    = JSON.parse

export const isObject
    = (value: Unknown): value is Object =>
        typeof value === 'object' && value !== null && !(value instanceof Array)
