import { todo } from "../../dev/module.f.ts"

export type State = undefined

/**
 * [left, right, hash]
 */
export type Node = readonly[bigint, bigint, bigint]

export type Compress = (a: bigint, b: bigint) => bigint

const mpt = (compress: Compress) => (state: State) => (u: bigint): readonly[readonly Node[], State] => {
    return todo()
}
