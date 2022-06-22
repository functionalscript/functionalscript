/**
 * An IO interface for creating and running module functions.
 */

const result = require('../../../types/result/index.f.js')

/** @typedef {<M>(require: Require<M>) => (prior: M) => Result<M>} Function_ */

/**
 * @template M
 * @typedef {readonly[result.Result<unknown, unknown>, M]} Result
 */

/**
 * @template M
 * @typedef {(path: string) => (prior: M) => Result<M>} Require
 */

/** @typedef {(source: string) => result.Result<Function_, unknown>} Compile */

module.exports = {}
