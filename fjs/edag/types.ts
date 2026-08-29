/**
 * Type-level API for `fjs/edag/module.f.mjs`: `Exp`, the union of every EDAG
 * node kind — see the union immediately below for the current list, rather
 * than enumerating it here too, where it silently drifts stale as nodes are
 * added — each pinned against its rtti schema in the sibling module with
 * `Assert<Check<..., typeof ...>>`. Every tuple here is closed on both sides:
 * none of the schemas says `open`, so these types are exact rather than the
 * approximation `TupleTs` in `../rtti/ts/types.ts` describes.
 */

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Dot
    | Call
    | OptionDot
    | OptionCall
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

// chain lambdas — one type per state a chain can be in, named by the two bits
// of hidden control flow it carries: a live receiver (`Property`) and an open
// short-circuit region (`Option`). Neither bit live is a node boundary, which
// is why the fourth combination is an `Exp` and not a fourth type.
//
// A chain ends by **arity**: every production that can hand the chain on is
// written twice, once carrying its continuation and once one element shorter,
// so ending is the absence of that operand rather than a `null` in it. The
// tuples stay exact, which is what keeps a trailing hole unspellable.

/**
 * The continuation of a `Dot`: a receiver is live, no region is open.
 *
 * Only a call can be here — a property step would waste the receiver with no
 * region to keep it in, so `a.b.c` nests `Dot`s instead. `|()` is terminal
 * and so has only the shorter arity; `|?.()` opens a region and has both.
 */
export type PropertyLambda =
    | readonly['|()', Exp]
    | readonly['|?.()', Exp]
    | readonly['|?.()', Exp, OptionLambda]

/**
 * The continuation of a step that produced a plain value inside an open
 * region: `OptionCall`'s, and every call step that stays in its region.
 */
export type OptionLambda =
    | readonly['|()', Exp]
    | readonly['|()', Exp, OptionLambda]
    | readonly['|.', Index]
    | readonly['|.', Index, OptionPropertyLambda]

/**
 * The continuation of a property step inside an open region: both bits live,
 * so this is the state with every production — the three ways a call can
 * relate to the region it sits in, plus the property step the region keeps
 * from leaving. `|!()` closes the region and is terminal, so it alone has a
 * single arity.
 */
export type OptionPropertyLambda =
    | readonly['|()', Exp]
    | readonly['|()', Exp, OptionLambda]
    | readonly['|.', Index]
    | readonly['|.', Index, OptionPropertyLambda]
    | readonly['|?.()', Exp]
    | readonly['|?.()', Exp, OptionLambda]
    | readonly['|!()', Exp]

// call

export type Call = readonly['()', Exp, Exp]

// dot

export type Dot =
    | readonly['.', Exp, Index]
    | readonly['.', Exp, Index, PropertyLambda]

// optionDot

export type OptionDot =
    | readonly['?.', Exp, Index]
    | readonly['?.', Exp, Index, OptionPropertyLambda]

// optionCall

export type OptionCall =
    | readonly['?.()', Exp, Exp]
    | readonly['?.()', Exp, Exp, OptionLambda]

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
