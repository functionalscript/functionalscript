/**
 * The code IR as data: types, terms, functions and modules, as
 * [definition.md](../../doc/sasha-gil/ir/definition.md) defines them, in
 * the part that [the first slice](./todo/slices.md) builds.
 *
 * **Types and terms are tuples**, a tag first, so a module is plain data
 * that any producer can write: the lowering from FAST, or a person through
 * the constructors of [`module.f.js`](./module.f.js). A name is a string
 * that binds where it is introduced, so the IR prints as it is.
 *
 * **The checker answers a term with its type.** A `Typed` is a type and the
 * term again, with its parts typed in turn. The
 * [checker](./check/module.f.mjs) writes it, and the
 * [emitter](./wasm/module.f.mjs) reads only that.
 *
 * @module
 */

/** The integers from `lo` to `hi`, both included. */
export type Int = readonly ['int', lo: bigint, hi: bigint]

/** An IEEE 754 double. */
export type F64 = readonly ['f64']

/** An IEEE 754 double whose one NaN is `0x7FF8_0000_0000_0000`. */
export type F64c = readonly ['f64c']

/** Named parts in their order: the fields of a product, or the variants of a sum. */
export type Parts = readonly (readonly [name: string, type: Type])[]

/** One value per field. `unit` has no field. */
export type Product = readonly ['product', Parts]

/** One variant, of those in the order of their tags. `bool` is `false`, then `true`. */
export type Sum = readonly ['sum', Parts]

export type Type = Int | F64 | F64c | Product | Sum

/** The operators of the first slice, each typed by its operands. */
export type OpName =
    | 'add' | 'sub' | 'mul' | 'div' | 'neg' | 'abs' | 'sqrt'
    | 'eq' | 'lt' | 'le'
    | 'float'

/** A `match` arm: the variants it takes, `null` for the rest; a name for the operand there; its body. */
export type ArmOf<T> = readonly [variants: readonly string[] | null, binder: string | null, body: T]

/** A literal of a type: an integer as a `bigint`, a float as a `number`. */
export type Lit = readonly ['lit', Type, bigint | number]

/** A local, by its name. */
export type Get = readonly ['get', string]

/** A value bound to a name in a body. */
export type Let = readonly ['let', string, Term, Term]

export type Op = readonly ['op', OpName, readonly Term[]]

/** A function of a module, `self` for the module itself. */
export type Call = readonly ['call', module: string, name: string, args: readonly Term[]]

/** A product, from its fields in their order. */
export type Make = readonly ['make', readonly (readonly [string, Term])[]]

/** A value of a sum: the variant's name and its payload. */
export type Variant = readonly ['variant', Type, string, Term]

/** The one branch: an arm per variant or group of variants of the operand. */
export type Match = readonly ['match', Term, readonly ArmOf<Term>[]]

/** A region that a `br` to its label leaves with a value of its type. */
export type Block = readonly ['block', string, Type, Term]

/** The one transfer. To the label `return`, it leaves the function. */
export type Br = readonly ['br', string, Term]

export type Term = Lit | Get | Let | Op | Call | Make | Variant | Match | Block | Br

/** A term as the checker answers it: its type, then the term with its parts typed. */
export type Typed = readonly [Type, TypedTerm]

/**
 * A `match` arm as the checker answers it: every variant it takes, `else`
 * written out, and its body. No arm names the operand yet, so a slice that
 * admits a name adds it here, where the emitter meets it.
 */
export type TypedArm = readonly [variants: readonly string[], body: Typed]

export type TypedTerm =
    | Lit
    | Get
    | readonly ['let', string, Typed, Typed]
    | readonly ['op', OpName, readonly Typed[]]
    | readonly ['call', module: string, name: string, args: readonly Typed[]]
    | readonly ['make', readonly (readonly [string, Typed])[]]
    | readonly ['variant', Sum, string, Typed]
    | readonly ['match', Typed, readonly TypedArm[]]
    | readonly ['block', string, Type, Typed]
    | readonly ['br', string, Typed]

/** A parameter: its name and its type. */
export type Param = readonly [name: string, type: Type]

/** A function: its parameters, its result, and a body that the label `return` leaves. */
export type FunctionOf<T> = {
    readonly params: readonly Param[]
    readonly result: Type
    readonly body: T
}

/** A module: its functions in their order, and the names of those it exports. */
export type ModuleOf<T> = {
    readonly functions: readonly (readonly [name: string, FunctionOf<T>])[]
    readonly exports: readonly string[]
}

export type Fn = FunctionOf<Term>

export type Module = ModuleOf<Term>

/** A module that the checker took, every body typed. */
export type Checked = ModuleOf<Typed>
