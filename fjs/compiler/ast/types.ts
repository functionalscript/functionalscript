/** Source operator vocabulary and module-loading records. @module */
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { binaryTags, eagerLayers, lazyLayers, prefixLayer, unaryTags } from './module.f.js'

/** A syntactic import selection; an empty import list has no selected name. */
export type AstImport = {
    readonly specifier: string
    readonly json: boolean
    readonly name: string | null
}

export type UnaryTag = '-' | '~' | '!' | 'typeof' | 'Number' | 'String' | 'BigInt'
export type BinaryTag =
    | '*' | '/' | '%' | '**'
    | '+' | '-'
    | '===' | '!==' | '<' | '<=' | '>' | '>='
    | '&' | '|' | '^' | '<<' | '>>' | '>>>'
    | '&&' | '||' | '??'

// Every source tag has a runtime row, and every precedence row names a tag.
type _UnaryTagsAreComplete = Assert<Equal<(typeof unaryTags)[number], UnaryTag>>
type _BinaryTagsAreComplete = Assert<Equal<(typeof binaryTags)[number], BinaryTag>>
type _Values<T> = T extends unknown ? T[keyof T] : never
type _LayerTag = _Values<(typeof eagerLayers)[number] | (typeof lazyLayers)[number]>
type _LayersAreComplete = Assert<Equal<_LayerTag | '**', BinaryTag | 'instanceof' | 'in'>>
type _PrefixesAreUnary = Assert<Equal<_Values<typeof prefixLayer>, Exclude<UnaryTag, 'Number' | 'String' | 'BigInt'>>>
