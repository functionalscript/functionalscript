const map = require('../../types/map')
const object = require('../../types/object')
const run = require('../run')
const seq = require('../../types/sequence')

/**
 * @typedef {{
 *  readonly map: object.Map<string>
 *  readonly run: run.Module
 * }} Module
 */

/** 
 * @typedef {{
 *  readonly map: map.MapI<Module>
 *  readonly order: seq.Sequence<string>
 * }} Cache 
 */

/** @typedef {(path: string) => string|undefined} ReadFile */

module.exports = {}
