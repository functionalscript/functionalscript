/** Types for the elliptic curve playground's calculations and immutable UI state.
 * @module
 */

import type { Point } from '../../../crypto/secp/types.ts'

export type RealPoint = readonly [number, number]
export type Construction =
    | { readonly kind: 'finite', readonly slope: number, readonly third: RealPoint, readonly result: RealPoint }
    | { readonly kind: 'infinity' }
    | { readonly kind: 'refused', readonly message: string }
export type Calculation = { readonly result: Point, readonly lines: readonly string[] }
export type State = {
    readonly view: string
    readonly operation: string
    readonly k: string
    readonly p: string
    readonly q: string
    readonly target: string
    readonly realP: string
    readonly realQ: string
    readonly branchP: string
    readonly branchQ: string
    readonly curve: string
    readonly privateKey: string
    readonly generated: string | null
}
