const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const { toArray, countdown, length } = require('../list/module.f.cjs')
const map = require('../map/module.f.cjs')
const { flip } = require('../function/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {<T>(a: T) => (b: T) => map.Sign} */
const reverseCmp = flip(unsafeCmp)

module.exports = {

}