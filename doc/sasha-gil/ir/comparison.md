# Code IR compared: Binaryen, CLIF, MIR and more

Written on 2026-11-11 as the
[comparison round](./ir-design.md#comparison-round) that ir-design.md asks
for. It was read against the first draft of
[type-system.md](./type-system.md), and its findings went into that
note's revision. The facts about our IR below are the revised ones, and
[What this round changed](#what-this-round-changed) says where each
finding went.

Quotes come from the pages under [Sources](#sources). A statement marked
"from memory" was not checked against a source this time.

## Summary

The plan in [type-system.md](./type-system.md) is closest to Lean's
reference-counted IR and to MLIR's structured loops, in Binaryen's tree
shape. Two of its ideas have no counterpart in the IRs compared: integer
ranges as types, and checked bit layouts for sums. Immutability keeps the
rest simpler than any of them.

- **Shape: keep the typed tree.** Binaryen and MLIR's `scf` dialect make
  the same choice for the same reason, a structured target. CLIF and MIR
  are control-flow graphs, and reaching WASM from a graph needs a pass
  that rebuilds the structure.
- **Loops: our loop parameters are MLIR's `iter_args`.** `scf.for` and
  `scf.while` carry state through region arguments and `scf.yield`. CLIF
  and MLIR both replace phi nodes with block parameters, and our loops
  are the same idea in a tree.
- **Ownership: we follow Lean, not Perceus.** Lean's IR marks parameters
  as borrowed and has persistent objects and tagged scalars, which match
  L0's borrowed arguments, `stat` and the NaN box. Perceus passes
  ownership into every call so that it can free earlier. Its precise
  drops, drop specialization and reuse are still worth taking.
- **Types: our two bets are new here.** CLIF, MLIR and Binaryen keep
  integers signless and put the sign in the operation. Our ranges replace
  both the width and the sign, and the sign is chosen only with the
  carrier. None of the compared IRs lets a sum declare its bits; only
  Habit's bitdata, a source language, does.
- **Immutability removes whole subsystems.** Frozen objects never change,
  and a `uniq` object changes only along a linear thread. So we need no
  memory effects (CLIF's flags, MLIR's memory effects), no alias
  analysis, no drop flags (MIR) and no lifetimes.

Nothing in the comparison argues against the tree, `match` or loop
parameters. The changes it suggested were small.

## The systems compared

The five candidates in
[ir-design.md's comparison round](./ir-design.md#comparison-round) are
here, with MLIR, Lean's IR and Habit's bitdata added for the type-system
plan.

| System | What it is | Why it is here | What was read |
| --- | --- | --- | --- |
| Binaryen IR | the tree IR of Binaryen's optimizer, "as close as possible to WebAssembly" | the guide the owner named; a tree that emits WASM | README, part of `src/wasm.h`, a wiki page |
| Cranelift CLIF | the SSA IR of the Cranelift code generator, in the Wasmtime project | a typed IR shared by several native targets | `docs/ir.md`, part of `instructions.rs`, the ISLE docs |
| Rust MIR | rustc's mid-level IR, where borrow checking and drop elaboration run | ownership made explicit in an IR | the rustc dev guide's MIR pages |
| MLIR | a framework of dialects; `scf` is its structured control flow | regions, block arguments, wide integers, a written rationale for signless integers | `LangRef.md`, `Rationale.md`, `SCFOps.td`, `BuiltinTypes.td` |
| WAT folded form | WASM's text format with nested instructions | the smallest tree over WASM | cited from memory |
| Lean 4 IR | Lean's compiler IR with explicit `inc`, `dec`, `reset` and `reuse` | the reference-counting model closest to L0's | `Basic.lean`; the paper's host was unreachable |
| Perceus | precise reference counting with reuse, as in the Koka language | the insertion algorithm for IR choice 9 | the tech report MSR-TR-2020-42 |
| Habit bitdata | bit-level data types in a source language | checked bit layouts for sums | cited from memory; the paper's hosts were unreachable |

LLVM IR, Zig, Swift, Hylo and a few engines and source languages appear
in passing, cited from memory and marked so.

## At a glance

Our IR shares its shape with Binaryen and MLIR's `scf`, its values with
CLIF and MLIR, and its ownership with Lean. Its types and its safety
story are its own.

### Structure

| System | Shape | Values | Control flow |
| --- | --- | --- | --- |
| **Our IR** | typed tree | assigned once; loop parameters | structured: `block`, `match`, `loop_` |
| Binaryen | tree | mutable locals; SSA only through a pass | structured: block, if, loop, br, br_table |
| WAT folded | nested text over WASM's stack code | mutable locals | structured, as WASM |
| CLIF | basic blocks | SSA with block parameters | a graph: br, brif, br_table, return |
| MIR | basic blocks of statements and one terminator | locals and places, assigned many times | a graph; calls end blocks, with unwind edges |
| MLIR `scf` | operations with nested regions | SSA with block arguments | structured, lowered later to a graph (`cf`) |

### Types

| System | Integers | Sign | Sums | Bit layout |
| --- | --- | --- | --- | --- |
| **Our IR** | ranges, exact up to 128 bits | derived from the range | trees of variants, with subsets | declared per sum or product |
| Binaryen | `i32`, `i64` ("no i8 or i16") | in the operator name | none outside GC | WASM's |
| CLIF | `i8` to `i128` | in the instruction | none | none |
| MIR | Rust's integer types | in the type | Rust enums | computed after MIR |
| MLIR | `i1` up to 2^24 − 1 bits; signless, `si` or `ui` | signless in `arith`; sign in the op | none built in | "not necessarily related" to the bit width |
| Lean IR | fixed widths | unsigned | constructors | scalars tagged inside an `object` pointer |

### Memory and safety

| System | Memory | Ownership | Failure |
| --- | --- | --- | --- |
| **Our IR** | immutable heap objects; `uniq` while building | copy, counted and unique types; derived `dup` and `drop` | traps only, no undefined behavior |
| Binaryen | linear memory, GC structs and arrays | none | WASM's traps |
| CLIF | loads and stores with flags, stack slots | none | traps, including on division by zero |
| MIR | places, references, raw pointers | moves, `Drop` terminators, drop flags, borrow checking | panics and unwinding |
| MLIR | per dialect | none built in | per dialect; an `scf.for` overflow is undefined |
| Lean IR | counted objects; in-place `set` when the count is 1 | `inc`, `dec`, borrowed parameters, `reset` and `reuse` | not covered here |

## Shape and control flow

Every IR here is either a tree with structured control flow or a graph of
basic blocks. The split follows the consumer: structured targets want
trees, and register allocators and path-sensitive checks want graphs.

| Our IR | Binaryen and WAT | CLIF | MIR | MLIR |
| --- | --- | --- | --- | --- |
| nested expressions | nested expressions | one instruction per value | one temporary per value | one operation per value |
| `block` and `br(label, v)` | `block` and `br` with a value | a jump to a block with parameters | a `goto` after assigning the result | no early exit in `scf`; `cf.br` once lowered |
| `match` | `if`, `br_table` | `brif`, `br_table` | `SwitchInt` on a discriminant | `scf.if`, `scf.index_switch` |
| `loop_` and `next(v)` | `loop` and `br`, with the state in locals | a header block with parameters | a `goto` to the header | `scf.while` and `scf.yield` |
| `trap(reason)` | `unreachable` | `trap` with a code | `Unreachable`, `Assert` | per dialect |

- **The graph IRs are graphs for their consumers.** MIR "is based on a
  control-flow graph" and "does not have nested expressions", because
  borrow checking and drop elaboration are analyses over paths. Calls end
  its blocks "because of the possibility of unwinding". CLIF feeds a
  register allocator. Neither has a structured target, and reaching WASM
  from a graph needs a pass that rebuilds the structure, such as
  Binaryen's Relooper.
- **In a tree with no reassignment, liveness is free variables.** The
  lifetime pass is the only analysis in the plan that needs paths.
  Walking backwards, a `br` takes the live set of its label, which the
  walk has already computed, and a loop keeps the outer values its body
  uses alive until it exits. There is no fixpoint to iterate. This
  answers the worry in
  [ir-design.md](./ir-design.md#where-this-draft-is-least-sure) about a
  last use "across a `br` that leaves several blocks".
- **Block parameters, region arguments and loop parameters are one
  idea.** CLIF "does not have phi instructions but uses BB parameters
  instead". MLIR calls block arguments and PHI nodes "representationally
  identical", and says block arguments make the parallel-copy semantics
  "immediately apparent". `scf.for` carries `iter_args`, and the two
  regions of `scf.while` "communicate by means of region arguments". Our
  loop parameters are the same thing in a tree. With block results, they
  are the only places where values merge, so every local is assigned
  once, and the IR is SSA with no phi nodes.
- **Our loops are freer than `scf`'s.** `next` can appear anywhere in the
  body, as a `br` to the head that carries values, and a `br` to an outer
  label leaves the loop from any depth. `scf.while` has one exit, its
  condition, and `scf` has no early exit at all. WASM's `loop` and `br`
  behave like ours. WASM 2.0's `loop` can even take parameters (from
  memory), but Binaryen represents block inputs only as `pop` in a
  `catch`, so it keeps loop state in locals, as our emitter will.
- **`never` is Binaryen's `unreachable` type, made ordinary.** Binaryen
  lets `block`, `if` and `loop` take an unreachable type, so that local
  transforms need no global context, at the price that its default text
  output "is not necessarily valid wasm text". Our `never` is the empty
  sum and a subtype of every type, so `trap`, `br`, `return_` and `next`
  fit in any position, and WASM's own validation rules cover the code
  that follows them.
- **Nested code needs names for owned temporaries.** MIR flattens
  `x = a + b + c` into `TMP1 = a + b` and `x = TMP1 + c`, and Lean's IR
  passes only variables as arguments. Both give every value a name, and
  so a place to drop it. Our tree can stay nested for copy values, which
  keeps the WASM compact. But in `f(g(a))`, where `f` borrows, the result
  of `g(a)` is owned and has to be dropped after `f` returns, so the
  owned stage needs a local for it.
- **The compared IRs keep names only in their text.** Binaryen names
  labels and functions but reads locals by index, CLIF numbers its values
  and blocks, MIR numbers its locals from `_0`, the return place, and
  MLIR prints `%` names for values that are pointers in memory. IR choice
  6 keeps names in the data. Template form makes the cost concrete:
  inlining a String function into a program copies its locals, and the
  copies need fresh names.

## Integers, signedness, sums and layout

The compared IRs agree that a sign belongs to an operation, not to a
type, and the plan agrees at the level of carriers. Sums they either
lack, or lay out themselves.

- **Signless carriers, and why ranges keep the consensus.** MLIR says "An
  integer value does not have an intrinsic sign, and it's up to the
  specific op for interpretation". Its rationale adds that "Removing
  signs from the type system eliminated these problems, making the
  compiler simpler", and points to LLVM 2.0 dropping `sbyte` and `ubyte`.
  CLIF's integers "can be interpreted as either signed or unsigned", and
  the sign is chosen by `icmp`'s condition code (`slt` or `ult`) or by
  the instruction (`sdiv` or `udiv`). Binaryen spells it in the operator,
  as in `DivSInt32` and `DivUInt32`. The problem they removed was two
  types for the same bits, joined by casts that did nothing but get in
  the way. A range is not a reading of bits: `u(8)` and `i(8)` are
  different sets of integers, and turning −1 into 255 is `wrap(u(8), x)`,
  arithmetic with a meaning. Below the ranges, the carriers are signless
  words, and the emitter picks `_s` or `_u` for each operation, which is
  where CLIF and MLIR keep the sign too.
- **Widths, and what they mean.** Binaryen has "i32, i64, f32, f64 (no i8
  or i16, and no i57 or anything else)". CLIF has `i8` to `i128`. MLIR
  allows any width up to 2^24 − 1 bits, because in hardware "a 13 bit
  multiplier is a lot cheaper/smaller than a 16 bit one", and it keeps
  width apart from storage: "The bit width is not *necessarily* related
  to the amount of memory". Our `u(6)` is MLIR's `ui6`, and `int(1n, 8n)`
  has no counterpart. The larger difference is meaning. CLIF's `iadd` is
  "Wrapping integer addition", and MLIR's integers wrap too, so an `i6`
  addition wraps at 64. Ours never wraps: two `u(6)` values add to an
  `int(0n, 126n)`.
- **Booleans.** CLIF has none: `brif` takes any integer, and `icmp` gives
  1 or 0. MLIR uses `i1`, and WASM uses `i32`. Ours is the prelude's
  `bool`, a sum carried in an `i32`, so `if_` is a `match`, and adding
  two booleans is a type error.
- **Sums.** CLIF, MLIR's builtins and Binaryen outside WasmGC have none.
  MIR has Rust's enums: `SwitchInt` reads the discriminant, a `Downcast`
  projection reads a variant's fields, and rustc picks the layout later,
  using niches (from memory). Lean's IR has constructors and `tobject`, a
  value that is either a pointer or a tagged scalar, whose counting
  operations "first need to test whether the `tobject` is really a
  pointer or not". Our `any` has the same problem. Lean answers it with
  one fixed encoding that its compiler chooses, and we answer it with a
  declared one.
- **Declared layouts.** None of the compared IRs lets a sum declare its
  bits. The nearest is Habit's bitdata, a feature of a source language
  (from memory). Zig has integers of any width and packed structs, but
  its tagged unions take no bit layout (from memory). A `bits(64, {...})`
  declaration with a disjointness proof is new in an IR.
- **Bad bits.** In Rust, a `bool` that holds 2, or an enum with an
  unknown discriminant, is undefined behavior (from memory). Here a value
  is made only by a constructor, and bits from outside are read with
  `try_from_bits`, so there is no bad value to reach.
- **NaN boxing.** None of the IRs models a canonical NaN. Engines that
  box values in NaNs canonicalize by hand wherever they box, as
  JavaScriptCore's `purifyNaN` and SpiderMonkey's `CanonicalizeNaN` do
  (from memory). With `f64c`, a forgotten call is a type error.

## Memory, ownership and reference counting

Binaryen, CLIF and MLIR's builtins have no ownership. MIR has Rust's, and
Lean's IR and Perceus count references. The plan takes MIR's checked
linearity, Lean's borrowing and Perceus's precise drops, and needs less
machinery than any of them, because its values are immutable.

| | MIR | Lean IR | Perceus | Our plan |
| --- | --- | --- | --- | --- |
| Copy or move | `copy` needs `T: Copy`; `move` works for any type | `inc` and `dec` on objects | `dup` and `drop` on every reference | copy, counted and unique types |
| Borrows | first-class references with lifetimes | borrowed parameters | none; "selective borrowing" is future work | borrowed parameters and views, both second-class |
| When a value dies | at the end of its scope, through `Drop` and drop flags | after its last use (from memory) | "as soon as possible" | at its last use; a borrowed argument when its call returns |
| Cost of a count | none in the IR | flags on `inc`: a tagged-pointer test, a persistent object | a test at run time | decided by the variants in the type |
| In place | `&mut` | `set` needs `RC(x)` to be 1; `reset` and `reuse` | reuse analysis behind `is-unique` | `uniq` while building, then `freeze` |

- **No drop flags, because drops do not follow scopes.** MIR keeps "a
  boolean flag (a 'drop flag') for every structural path", set when the
  path is initialized and cleared when it is moved from. It needs them
  because Rust runs a destructor at the end of a scope, and a place may
  be moved on one path and not on another. Drop elaboration then sorts
  each `Drop` into static, dead, conditional or open. Our values have no
  destructors that a program can see, so the pass drops each one at its
  last use on each path, where what it owns is known statically.
- **No lifetimes, because borrows are second-class.** MIR's borrow
  checker reasons about references that can be stored and returned. Ours
  can be neither: a view lives as long as its source, in the same
  function. That is Lean's borrowed parameter, extended to the payloads a
  `match` reads from a borrowed value. Swift and Hylo pass parameters the
  same way (from memory).
- **Borrowed parameters trade early frees for fewer counts.** Perceus
  passes ownership into calls so that it can free "as soon as possible",
  which it calls garbage free, and it names "selective borrowing" as
  future work that "would make certain programs no longer be garbage
  free".
  [L0 design §10](../wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)
  already borrows, and most runtime functions only read: `length`, `at`,
  `kind`. The price is that an argument lives until its call returns, and
  a borrowed value cannot be reused in place. Lean makes this choice per
  parameter, by borrow inference ("Counting Immutable Beans", from
  memory). Our `own` is the same choice, written by hand or by the
  lowering.
- **Types decide what a `dup` costs.** Lean's `inc` has two flags: one
  says it "must check whether `x` is a tagged pointer", and the other
  that `x` "is statically known to be a persistent object". Our types say
  both, and more. On `ref(O)`, a `dup` is an increment with no test. On
  `stat(O)` it is nothing. On `any` it is the README's one-mask test, and
  on `any.only('number')` it is nothing again. Refinement removes
  counting.
- **We have the static half of reuse.** Lean's `set` requires `RC(x)` to
  be 1, and `isShared` tests it. Perceus's reuse analysis updates
  "(immutable) data in-place when possible", behind an `is-unique` test,
  which is what makes its "functional but in-place" style work. Our
  `uniq` is the static half: `alloc`, `set` and `push` thread a unique
  value, and `freeze` shares it. The paper names the combination. Unique
  types alone usually need "multiple versions of a function for each case
  (unique versus shared argument)", but "if our system is extended with
  unique types, then reuse analysis could statically eliminate
  corresponding uniqueness checks". The dynamic half is one function,
  `try_unique`. L0's builders
  ([L0 design §22](../wasm/l0-design.md#22-building-in-one-pass)) already
  build an array or a string in one pass, so `try_unique` is an
  optimization for what they do not cover, such as a chain of `concat`
  calls.
- **Drop specialization fits borrowed payloads.** When an arm returns a
  field of an owned value, the pass writes `dup(field)` and then
  `drop(parent)`. Perceus specializes that pair: when the parent is
  unique, it moves the field out and frees the parent without touching
  the field's count. The derived `release` meets this pattern in every
  object it frees.
- **Memory needs no flags.** CLIF tags each load and store with flags
  such as `notrap`, `aligned`, `readonly` and `volatile`, so that its
  optimizer knows what may move. MIR has places with projections, and
  raw pointers. Binaryen has linear memory and WasmGC structs. Our
  objects are immutable once frozen, and a `uniq` object changes only
  through the value that `set` returns, so the order of writes is a data
  dependency. Every read of a frozen object is what CLIF would call
  `readonly`, by construction.
- **Cycles.** Perceus is garbage free only for "(cycle-free)" programs,
  and L0 counts on an acyclic heap.
  [L0 core, Lifetime](../wasm/l0-core.md#lifetime) already settles why
  it is one: a function names itself through its `self_`, and mutual
  recursion between `const` declarations is refused. The risk it names
  is the proposal for forward references inside an object, which would
  make cycles through a frame.

## Traps, overflow and effects

CLIF has the richest failure model here, with trap codes, conditional
traps and overflow-checking operations. The plan needs fewer operations,
because its types remove most checks, and fewer effects, because its
values are immutable.

- **A trap carries its reason.** CLIF's `trap`, `trapz` and `trapnz` take
  a trap code. WASM's `unreachable` takes none. MIR's `Assert` carries
  what failed, such as an overflow or a bounds check (from memory). Our
  `trap(reason)` carries the L0 view's reason, kept in a side table for
  WASM, which is what CLIF's trap code is.
- **A check is idempotent.** CLIF marks `trapz`, `trapnz`, `udiv`,
  `sdiv`, `urem`, `srem` and `uadd_overflow_trap` as
  `side_effects_idempotent`, and notes that a dominated identical `trapz`
  may be removed. In the plan, `narrow` is an `if_`, and the value it
  returns has the narrow type. Narrowing that value again emits nothing,
  with no optimizer needed.
- **Division.** CLIF's `udiv` "traps if the divisor is zero", and `sdiv`
  also traps when the result "is not representable in `B` bits two's
  complement", which happens only for −2^(B−1) divided by −1. In the
  plan, `div` checks for a zero divisor only when the divisor's type
  includes 0. The second case is exact arithmetic: −2^63 / −1 is 2^63, so
  the quotient of two `i64` values has a type one value wider than `i64`,
  and the code says how to fit it. The plan rounds toward zero, as WASM,
  Rust and JavaScript's BigInt do.
- **Overflow.** CLIF's `iadd` wraps, `uadd_overflow` also returns an
  overflow flag, `uadd_overflow_trap` traps, and the `_cin` forms take a
  carry in. MIR checks overflow in debug builds and skips the checks in
  "release mode". MLIR's `scf.for` requires `LB + n*Step` to be
  representable, "Otherwise the behavior is undefined". In the plan,
  overflow cannot happen. A result of up to 128 bits has a type, so
  CLIF's carry and overflow forms need no counterpart: the high word of a
  product is `shr(mul(a, b), 64n)`. MLIR's undefined counter overflow is
  our type error for a counter that grows without a comparison: the same
  fact, proved instead of assumed. Baseline WASM has no 64-bit multiply
  with a 128-bit result (from memory), so that product costs four
  multiplies of 32-bit halves there.
- **Effects.** CLIF flags each instruction with `can_load`, `can_store`,
  `can_trap` or `other_side_effects`, on top of its memory flags. MLIR
  has `Pure`, `RecursiveMemoryEffects` ("Effects of nested regions are
  the effects of the op") and `ConditionallySpeculatable`. Most of this
  is about memory, which our high level does not have. In the plan,
  builders are `uniq` values threaded through calls, so their order is a
  data dependency, and `dup` and `drop` exist only after the lifetime
  pass. FunctionalScript "has `throw` and no `try`"
  ([L0 design §13](../wasm/l0-design.md#13-errors-a-throw-traps)), so a
  throw and a trap both end the run.
  [L0 design §14](../wasm/l0-design.md#14-identity-same-is-reference-identity-and-a-runtime-may-merge-equal-values)
  lets a runtime merge equal values, so two equal frozen values may be
  merged, and an unused one removed. What is left for an optimizer is one
  question, whether an expression may fail: code that cannot fail moves
  freely, and code that may fail keeps its order.
- **Speculation.** MLIR's `ConditionallySpeculatable` asks whether an
  operation may be hoisted out of a branch. In the plan, the types answer
  it: a `div` whose divisor excludes 0 cannot fail, so it may be hoisted,
  while CLIF has to mark every `udiv` with `can_trap`.

## Extensibility, tooling, and who writes the IR

- **Open or closed.** MLIR is open: its operations are "fully extensible
  (there is no fixed list of operations)", its type system is open, and
  dialects in their own namespaces lower step by step. `scf` "is lowered
  to `cf` and then lowered to some final target like LLVM or SPIR-V".
  CLIF's instructions are a fixed list in a Rust meta crate, and its
  lowering and mid-end rules are written in ISLE, "a domain-specific
  language for authoring instruction selection and rewrite rules", which
  is "compiled down into Rust code". Binaryen and MIR are closed. Ours is
  closed, with seven type formers and a few constructs, and it grows in
  two ways: runtime modules add sealed types and functions, and host
  functions add generics and macros.
- **A runtime module is a dialect whose operations have bodies.** An MLIR
  dialect declares types and operations, and an operation means what its
  lowering patterns do with it. A runtime module declares types and
  functions, and each function has an IR body. The interpreter runs it,
  the checker checks it, and lowering it means inlining it (template
  form) or calling it (import form). Progressive lowering becomes the
  choice of form. What we give up is rewriting at the level of a module's
  operations before they are inlined, such as `length(concat(a, b))` into
  `add(length(a), length(b))`. That can come later, as rules on calls
  that cannot fail to known functions.
- **Who writes each IR.**
  - Binaryen is written by compilers through its C API and binaryen.js:
    Emscripten, AssemblyScript, Kotlin/Wasm, Dart, wasm_of_ocaml and
    others. Its wiki asks for "flat" input with plenty of locals, which
    the optimizer then removes.
  - CLIF is written by front ends through `cranelift_frontend`, which
    turns mutable variables into SSA. Hand-written `.clif` text is for
    tests.
  - MIR is written by rustc, and people read it in dumps.
  - MLIR is written by people in every test, in its generic or custom
    text form.
  - Ours is written by the lowering and by people. The lowering does what
    `cranelift_frontend` does, but only for structured loops: prepared
    FAST's while slots become loop parameters.
- **A runtime written in its own IR is rare.** Lean's runtime, under its
  IR, is hand-written C and C++ (from memory). VMs written in a
  restricted language and then translated, such as Squeak's Slang or
  PyPy's RPython, reach memory through unchecked primitives (from
  memory). The plan keeps that part checked, with layouts and `buffer`
  instead of pointers, down to one small module that owns the heap.
- **Tooling.** Each compared IR has a text form, and tests written in it:
  CLIF's filetests, MLIR's `mlir-opt` with FileCheck, and Binaryen's text
  format with `wasm-opt` (from memory). Each has an interpreter used as a
  reference: Cranelift's interpreter, the one inside Binaryen's
  optimizer, and Miri for MIR (from memory). Miri also reports undefined
  behavior, and ours can report leaks and double drops by keeping counts.
  Our printer writes eDSL text, which is FunctionalScript, so reading a
  printed module back is just running it.

## What only our design does, and its risks

### What no compared IR does

1. **Integer ranges are its only integer types, with exact arithmetic.**
   Pascal's subranges and Ada's range types live in source languages, and
   LLVM's range metadata is a hint for the optimizer (from memory). No
   compared IR has them as types.
2. **A sum declares its bits, and the checker proves them disjoint.**
   Only Habit's bitdata does this, in a source language.
3. **One language serves generated code and the runtime,** separated by
   sealed types rather than by dialects or by an unsafe subset.
4. **Ownership is derived from types,** so hand-written runtime code gets
   its `dup`, `drop` and `release` from the same pass as generated code.
5. **A canonical-NaN type** turns NaN boxing's classic mistake into a
   type error.

### Risks

- **The checker is the trusted base.** Types, refinement, ownership and
  layouts meet in one checker, and a bug there is a hole in safety. MIR's
  borrow checker shows how hard this gets with first-class references. We
  avoid those, but refinement across `br` and loops still needs care.
  What lowers the risk: two refinement rules instead of a solver, an
  interpreter that keeps counts, tests that mutate checked modules, and
  the Rust borrow checker as a second check on program code.
- **Intervals miss relations.** After `le(i, n)`, `sub(n, i)` still has a
  range that reaches below 0, so code that uses it as a length needs a
  `narrow` that never fails. String slicing will meet this often. What
  lowers the risk: count the `narrow`s in the first hand-written modules,
  and add facts such as `i <= n` only if there are many.
- **Exactness costs something in loops.** An accumulator needs a `wrap`,
  a `narrow` or a wider type. Generated code rarely meets this, because
  FunctionalScript numbers are `f64` and bigints live in the heap. In
  runtime code, that cost is the point.
- **Layouts could bring `unsafe` into Rust.** Declared bits become
  integers and addresses in the generated Rust, which could cost IR
  choice 9 its free second check. The revised plan keeps that check for
  program code, where `any` stays an opaque Rust type. For runtime
  modules it depends on how Rust reaches the heap, which
  [pointer-width.md](./pointer-width.md) decides.
- **Template form copies code.** With names in the data, every inlining
  renames locals.
- **A chain of updates copies.** L0's builders build in one pass, but a
  value that grows through repeated `concat` calls is copied each time,
  until `try_unique` exists.
- **There is no optimizer.** Binaryen exists to optimize, and the plan
  has none. Measuring with `wasm-opt` on our output shows what that costs
  before we build anything.
- **Layout checking is new work.** No IR has done it, so the notation and
  the disjointness check have no implementation to follow. A prototype
  has run the check on the README's NaN box, and plan step 3 proves it
  there before anything depends on it.

### An opening

Keeping layout apart from type makes other targets cheaper. A WasmGC
target could lay heap objects out as GC structs, drop nothing, and give
`any` a layout that is not NaN-boxed, all without changing the functions
that use them.

## What this round changed

The round made fourteen findings against the first draft. This is where
each one went in the revised [type-system.md](./type-system.md).

| # | Finding | Outcome |
| --- | --- | --- |
| 1 | Name owned temporaries in the owned stage, like `g(a)` in `f(g(a))` | Adopted, in [the lifetime pass](./type-system.md#the-lifetime-pass) |
| 2 | Define "at most 64 bits wide" as "fits an `i64` or a `u64`", so that `div` on two `i(64)` values is a type error; say how `div` rounds | Superseded. Integers are [exact up to 128 bits](./type-system.md#integers-are-exact), the quotient has a 65-bit type, and `div` rounds toward zero |
| 3 | Let `narrow` refine its operand, so that a repeated check disappears | Adopted in another form: `narrow` is [an `if_`](./type-system.md#one-exact-operation-four-fits), and its result has the type |
| 4 | Reduce effects to whether code may fail | Adopted, as [one effect](./type-system.md#functions-control-flow-and-failure) |
| 5 | Show that the heap stays acyclic with local recursion | Already settled in [L0 core, Lifetime](../wasm/l0-core.md#lifetime); the note now cites it |
| 6 | `try_unique`, Perceus's reuse on top of `uniq` | Kept [for later](./type-system.md#heap-objects-are-immutable-once-frozen), as an optimization |
| 7 | Drop specialization | Later, once the pass is correct |
| 8 | Counts in the interpreter, to report leaks and double drops | Adopted, as the [counting heap](./type-system.md#how-it-is-checked) |
| 9 | A Rust carrier that keeps the borrow checker's second check | Kept for program code; for runtime modules it waits for [pointer-width.md](./pointer-width.md) |
| 10 | Golden tests in IR text | Adopted |
| 11 | Carriers as their own pass, so that emitters only spell | Extended to a [low level](./type-system.md#one-language-two-levels) under the whole language, with data lowering and the wide-integer pass tested alone |
| 12 | Indices inside, names in text | [Open question 10](./type-system.md#open-questions) |
| 13 | Relations between ranges | [Open question 14](./type-system.md#open-questions) |
| 14 | `wasm-opt` on the output, as a measurement | An optional measurement, never a build step |

## Sources

### Read for this comparison

Quotes in this note come from these pages. Some were read only in part,
as noted.

- **Binaryen:** the [README](https://github.com/WebAssembly/binaryen); the
  first third of
  [`src/wasm.h`](https://github.com/WebAssembly/binaryen/blob/main/src/wasm.h);
  the wiki page
  [Compiling to WebAssembly with Binaryen](https://github.com/WebAssembly/binaryen/wiki/Compiling-to-WebAssembly-with-Binaryen).
- **Cranelift:**
  [`cranelift/docs/ir.md`](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/docs/ir.md),
  which calls itself "likely to be outdated"; the first two thirds of
  [`instructions.rs`](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/codegen/meta/src/shared/instructions.rs);
  the first half of the
  [ISLE language reference](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/isle/docs/language-reference.md);
  [ISLE integration](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/docs/isle-integration.md).
- **Rust MIR:** the rustc dev guide's
  [MIR overview](https://github.com/rust-lang/rustc-dev-guide/blob/master/src/mir/index.md),
  [drop elaboration](https://github.com/rust-lang/rustc-dev-guide/blob/master/src/mir/drop-elaboration.md)
  and
  [MIR passes](https://github.com/rust-lang/rustc-dev-guide/blob/master/src/mir/passes.md).
- **MLIR:**
  [`LangRef.md`](https://github.com/llvm/llvm-project/blob/main/mlir/docs/LangRef.md);
  most of
  [`Rationale.md`](https://github.com/llvm/llvm-project/blob/main/mlir/docs/Rationale/Rationale.md);
  [`SCFOps.td`](https://github.com/llvm/llvm-project/blob/main/mlir/include/mlir/Dialect/SCF/IR/SCFOps.td);
  most of
  [`BuiltinTypes.td`](https://github.com/llvm/llvm-project/blob/main/mlir/include/mlir/IR/BuiltinTypes.td).
- **Lean 4:**
  [`src/Lean/Compiler/IR/Basic.lean`](https://github.com/leanprover/lean4/blob/master/src/Lean/Compiler/IR/Basic.lean).
  Its borrow, RC and reset-reuse passes were not at the paths tried.
- **Perceus:** Alex Reinking, Ningning Xie, Leonardo de Moura and Daan
  Leijen,
  [Perceus: Garbage Free Reference Counting with Reuse](https://www.microsoft.com/en-us/research/uploads/prod/2020/11/perceus-tr-v4.pdf),
  MSR-TR-2020-42, version 4, 2021.
- **Our own notes:** [type-system.md](./type-system.md),
  [ir-design.md](./ir-design.md),
  [l0-design.md](../wasm/l0-design.md) and
  [l0-core.md](../wasm/l0-core.md).

### Cited from memory

These are marked "from memory" where they appear, and were not checked
against a source this time.

- the WAT folded form, WASM 2.0's loop parameters, and WASM's lack of a
  128-bit multiply;
- Habit's bitdata: Iavor Diatchki, Mark P. Jones and Rebekah Leslie,
  "High-level views on low-level representations", ICFP 2005;
- Lean's borrow inference and the placement of its `dec`: Sebastian
  Ullrich and Leonardo de Moura, "Counting Immutable Beans", IFL 2019;
  and Lean's runtime in C and C++;
- MIR's `SwitchInt`, `Downcast` and `Assert`, rustc's niche layouts,
  undefined behavior for bad values in Rust, and Miri;
- Pascal's subranges, Ada's range types and LLVM's range metadata;
- Zig's integer types and packed structs, and the parameter conventions
  of Swift and Hylo;
- Cranelift's interpreter and filetests, Binaryen's interpreter and
  tests, and MLIR's FileCheck tests;
- JavaScriptCore's `purifyNaN` and SpiderMonkey's `CanonicalizeNaN`;
- Squeak's Slang and PyPy's RPython.
