/**
 * The code IR as data: types, terms, functions and modules, as
 * [definition.md](../../doc/sasha-gil/ir/definition.md) defines them, in
 * the part that [the slices](./todo/slices.md) have built so far.
 *
 * **Types and terms are tuples**, a tag first, so a module is plain data
 * that any producer can write: the lowering from FAST, or a person through
 * the constructors of [`module.f.js`](./module.f.js). A name is a string
 * that binds where it is introduced, so the IR prints as it is.
 *
 * **The checker answers a term with its type.** A `Typed` is a type and the
 * term again, with its parts typed in turn. The
 * [checker](./check/module.f.js) writes it, and the
 * [emitter](./wasm/module.f.js) reads only that.
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

/**
 * A type that an interface names and does not define, holding the values of
 * the variants of `only`, `null` standing for all of them: `any` is
 * `['sealed', 'Any', 'any', null]`, and a number of it is `any.only(number)`.
 */
export type Sealed = readonly ['sealed', module: string, name: string, only: readonly string[] | null]

export type Type = Int | F64 | F64c | Product | Sum | Sealed

/**
 * The operators of the slices so far, each typed by its operands but
 * `trunc_sat`, whose type is the range that it saturates to.
 */
export type OpName =
    | 'add' | 'sub' | 'mul' | 'div' | 'neg' | 'abs' | 'sqrt'
    | 'eq' | 'lt' | 'le'
    | 'float' | 'trunc_sat'

/** A `match` arm: the variants it takes, `null` for the rest; a name for the operand there; its body. */
export type ArmOf<T> = readonly [variants: readonly string[] | null, binder: string | null, body: T]

/** A literal of a type: an integer as a `bigint`, a float as a `number`. */
export type Lit = readonly ['lit', Type, bigint | number]

/** A local, by its name. */
export type Get = readonly ['get', string]

/** A value bound to a name in a body. */
export type Let = readonly ['let', string, Term, Term]

/** An operator and its operands, and for `trunc_sat` alone, the range that it saturates to. */
export type Op = readonly ['op', OpName, readonly Term[], target?: Int]

/** A function of a module, `self` for the module itself. */
export type Call = readonly ['call', module: string, name: string, args: readonly Term[]]

/** A product, from its fields in their order. */
export type Make = readonly ['make', readonly (readonly [string, Term])[]]

/** A field of a product, by its name. */
export type Field = readonly ['field', Term, string]

/** A value of a sum: the variant's name and its payload. */
export type Variant = readonly ['variant', Type, string, Term]

/** The one branch: an arm per variant or group of variants of the operand. */
export type Match = readonly ['match', Term, readonly ArmOf<Term>[]]

/** A region that a `br` to its label leaves with a value of its type. */
export type Block = readonly ['block', string, Type, Term]

/** A parameter of a loop: its name, its type, and the term of its first value. */
export type LoopParamOf<T> = readonly [name: string, type: Type, first: T]

/**
 * A region that a `br` to its label repeats, with a `make` of the next
 * values of its parameters, each a local of the body. Its value is its
 * body's.
 */
export type Loop = readonly ['loop', string, readonly LoopParamOf<Term>[], Term]

/** The one transfer. To the label `return`, it leaves the function. */
export type Br = readonly ['br', string, Term]

/** A failure at a named point. It gives no value, and the reason is for whoever reads a failed proof. */
export type Trap = readonly ['trap', reason: string]

export type Term = Lit | Get | Let | Op | Call | Make | Field | Variant | Match | Block | Loop | Br | Trap

/** A term as the checker answers it: its type, then the term with its parts typed. */
export type Typed = readonly [Type, TypedTerm]

/**
 * A `match` arm as the checker answers it: every variant it takes, `else`
 * written out, the name of the operand there, if it has one, its body, and
 * the variants as the term wrote them, `null` for `else`, so that a pass
 * that rewrites a typed module writes each arm as it was.
 */
export type TypedArm = readonly [variants: readonly string[], binder: string | null, body: Typed, written: readonly string[] | null]

export type TypedTerm =
    | Lit
    | Get
    | readonly ['let', string, Typed, Typed]
    | readonly ['op', OpName, readonly Typed[]]
    | readonly ['call', module: string, name: string, args: readonly Typed[]]
    | readonly ['make', readonly (readonly [string, Typed])[]]
    | readonly ['field', Typed, string]
    | readonly ['variant', Sum, string, Typed]
    | readonly ['match', Typed, readonly TypedArm[]]
    | readonly ['block', string, Type, Typed]
    | readonly ['loop', string, readonly LoopParamOf<Typed>[], Typed]
    | readonly ['br', string, Typed]
    | Trap

/**
 * A parameter: its name, its type, and whether the callee owns it. A missing
 * third part is a borrow, as every parameter was before this slice.
 */
export type Param = readonly [name: string, type: Type, mode?: 'own']

/** What a call of a function needs: its parameters and its result. A function has them too. */
export type Signature = {
    readonly params: readonly Param[]
    readonly result: Type
}

/** A function: its parameters, its result, and a body that the label `return` leaves. */
export type FunctionOf<T> = {
    readonly params: readonly Param[]
    readonly result: Type
    readonly body: T
}

/**
 * A sealed type as its interface shows it: its public variants in the order
 * of their tags, the function of the interface that answers a value's tag,
 * the WASM value that carries it where a host binds the interface, and, for
 * a counted type, the functions that count it: `dup`, which borrows a value
 * and answers one of the type, and `drop`, which owns one and answers
 * `unit`. A type that names neither is linear: a value that a module owns
 * goes to a parameter that owns it.
 */
export type SealedDef = {
    readonly variants: readonly string[]
    readonly kind: string
    readonly carrier: 'i32' | 'i64'
    readonly dup?: string
    readonly drop?: string
}

/**
 * What a module needs to know of another that it imports: the other's
 * sealed types and the signatures of its functions, whose parameters borrow
 * their arguments but where they are `own`. `abi` is the WASM module of the
 * imports that bind it on a host, which name its functions as it does.
 */
export type Interface = {
    readonly abi: string
    readonly types: readonly (readonly [name: string, SealedDef])[]
    readonly functions: readonly (readonly [name: string, Signature])[]
}

/** A module: the interfaces it imports, by their names, its functions in their order, and the names of those it exports. */
export type ModuleOf<T> = {
    readonly imports: readonly (readonly [name: string, Interface])[]
    readonly functions: readonly (readonly [name: string, FunctionOf<T>])[]
    readonly exports: readonly string[]
}

export type Fn = FunctionOf<Term>

export type Module = ModuleOf<Term>

/** A module that the checker took, every body typed. */
export type Checked = ModuleOf<Typed>

/**
 * Where a term stands in a function: the function's name, the locals in
 * scope with their types, the function's result, the signatures of the
 * module's functions, and the interfaces it imports. A producer that picks
 * an operator by the types of its operands asks the checker for them in a
 * scope.
 */
export type Scope = {
    readonly name: string
    readonly locals: readonly Param[]
    readonly result: Type
    readonly functions: readonly (readonly [name: string, Signature])[]
    readonly imports: readonly (readonly [name: string, Interface])[]
}
