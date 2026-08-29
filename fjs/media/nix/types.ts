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

export type _NixList = readonly ['list', ..._Reference[]]

type _ApplicationArgument = _Reference | _AttributeSet

export type _Application = readonly ['apply', _Reference, ..._ApplicationArgument[]]

export type _OpenSetPattern = readonly ['open-set-pattern', ..._Identifier[]]

export type _Lambda = readonly ['lambda', _OpenSetPattern, Expression]

export type _Let = readonly ['let', readonly _Binding[], Expression]

export type _IndentedString = readonly ['indented-string', string]

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
