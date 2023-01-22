const result = require('../../types/result/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { fold, isEmpty } = list
const operator = require('../../types/function/operator/module.f.cjs')
const tokenizer = require('../tokenizer/module.f.cjs')
const map = require('../../types/map/module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')


/**
 * @typedef {{
* readonly kind: 'object'
* readonly value: map.Map<any>
* }} JsonObject
* */

/**
 * @typedef {{
* readonly kind: 'array'
* readonly value: list.List<any>
* }} JsonArray
* */

/**
 * @typedef {{
* readonly kind: 'number'
* readonly value: number
* }} JsonNumber
* */

/**
 * @typedef {{
* readonly kind: 'string'
* readonly value: string
* }} JsonString
* */

/**
 * @typedef {{
* readonly kind: 'string'
* readonly value: boolean
* }} JsonBoolean
* */

/**
 * @typedef {{
* readonly kind: 'null'
* }} JsonNull
* */

/**
 * @typedef {|
* JsonObject |
* JsonArray |
* JsonNumber |
* JsonString |
* JsonBoolean |
* JsonNull 
* } JsonValue
*/

/**
 * @typedef {|
* JsonObject |
* JsonArray
* } JsonStackElement
*/

/** @typedef {list.List<JsonStackElement>} JsonStack */

/**
 * @typedef {{
*  readonly kind: 'start'
*  readonly stack: JsonStack
* }} StateStart
*/

/**
 * @typedef {{
*  readonly kind: 'end'
*  readonly value: any
* }} StateEnd
*/

/**
 * @typedef {|
* StateStart |
* StateEnd
* } JsonState
*/

/** @type {operator.Fold<tokenizer.JsonToken, JsonState>} */
const foldOp = token => state => {
    switch(state.kind) {
        case 'start': {
            switch(token.kind) {
                case 'null': return { kind: 'end', value: null }
                case 'false': return { kind: 'end', value: false }
                case 'true': return { kind: 'end', value: true }
                case 'number': return { kind: 'end', value: Number(token.value) }
                case 'string': return { kind: 'end', value: token.value }
                default: return todo()
            }
        }
        default: return todo()
    }
}

/** @type {(tokens: list.List<tokenizer.JsonToken>) => result.Result<any, string>} */
const parse = tokens => {
    const state = fold(foldOp)({ kind: "start", stack: null })(tokens)
    switch(state.kind) {
        case 'end': return  result.ok(state.value)
        default: return result.error("unexpected end")
    }
}

module.exports = {
    /** @readonly */
    parse
}