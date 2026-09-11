/**
 * Type-level API for `fjs/edag/module.f.mjs`: `Exp`, the union of every EDAG
 * node kind — see the union immediately below for the current list, rather
 * than enumerating it here too, where it silently drifts stale as nodes are
 * added — each pinned against its rtti schema in the sibling module with
 * `Assert<Check<..., typeof ...>>`. Every tuple here is closed on both sides:
 * none of the schemas says `open`, so these types are exact rather than the
 * approximation `TupleTs` in `../rtti/ts/types.ts` describes.
 */

import type { Assert } from '../asserts/types.ts'
import type { Check, Check3 } from '../rtti/ts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type {
    _exp,
    _optionLambda,
    _optionPropertyLambda,
    array,
    call,
    comma,
    dot,
    exp,
    exps,
    items,
    numberCast,
    object,
    op0,
    op0Id,
    op1,
    op1Id,
    op12,
    op12Id,
    op2,
    op2Id,
    op3,
    op3Id,
    optionCall,
    optionDot,
    optionLambda,
    optionPropertyLambda,
    primitive,
    properties,
    property,
    propertyLambda,
    spread,
} from './module.f.mjs'

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
    | Op3
    | Op12
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
    | OptionLambda
    | readonly['|?.()', Exp]
    | readonly['|?.()', Exp, OptionLambda]
    | readonly['|!()', Exp]

// The chain states nest, and saying so beats restating the four productions
// the two option states share — which is what both of these used to do, and
// what `module.f.mjs`'s `regionProductions` now does once for the schema.
//
// These came here ahead of the schema pins below, for the reason those
// followed: a `@typedef` in `proof.f.mjs` is checked only where a statement
// follows it in the same block, and the `consistency` entry that held them
// was nothing but typedefs. A module-scope alias in a `.ts` file is resolved
// either way — `../AGENTS.md` §1.4 states the rule, and
// `../../todo/inert-type-level-proofs.md` moves what is left elsewhere.

type _OptionInsideOptionProperty = Assert<Equal<OptionLambda extends OptionPropertyLambda ? true : false, true>>
type _PropertyInsideOptionProperty = Assert<Equal<PropertyLambda extends OptionPropertyLambda ? true : false, true>>

// ... and exactly which three productions the wider state adds, so a change
// to one of *those three*, or a containment broken, is a type error rather
// than a silent change of what the grammar admits.
//
// The shared segment is not theirs to pin, in either direction. An arm
// gained or lost there lands on both sides of the `Exclude` and cancels,
// so all three stay green — measured both ways, zero errors from these.
// The pin for the shared segment is `_OptionLambda` below, the schema
// against the type, which either change makes disagree.
type _OptionPropertyAdds = Assert<Equal<
    Exclude<OptionPropertyLambda, OptionLambda>,
    | readonly['|?.()', Exp]
    | readonly['|?.()', Exp, OptionLambda]
    | readonly['|!()', Exp]>>

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
    | 'String' | 'Number' | '!' | '~' | 'typeof'

export type Op1 = readonly[Op1Id, Exp]

// Op2Ids

export type Op2Id =
    | '=>' | 'own'
    | '===' | '!==' | '>' | '>=' | '<' | '<='
    | '*' | '/' | '%' | '**'
    | '&' | '|' | '^' | '<<' | '>>' | '>>>'
    | '&&' | '||' | '??'

export type Op2 = readonly[Op2Id, Exp, Exp]

// Op12Ids — the tags legal at both arities. Disjoint from `Op1Id` and
// `Op2Id`, so those two still fix an operand count by membership alone;
// here the node's length does, one closed tuple per arity like a chain step.

export type Op12Id = '+' | '-'

export type Op12 =
    | readonly[Op12Id, Exp]
    | readonly[Op12Id, Exp, Exp]

// Op3Ids — the conditional, and the first node whose operand shape is lazy
// on its own account: the condition is established, then exactly one arm.
// See `op3` in `module.f.mjs`.

export type Op3Id = '?:'

export type Op3 = readonly[Op3Id, Exp, Exp, Exp]

// Each RTTI constant in `./module.f.mjs` matches its declared type above.
//
// These were `proof.f.mjs`'s `consistency` entry, whose body was nothing but
// typedefs — so none of them bound to anything and all 28 were green whatever
// they claimed (`../AGENTS.md` §1.4, `../../todo/inert-type-level-proofs.md`).
// At module scope in a `.ts` file an alias is resolved on sight, so each one
// below was falsified once and seen to fail before being restored.
//
// `Check3` is for the three schemas that are thunks behind a `Phantom`: it
// checks the raw thunk as well as the wrapped export, since checking only the
// wrapped one is a tautology — `Ts<>` short-circuits to the annotation.

type _ExpAssert = Assert<Check3<Exp, typeof _exp, typeof exp>>
type _Primitive = Assert<Check<Primitive, typeof primitive>>
type _Exps = Assert<Check<Exps, typeof exps>>
type _Spread = Assert<Check<Spread, typeof spread>>
type _Items = Assert<Check<Items, typeof items>>
type _Array = Assert<Check<Array, typeof array>>
type _Property = Assert<Check<Property, typeof property>>
type _Properties = Assert<Check<Properties, typeof properties>>
type _Object = Assert<Check<Object, typeof object>>
type _NumberCast = Assert<Check<NumberCast, typeof numberCast>>
type _OptionLambda = Assert<Check3<OptionLambda, typeof _optionLambda, typeof optionLambda>>
type _OptionPropertyLambda = Assert<Check3<OptionPropertyLambda, typeof _optionPropertyLambda, typeof optionPropertyLambda>>
type _PropertyLambda = Assert<Check<PropertyLambda, typeof propertyLambda>>
type _Call = Assert<Check<Call, typeof call>>
type _Dot = Assert<Check<Dot, typeof dot>>
type _OptionDot = Assert<Check<OptionDot, typeof optionDot>>
type _OptionCall = Assert<Check<OptionCall, typeof optionCall>>
type _Comma = Assert<Check<Comma, typeof comma>>
type _Op0Id = Assert<Check<Op0Id, typeof op0Id>>
type _Op0 = Assert<Check<Op0, typeof op0>>
type _Op1Id = Assert<Check<Op1Id, typeof op1Id>>
type _Op1 = Assert<Check<Op1, typeof op1>>
type _Op2Id = Assert<Check<Op2Id, typeof op2Id>>
type _Op2 = Assert<Check<Op2, typeof op2>>
type _Op12Id = Assert<Check<Op12Id, typeof op12Id>>
type _Op12 = Assert<Check<Op12, typeof op12>>
type _Op3Id = Assert<Check<Op3Id, typeof op3Id>>
type _Op3 = Assert<Check<Op3, typeof op3>>
