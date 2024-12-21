/**
 * An IO interface for creating and running module functions.
 */

import * as TypesResult from '../../../types/result/module.f.ts'

export type Function_ = <M>(require: Require<M>) => (prior: M) => Result<M>

export type Result<M> = readonly[TypesResult.Result<unknown, unknown>, M]

export type Require<M> = (path: string) => (prior: M) => Result<M>

export type Compile = (source: string) => TypesResult.Result<Function_, unknown>
