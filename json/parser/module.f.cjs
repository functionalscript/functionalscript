const result = require('../../types/result/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { fold } = list
const operator = require('../../types/function/operator/module.f.cjs')
const tokenizer = require('../tokenizer/module.f.cjs')
const map = require('../../types/map/module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')

/** @typedef {map.Map<any>} JsonObject */

/** @typedef {list.List<any>} JsonArray */

/**
 * @typedef {|
* JsonObject |
* JsonArray
* } JsonStackElement
*/

/** @typedef {list.List<JsonStackElement>} JsonStack */

/**
 * @typedef {{
*  readonly stack: JsonStack
*  readonly state: string
* }} JsonState
*/

/** @type {operator.Fold<tokenizer.JsonToken, JsonState>} */
const foldOp = token => state => {
    return todo()
}

/** @type {(tokens: list.List<tokenizer.JsonToken>) => result.Result<any, string>} */
const parse = tokens => {
    fold(foldOp)({stack: null, state: ""})(tokens)
    return todo()
}

module.exports = {
    /** @readonly */
    parse
}
