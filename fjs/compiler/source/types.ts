/** Shared filesystem source identities. @module */

/** The host supplies stable identity and a path for loading and diagnostics. */
export type _Source = {
    readonly id: string
    readonly path: string
    readonly json: boolean
}

/** A resolved import retains its selection independently of module identity. */
export type _ImportSource = _Source & { readonly name: string | null }
