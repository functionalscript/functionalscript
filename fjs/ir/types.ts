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

/**
 * A parameter of a code type: whether the callee owns it, and its type. A
 * missing name is the difference from a function's parameter: a code value
 * is only its signature's shape.
 */
export type CodeParam = readonly ['borrow' | 'own', Type]

/** A pointer to a top-level function: its parameters and its result. */
export type Code = readonly ['code', readonly CodeParam[], Type]

export type Type = Int | F64 | F64c | Product | Sum | Sealed | Code

/**
 * The operators of the slices so far, each typed by its operands but
 * `trunc_sat`, whose type is the range that it saturates to.
 */
export type OpName =
    | 'add' | 'sub' | 'mul' | 'div' | 'neg' | 'abs' | 'sqrt'
    | 'eq' | 'lt' | 'le'
    | 'and' | 'or' | 'xor' | 'shl' | 'shr'
    | 'float' | 'trunc_sat' | 'canon' | 'to_bits' | 'from_bits'
    | 'seal' | 'unseal' | 'release'

/** A `match` arm: the variants it takes, `null` for the rest; a name for the operand there; its body. */
export type ArmOf<T> = readonly [variants: readonly string[] | null, binder: string | null, body: T]

/**
 * A literal of a type: an integer as a `bigint`, a float as a `number`, and
 * a string as a `string`, of a sealed type whose interface makes such
 * literals. A string literal is borrowed, and nothing drops it: the module
 * makes it once, before anything reads it.
 */
export type Lit = readonly ['lit', Type, bigint | number | string]

/** A local, by its name. */
export type Get = readonly ['get', string]

/** A value bound to a name in a body. */
export type Let = readonly ['let', string, Term, Term]

/**
 * An operator and its operands, and for `trunc_sat` the range that it
 * saturates to, for `seal` the sealed type that it makes.
 */
export type Op = readonly ['op', OpName, readonly Term[], target?: Int | Sealed]

/** A function of a module, `self` for the module itself. */
export type Call = readonly ['call', module: string, name: string, args: readonly Term[]]

/** A top-level function of the module as a value: its name. */
export type CodeOf = readonly ['code', string]

/** An indirect call of a code value. */
export type CallRef = readonly ['call_ref', Term, readonly Term[]]

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

/**
 * A failure at a named point. It gives no value, and the reason is for
 * whoever reads a failed proof. One marked `misuse` stands where only a
 * bug of the caller leads, or memory that cannot grow, as L0's traps on
 * misuse do ([L0 design §11](../../doc/sasha-gil/wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)),
 * so it traps the same way and the checker does not count it as failing.
 */
export type Trap = readonly ['trap', reason: string, mark?: 'misuse']

/**
 * A constant, borrowed: one of the module's own, `self`, which `init`
 * evaluates once, or one of an interface that it imports, which the host
 * makes. Nothing drops it.
 */
export type Constant = readonly ['constant', module: string, name: string]

export type Term = Lit | Get | Let | Op | Call | CodeOf | CallRef | Make | Field | Variant | Match | Block | Loop | Br | Trap | Constant

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
    | CodeOf
    | readonly ['call_ref', Typed, readonly Typed[]]
    | readonly ['make', readonly (readonly [string, Typed])[]]
    | readonly ['field', Typed, string]
    | readonly ['variant', Sum, string, Typed]
    | readonly ['match', Typed, readonly TypedArm[]]
    | readonly ['block', string, Type, Typed]
    | readonly ['loop', string, readonly LoopParamOf<Typed>[], Typed]
    | readonly ['br', string, Typed]
    | Trap
    | Constant

/**
 * A parameter: its name, its type, and whether the callee owns it. A missing
 * third part is a borrow, as every parameter was before this slice.
 */
export type Param = readonly [name: string, type: Type, mode?: 'own']

/**
 * What a call of a function needs: its parameters and its result. A function
 * has them too. A function of an interface may give back a parameter that
 * it owns, `returns`: its result is that parameter's value, of its type.
 * Where a host binds the interface, the import takes the value once and
 * answers nothing, and the caller reads the value again after the call
 * ([definition.md's binding rule 3](../../doc/sasha-gil/ir/definition.md#bindings)),
 * as Containers' `push` gives back its builder.
 *
 * `fails` is the one effect
 * ([definition.md: One effect](../../doc/sasha-gil/ir/definition.md#one-effect)):
 * a call may fail, by a throw or a trap, so it completes on no path but
 * those that it does not fail on. A function of an interface declares it,
 * as `Functions.throw` and the functions that L0 traps in do, and a
 * missing one is `false`. A function of a module declares none: the
 * checker infers it, and writes it in the module that it answers. A trap
 * on misuse does not count: `Ref`'s functions trap on bits that are no
 * reference and declare nothing, and a module's `trap` marked `misuse`
 * adds nothing to what the checker infers.
 *
 * `counts` marks a function of an interface that counts a value on its
 * bits, as NaNVM's `dup_ref` and `drop_ref` do: `dup` answers the bits of a
 * new owner, and `drop` gives one up. Bits are copy, so the owned check
 * cannot follow them: only the hook of that name of a counted type that the
 * module defines calls such a function, and only as its last term
 * ([defined-hooks.md](../../doc/sasha-gil/ir/defined-hooks.md)). `new`
 * answers the bits of a value that no one owns yet, as the Heap's `alloc`
 * answers a new block, so only a `seal` of a counted type that the module
 * defines takes them, straight from the call, and the owned check follows
 * the value from there.
 */
export type Signature = {
    readonly params: readonly Param[]
    readonly result: Type
    readonly returns?: string
    readonly fails?: boolean
    readonly counts?: 'dup' | 'drop' | 'new'
}

/**
 * Whether the [inline pass](./inline/module.f.js) writes a function's body
 * in place of each call of it: `always` at every call, `never` at none. A
 * function with no hint is left to a later source of decisions, as a
 * profile would be, and the pass leaves its calls for now. The checker
 * refuses `always` on a function that reaches itself through calls of
 * such functions alone, on one read as a value, and on a hook of a type
 * that the module defines, which the lifetime pass and the emitter call.
 */
export type Inline = 'always' | 'never'

/**
 * A function: its parameters, its result, a body that the label `return`
 * leaves, and, if it has one, its inline hint.
 */
export type FunctionOf<T> = {
    readonly params: readonly Param[]
    readonly result: Type
    readonly body: T
    readonly inline?: Inline
}

/**
 * A sealed type as its interface shows it: its public variants in the order
 * of their tags, the function of the interface that answers a value's tag,
 * where a module may branch on them, the WASM value that carries it where a
 * host binds the interface, and, for a counted type, the functions that
 * count it: `dup`, which borrows a value and answers one of the type, and
 * `drop`, which owns one and answers `unit`. A type that names neither is
 * linear: a value that a module owns goes to a parameter that owns it. A
 * type that names no `kind` has no tag, so no `match` branches on it, as a
 * builder has none. A type that has string literals names the variant that
 * one holds and the function that makes one, of an interface that a module
 * with such a literal imports. A counted type may name its copy variants:
 * a value that holds only those needs no `dup` and no `drop`, so a subset
 * of the type that holds only them is copy, and the `dup` and the `drop`
 * of the whole type do nothing to such a value.
 */
export type SealedDef = {
    readonly variants: readonly string[]
    readonly kind?: string
    readonly carrier: 'i32' | 'i64'
    readonly dup?: string
    readonly drop?: string
    readonly copy?: readonly string[]
    readonly literal?: Maker
}

/**
 * The function that makes a string literal of a sealed type from its UTF-16
 * units in memory, `String.make_string` for `any`: the variant that the
 * literal holds, and the interface and the name of the function, its
 * member. Only the emitter calls it, since its arguments, an address and a
 * length, are no values of the IR.
 */
export type Maker = {
    readonly variant: string
    readonly module: string
    readonly member: string
}

/**
 * What a module needs to know of another that it imports: the other's
 * sealed types, its constants, each of a type, and the signatures of its
 * functions, whose parameters borrow their arguments but where they are
 * `own`. `abi` is the WASM module of the imports that bind it on a host,
 * which name its functions and its constants as it does. An interface that
 * says `instructions` is bound by the target itself, and is L0's `Memory`
 * or a part of it: its functions are the target's own instructions on the
 * memory that the loader makes, which the WASM emitter writes in place of
 * a call, with the memory imported from `abi`. Its calls touch the memory,
 * so a pass keeps each where it is, and neither removes nor merges one,
 * whether or not it may fail, nor a call of a function that makes one
 * ([heap.md](../../doc/sasha-gil/ir/heap.md#memory-in-the-ir)).
 */
export type Interface = {
    readonly abi: string
    readonly instructions?: true
    readonly types: readonly (readonly [name: string, SealedDef])[]
    readonly constants?: readonly (readonly [name: string, Type])[]
    readonly functions: readonly (readonly [name: string, Signature])[]
}

/**
 * The sealed types that a module implements, under the name that its types
 * and the modules that import it call it by, as `['sealed', name, type, v]`.
 * The functions that a type's `kind`, `dup` and `drop` name are the
 * module's own, and another module makes its literals. A counted type's
 * `dup` and `drop` work on its carrier's bits, `(b: u(64)) -> u(64)` and
 * `(b: u(64)) -> unit` for an `i64` carrier, so they never hold a value of
 * the type, and only the lifetime pass calls them, in
 * `seal(t, self.dup(unseal(e)))` and `self.drop(release(x))`
 * ([defined-hooks.md](../../doc/sasha-gil/ir/defined-hooks.md)).
 */
export type Defines = {
    readonly name: string
    readonly types: readonly (readonly [name: string, SealedDef])[]
}

/**
 * A constant of a module: its type and the term that `init` evaluates once,
 * which reads only the constants before it, itself or through a function
 * that it calls, and which the constant owns.
 */
export type ConstantOf<T> = {
    readonly type: Type
    readonly value: T
}

/**
 * A module: the interfaces it imports, by their names, its constants and
 * its functions in their order, and the names of the functions that it
 * exports. The module exports `init` too, which evaluates the constants.
 * `defines` names the sealed types that the module itself implements, as
 * Any's own module implements `any`: only there may `seal` and `unseal`
 * convert between such a type and its carrier's bits.
 */
export type ModuleOf<T> = {
    readonly imports: readonly (readonly [name: string, Interface])[]
    readonly defines?: Defines
    readonly constants?: readonly (readonly [name: string, ConstantOf<T>])[]
    readonly functions: readonly (readonly [name: string, FunctionOf<T>])[]
    readonly exports: readonly string[]
}

export type Fn = FunctionOf<Term>

export type Module = ModuleOf<Term>

/**
 * A function that the checker took: its body typed, and whether a call of
 * it may fail, which the checker inferred from the body: a `trap` in it
 * that is not marked `misuse`, or a call of a function that may fail, of
 * an interface, which declares it, or of the module, to a fixed point.
 */
export type CheckedFn = FunctionOf<Typed> & { readonly fails: boolean }

/**
 * A module that the checker took, every term typed, with its constants,
 * which it may have none of, and each function with its effect.
 */
export type Checked = {
    readonly imports: readonly (readonly [name: string, Interface])[]
    readonly defines?: Defines
    readonly constants: readonly (readonly [name: string, ConstantOf<Typed>])[]
    readonly functions: readonly (readonly [name: string, CheckedFn])[]
    readonly exports: readonly string[]
}

/**
 * Where a term stands in a function or a constant: its name, the locals in
 * scope with their types, the function's result, which a constant has
 * none of, the signatures of the module's functions, the interfaces it
 * imports, and the types of the module's constants that it may read. A
 * producer that picks an operator by the types of its operands asks the
 * checker for them in a scope.
 */
export type Scope = {
    readonly name: string
    readonly locals: readonly Param[]
    readonly result?: Type
    readonly functions: readonly (readonly [name: string, Signature])[]
    readonly imports: readonly (readonly [name: string, Interface])[]
    readonly constants?: readonly (readonly [name: string, Type])[]
}
