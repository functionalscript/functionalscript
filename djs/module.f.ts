import * as list from '../types/list/module.f.mjs'
const { flat, map } = list
import * as string from '../types/string/module.f.mjs'
const { concat } = string
import * as O from '../types/object/module.f.mjs'
import * as f from '../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import * as bi from '../types/bigint/module.f.mjs'
const { serialize: bigintSerialize } = bi
import * as j from '../json/serializer/module.f.ts'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = j

type Object = {
   readonly [k in string]: Unknown
}

type Array = readonly Unknown[]

type Unknown = Object|boolean|string|number|null|Array|bigint|undefined

const colon = [':']

const undefinedSerialize = ['undefined']

type Entry = O.Entry<Unknown>

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
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 */
export const stringify
    : (mapEntries: MapEntries) => (value: Unknown) => string
    = sort => compose(serialize(sort))(concat)
