/**
 * Build-cache manifests and the committed file identities they describe.
 *
 * @module
 */

export type { Rung } from '../smart/types.ts'

export type Tree = { readonly [name in string]?: Tree | string }

export type File = readonly [path: string, id: string]

export type Manifest = {
    readonly contract: string
    readonly files: Tree
    readonly below?: string
}
