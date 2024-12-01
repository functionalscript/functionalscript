/**
 * An IO interface for creating and running module functions.
 */

import * as Result from '../../../types/result/module.f.mjs'

/** @typedef {<M>(require: Require<M>) => (prior: M) => Result<M>} Function_ */

/**
 * @template M
 * @typedef {readonly[Result.Result<unknown, unknown>, M]} Result
 */

/**
 * @template M
 * @typedef {(path: string) => (prior: M) => Result<M>} Require
 */

/** @typedef {(source: string) => Result.Result<Function_, unknown>} Compile */

export default {}
