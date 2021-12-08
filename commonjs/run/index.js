const result = require('../../types/result')

/** @typedef {<T>(req: Require<T>) => (prior: T) => ModuleResult<T>} Module*/

/**
 * @template T 
 * @typedef {readonly[result.Result<unknown, unknown>, T]} ModuleResult 
 */

/**
 * @template T 
 * @typedef {(path: string) => (prior: T) => ModuleResult<T>} Require
 */

/** @typedef {(source: string) => result.Result<Module, unknown>} Compile */

module.exports = {}