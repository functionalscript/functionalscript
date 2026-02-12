import { next, flat, map, type List } from '../types/list/module.f.ts'
import { concat } from '../types/string/module.f.ts'
import { at, type Entry as ObjectEntry } from '../types/object/module.f.ts'
import { compose, fn } from '../types/function/module.f.ts'
import { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from './serializer/module.f.ts'

const { entries } = Object

type Object = {
   readonly [k in string]: Unknown
}

type Array = readonly Unknown[]

export type Primitive = boolean | string | number | null

export type Unknown = Primitive | Object | Array

export const setProperty
    : (value: Unknown) => (path: List<string>) => (src: Unknown) => Unknown
    = value => {
        const f
            : (path: List<string>) => (src: Unknown) => Unknown
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

export type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

type MapEntries = (entries: Entries) => Entries

export const serialize
    : (mapEntries: MapEntries) => (value: Unknown) => List<string>
    = sort => {
        const propertySerialize
            : (kv: readonly[string, Unknown]) => List<string>
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

export const isObject = (value: Unknown): value is Object =>
    typeof value === 'object' && value !== null && !(value instanceof Array)
