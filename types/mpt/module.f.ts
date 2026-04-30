import { todo } from '../../dev/module.f.ts'
import type { StateScan } from '../function/operator/module.f.ts'

/**
 * [left, right, hash]
 */
export type Node = readonly[bigint, bigint, bigint]

export type Compress = (a: bigint, b: bigint) => bigint

export type Candidate = readonly[bigint, bigint]

export type State = readonly Candidate[]

/**
 * Builds a left-fold Merkle chain over a stream of symbols.
 * Each symbol after the first emits one completed {@link Node}.
 * The final `State` is the root hash of the whole sequence.
 */
export const mpt = (compress: Compress): StateScan<bigint, State, readonly Node[]> =>
    todo()