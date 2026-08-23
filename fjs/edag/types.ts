/**
 * Type-level API for `fjs/edag/module.f.mjs`: `Exp`, the union of every EDAG
 * node kind — see the union immediately below for the current list, rather
 * than enumerating it here too, where it silently drifts stale as nodes are
 * added — each pinned against its rtti schema in the sibling module with
 * `Assert<Check<..., typeof ...>>`. The pin is exact up to tuple openness:
 * the schema accepts trailing extras (`['args', 'extra']` validates) while
 * these tuples are closed — the rendering approximation documented at
 * `TupleTs` in `../types/rtti/ts/types.ts`.
 */

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | PropertyAccessor
    | Call
    | OptionalPropertyAccessor
    | OptionalCall
    | Comma
    | Op2
    | Op1
    | Op0

// primitive

/**
 * Bare constant values, not operation nodes — `undefined` is deliberately
 * excluded, since `['undefined']` is a tagged `Op0` operation, not a bare
 * value; see `primitive` in `module.f.mjs`.
 */
export type Primitive = null | boolean | number | string | bigint

// expressions

export type Exps = readonly Exp[]

// spread

export type Spread = readonly['...', Exp]

// array items

export type Items = Exp | Spread

// array

export type Array = readonly['[]', readonly Items[]]

// property

export type Property = readonly[':', Exp, Exp]

// properties

export type Properties = Property | Spread

// object

export type Object = readonly['{}', readonly Properties[]]

// Number

export type NumberCast = readonly['Number', Exp]

// Index — shape only; see `index` in `module.f.mjs` for what this doesn't
// cover (e.g. denylisted property names like `constructor`)

export type Index = number | NumberCast | string

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Index]

// lambdas

export type LambdaPropertyAccessor = readonly['|.', Index]

export type LambdaCall = readonly['|()', Exp]

export type LambdaOptionalPropertyAccessor = readonly['|?.', Index]

export type LambdaOptionalCall = readonly['|?.()', Exp]

/**
 * A structural step of a chain, never an `Exp`: a `Lambda` reads the
 * current chain value implicitly, so it has no place to hold one, and it
 * cannot be extracted as a shared computation node.
 */
export type Lambda =
    | LambdaPropertyAccessor
    | LambdaCall
    | LambdaOptionalPropertyAccessor
    | LambdaOptionalCall

export type Lambdas = readonly Lambda[]

// call

export type Call = readonly['()', Exp, Lambdas, Exp]

// optionalPropertyAccessor

export type OptionalPropertyAccessor = readonly['?.', Exp, Index, Lambdas]

// optionalCall

export type OptionalCall = readonly['?.()', Exp, Lambdas, Exp, Lambdas]

// Comma

export type Comma = readonly[',', Exps]

// Op0Ids

export type Op0Id =
    | 'undefined' | 'args' | 'frame'

export type Op0 = readonly[Op0Id]

// Op1Ids

export type Op1Id =
    | 'String' | 'Number' | 'neg' | '!' | '~'

export type Op1 = readonly[Op1Id, Exp]

// Op2Ids

export type Op2Id =
    | '=>' | 'own'
    | '===' | '!==' | '>' | '>=' | '<' | '<='
    | '+' | '-' | '*' | '/' | '%' | '**'
    | '&' | '|' | '^' | '<<' | '>>' | '>>>'
    | '&&' | '||' | '??'

export type Op2 = readonly[Op2Id, Exp, Exp]
