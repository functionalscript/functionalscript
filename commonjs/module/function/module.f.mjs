// @ts-self-types="./module.f.d.mts"

/**
 * An IO interface for creating and running module functions.
 */

import * as TypesResult from '../../../types/result/module.f.mjs'

/** @typedef {<M>(require: Require<M>) => (prior: M) => Result<M>} Function_ */

/**
 * @template M
 * @typedef {readonly[TypesResult.Result<unknown, unknown>, M]} Result
 */

/**
 * @template M
 * @typedef {(path: string) => (prior: M) => Result<M>} Require
 */

/** @typedef {(source: string) => TypesResult.Result<Function_, unknown>} Compile */

export default {}
