/**
 * Type-level API for the Nix expression eDSL.
 *
 * @module
 */

type _Identifier = string

type _AttributeName = string

export type _AttributePath = readonly [_AttributeName, ..._AttributeName[]]

export type _Binding = readonly ['=', _AttributePath, Expression]

export type _Reference = readonly ['ref', _Identifier, ..._AttributeName[]]

export type _AttributeSet = readonly ['set', ..._Binding[]]

/**
 * A list literal. Items are references or strings — the two forms the
 * generators need, and the two the serializer can render without deciding when
 * a nested expression has to be parenthesised.
 */
export type _NixList = readonly ['list', ...(_Reference | string)[]]

type _ApplicationArgument = _Reference | _AttributeSet

export type _Application = readonly ['apply', _Reference, ..._ApplicationArgument[]]

export type _OpenSetPattern = readonly ['open-set-pattern', ..._Identifier[]]

export type _Lambda = readonly ['lambda', _OpenSetPattern, Expression]

export type _Let = readonly ['let', readonly _Binding[], Expression]

/**
 * A Nix indented string (`''…''`), as the parts it is made of.
 *
 * A `string` part is content: `''` and `${` in it are escaped, so it arrives in
 * the file as the text it is. A `_Reference` part is an interpolation, written
 * `${a.b}` and resolved by Nix — which is the only way a generated hook can
 * name a package, since a store path is not knowable when the file is written.
 */
export type _IndentedString = readonly ['indented-string', ...(string | _Reference)[]]

/** The Nix syntax supported by the serializer. */
export type Expression =
    | string
    | _Reference
    | _AttributeSet
    | _NixList
    | _Application
    | _Lambda
    | _Let
    | _IndentedString

export type _Chunks = readonly string[]
