const result = require('../../result')

/** @typedef {<T>(req: Require<T>) => (prior: T) => ModuleResult<T>} Module*/

/**
 * @template T 
 * @typedef {readonly[result.Result<unknown, unknown>, T]} ModuleResult 
 */

/**
 * @template T 
 * @typedef {(prior: T) => (path: string) => ModuleResult<T>} Require 
 */

/** @typedef {(source: string) => result.Result<Module, unknown>} Compile */

module.exports = {}