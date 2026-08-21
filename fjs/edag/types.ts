/**
 * Type-level API for `fjs/edag/module.f.mjs`: `Exp`, the union of every EDAG
 * node kind — see the union immediately below for the current list, rather
 * than enumerating it here too, where it silently drifts stale as nodes are
 * added — each pinned against its rtti schema in the sibling module with
 * `Assert<Check<..., typeof ...>>`.
 */

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Args
    | NumberCast
    | StringCast
    | PropertyAccessor
    | Call
    | PropertyCall
    | Own
    | Neg
    | Comma
    | Fn
    | Frame
    | BinaryOp

// undefinedOp

export type UndefinedOp = readonly['undefined']

// primitive

export type Primitive = UndefinedOp | null | boolean | number | string | bigint

// expressions

export type Exps = readonly Exp[]

// array

export type Array = readonly['[]', Exps]

// property

export type Property = readonly[':', Exp, Exp]

// object

export type Object = readonly['{}', readonly Property[]]

// args

export type Args = readonly['args']

// Number

export type NumberCast = readonly['Number', Exp]

// String

export type StringCast = readonly['String', Exp]

// Index — shape only; see `index` in `module.f.mjs` for what this doesn't
// cover (e.g. denylisted property names like `constructor`)

export type Index = number | NumberCast | string

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Index]

// call

export type Call = readonly['()', Exp, Exp]

// propertyCall

export type PropertyCall = readonly['.()', Exp, Index, Exp]

// own

export type Own = readonly ['own', Exp, Exp]

// Binary +

export type Add = readonly['+', Exp, Exp]

// Binary -

export type Sub = readonly['-', Exp, Exp]

// negation (aka a unary minus — a word tag, `"neg"`, not `"-"`'s unary
// arity, so it doesn't share a tag with `Sub`)

export type Neg = readonly['neg', Exp]

// Comma

export type Comma = readonly[',', Exps]

// Fn

export type Fn = readonly['=>', Exp, Exp]

// Frame

export type Frame = readonly['frame']

// BinaryOpNames

export type BinaryOpId =
    | '===' | '!==' | '>' | '>=' | '<'  | '<='
    | '+'   | '-'   | '*' | '/'  | '%'  | '**'
    | '&'   | '|'   | '^' | '<<' | '>>' | '>>>'
    | '&&'  | '||'  | '??'

export type BinaryOp = readonly[BinaryOpId, Exp, Exp]
