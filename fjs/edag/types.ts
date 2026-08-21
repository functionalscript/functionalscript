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
    | PropertyAccessor
    | PropertyCall
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

export type Array = readonly['[]', Items]

// property

export type Property = readonly[':', Exp, Exp]

// object

export type Object = readonly['{}', readonly Property[]]

// Number

export type NumberCast = readonly['Number', Exp]

// Index — shape only; see `index` in `module.f.mjs` for what this doesn't
// cover (e.g. denylisted property names like `constructor`)

export type Index = number | NumberCast | string

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Index]

// propertyCall

export type PropertyCall = readonly['.()', Exp, Index, Exp]

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
    | '=>' | 'own' | '()'
    | '===' | '!==' | '>' | '>=' | '<' | '<='
    | '+' | '-' | '*' | '/' | '%' | '**'
    | '&' | '|' | '^' | '<<' | '>>' | '>>>'
    | '&&' | '||' | '??'

export type Op2 = readonly[Op2Id, Exp, Exp]
