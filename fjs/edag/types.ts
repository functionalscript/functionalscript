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
import type { Equal } from '../types/ts/types.ts'

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
// These are here and not in `proof.f.mjs` because a `@typedef` inside a
// function body is never checked — TypeScript does not evaluate the
// constraint of a declaration nothing references, so that file's entire
// `consistency` section is green whatever it claims. A module-scope alias in
// a `.ts` file is checked; `../nanvm/types.ts` is the worked case and
// `../../todo/inert-type-level-proofs.md` the issue that moves the rest.

type _OptionInsideOptionProperty = Assert<Equal<OptionLambda extends OptionPropertyLambda ? true : false, true>>
type _PropertyInsideOptionProperty = Assert<Equal<PropertyLambda extends OptionPropertyLambda ? true : false, true>>

// ... and exactly which three productions the wider state adds, so an arm
// gained on either side, or a containment broken, is a type error rather than
// a silent change of what the grammar admits.
//
// An arm *removed* from the shared segment is not theirs to catch: it leaves
// both unions at once, so `Exclude` is unchanged and all three stay green.
// The pin for that is `_OptionLambda`, the schema against the type, which is
// inert where it sits in `proof.f.mjs` — see
// `../../todo/inert-type-level-proofs.md`.
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
