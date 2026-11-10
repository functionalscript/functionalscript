/** Dependency manifests for one directory's isolated coverage. @module */

import type { Unknown } from '../../../media/json/types.ts'
import type { StringMap } from '../../../types/object/types.ts'
import type { IoChannel } from '../../../effects/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { AstImport } from '../../../compiler/ast/types.ts'
import type { _Source } from '../../../compiler/source/types.ts'
import type { List } from '../../../types/list/types.ts'
import type { Vec } from '../../../types/bit_vec/types.ts'

export type Manifest = {
    readonly version: 2
    readonly directory: string
    readonly targets: readonly string[]
    readonly files: StringMap<string>
    /** Immediate authored siblings mapped to closure-local module indices. */
    readonly roots: StringMap<number>
    /** Module identity sharing and ordered imports, independent of checkout URLs. */
    readonly modules: readonly {
        readonly path: string
        readonly json: boolean
        readonly imports: readonly number[]
    }[]
    readonly contract: Unknown
}

/** A single physical file's original chunks and content digest. */
export type _File = {
    readonly chunks: readonly Vec[]
    readonly bytes: List<number>
    readonly hash: string
}

/** Resolved edges retain module identity independently of the physical file. */
export type _Node = {
    readonly source: _Source
    readonly imports: readonly AstImport[]
    readonly children: readonly _Source[]
}

/** All immediate authored siblings, including distinct names for one module. */
export type _Directory = {
    readonly files: readonly string[]
    readonly roots: readonly { readonly path: string, readonly source: _Source }[]
}

/** One immutable run's sources and dependency edges. */
export type Graph = {
    readonly root: string
    readonly files: StringMap<Result<_File, IoChannel>>
    readonly imports: StringMap<Result<readonly AstImport[], IoChannel>>
    readonly nodes: StringMap<Result<_Node, IoChannel>>
    readonly directories: StringMap<Result<_Directory, IoChannel>>
}
