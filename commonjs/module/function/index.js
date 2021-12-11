const result = require('../../../types/result')

/** @typedef {<M>(require: Require<M>) => (prior: M) => Result<M>} Function */

/**
 * @template M
 * @typedef {readonly[result.Result<unknown, unknown>, M]} Result 
 */

/**
 * @template M
 * @typedef {(path: string) => (prior: M) => Result<M>} Require
 */

/** @typedef {(source: string) => result.Result<Function, unknown>} Compile */

module.exports = {}
