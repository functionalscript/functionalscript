// @ts-self-types="./module.f.d.mts"

import * as list from '../../types/list/module.f.mjs'
const { flat, map } = list
import * as string from '../../types/string/module.f.mjs'
const { concat } = string
import * as O from '../../types/object/module.f.mjs'
import * as f from '../../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import * as bi from '../../types/bigint/module.f.mjs'
const { serialize: bigintSerialize } = bi
import * as j from '../../json/serializer/module.f.mjs'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = j
import * as DjsParser from '../parser/module.f.mjs'

const colon = [':']

const undefinedSerialize = ['undefined']

/** @typedef {O.Entry<DjsParser.DjsConst>} Entry*/

/** @typedef {(list.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: DjsParser.DjsConst) => list.List<string>} */
const djsConstSerialize = sort => {
    /** @type {(kv: readonly[string, DjsParser.DjsConst]) => list.List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])    
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: DjsParser.DjsObject) => list.List<string>} */
    const objectSerialize = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    /** @type {(value: DjsParser.DjsConst) => list.List<string>} */
    const f = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return [bigintSerialize(value)] }
            default: {
                if (value === null) { return nullSerialize }
                if (value === undefined) { return undefinedSerialize }
                if (value instanceof Array) {
                    switch (value[0]) {
                        case 'aref': { return [`_a${value[1]}`] }
                        case 'cref': { return [`_c${value[1]}`] }
                        case 'array': { return arraySerialize(value[1]) }
                    }
                }
                return objectSerialize(value)
            }
        }
    }        
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

// /** @type {(mapEntries: MapEntries) => (djsModule: DjsParser.DjsModule) => string} */
// export const moduleSerialize =  sort => djsModule => {
//     compose(map(serializeDjsConst))(arrayWrap)(djsModule[1])
// }

/**
 * @type {(mapEntries: MapEntries) => (value: DjsParser.DjsConst) => string}
 */
export const djsConstStringify = sort => compose(djsConstSerialize(sort))(concat)

