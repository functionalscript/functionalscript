# The code IR: a first design

A typed intermediate representation, written as an eDSL, that sits one
phase before the target. The WASM backend is its first user. The aim is
that a Rust backend, and later ones, read the same IR, so that typing,
lifetimes and runtime calls are decided once, and each target only spells
them.

This is an independent first round. It was written without looking at
Binaryen's IR or any other compiler's. A second round compares it with
them ([Comparison round](#comparison-round)). Nothing here is decided yet.

## Summary

- The IR is a **typed expression tree with structured control flow**:
  `block`, `if`, `loop` and `br`, as in WASM and in Rust.
- It has **six types**: `any`, `f64`, `i32`, `bool`, `void` and `never`.
  `any` is L0's opaque value. Everything a type check decided is already
  explicit.
- **A JavaScript primitive written in the IR is that constant**: `1.5` is an
  `f64`, `true` a `bool`, and `'abc'`, `5n`, `undefined` and `null` are
  `any` values. Only an `i32` needs a constructor, `i32(3)`.
- **Every operation comes from a table**. One row gives its name, its
  parameter and result types, whether it borrows or takes each `any`, and
  its effects. The tables are `prim` (typed arithmetic), `l0`, `l1` and the
  module's own functions. The eDSL's constructors and their TypeScript types
  are derived from the rows.
- **Lifetimes are a pass over the IR**, not each target's job. A module
  is written without `dup` and `drop`, and one target-independent pass
  makes them explicit. A validator checks the result.
- **A target is an emitter**: a total function from a validated module to
  `fjs/media/wasm`'s AST, or to Rust source. It spells each table row by a
  rule, with overrides for a WASM instruction or an inline fragment.

## Where it sits

```text
source ─> EDAG ─> prepared FAST ─┬─> JavaScript text   (unchanged)
                                 ├─> Rust text         (today, nanvm-lib API)
                                 │
                                 └─> code IR ─┬─> WASM AST ─> bytes, WAT
                                   (typed,    └─> Rust text  (later, L0/L1 calls)
                                    lowered)
```

Prepared FAST ([`fjs/js/ast/prepare`](../../../fjs/js/ast/prepare/README.md))
is already the plan two serializers share. It fixes bindings, slots, memo
storage and loops, but its values are still JavaScript values, and its
operators are still JavaScript operators. That suits a target that runs
JavaScript semantics itself, and it is why the JavaScript serializer stays
where it is.

The IR is one step lower. Between prepared FAST and the IR, the lowering
decides three things that every target below needs and none should decide
alone:

1. **Typing.** Which values are a known `f64` or `bool`, and which
   operator becomes an instruction instead of an L1 call
   ([L1 design §4](./l1-design.md#4-typed-lowering-is-the-compilers-not-l1s)).
2. **Closure conversion.** A function value becomes `make_function` of a
   code index and a frame, and a capture becomes a `frame` read
   ([L0 design §12](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
3. **Lifetimes.** Where a reference is duplicated and where it is dropped
   ([L0 design §10](./l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)).

The lowering itself is a separate design. This one fixes what it produces.

## An example

L1's `-` ([`l1/module.f.js`](../../../fjs/wasm/runtime/l1/module.f.js)) in
FunctionalScript:

```js
export const subtract = (a, b) => {
    const x = toNumeric(a)
    const y = toNumeric(b)
    return bigintPair(x, y) ? bigintSubtract(x, y) : asNumber(x) - asNumber(y)
}
```

The same body in the IR, as the lowering would produce it, before the
lifetime pass:

```js
import { func, get, if_, let_ } from '…/ir/module.f.mjs'
import { any } from '…/ir/type/module.f.mjs'
import { prim } from '…/ir/prim/module.f.mjs'
import { l0 } from '…/ir/l0/module.f.mjs'
import { l1 } from '…/ir/l1/module.f.mjs'

const subtract = func([['a', any], ['b', any]], any, [
    let_('x', l1.toNumeric(get('a'))),
    let_('y', l1.toNumeric(get('b'))),
    if_(l0.to_bool(l1.bigintPair(get('x'), get('y'))),
        l1.bigintSubtract(get('x'), get('y')),
        l0.from_f64(prim.f64_sub(l0.to_f64(get('x')), l0.to_f64(get('y'))))),
])
```

Every boxing is visible: `to_bool` unpacks the condition, `to_f64` unpacks
each operand and `from_f64` boxes the result. `prim.f64_sub` is `f64.sub`
in WASM and `-` on two `f64` in Rust. The normalized form of the call to
`f64_sub` is the tuple `['call', 'prim', 'f64_sub', x, y]`.

## Design choices

Each choice gives the pick first, then the alternatives and the reason.

### 1. A typed expression tree with structured control flow

- **Pick:** a function body is an expression. Control flow is `block`,
  `if` and `loop` with named labels, and `br` to a label. A block holds
  statements and ends in an expression, which is its value.
- **Alternatives:** a stack machine, as WASM's own instruction list; a
  control-flow graph of basic blocks; SSA.
- **Why:** both first targets are structured. WASM has `block`, `loop`
  and `if`, and Rust has labelled blocks, `loop` and `if`, all of them
  expressions with values. A tree maps to both without a relooper, and it
  is what prepared FAST already is. A stack machine is WASM's alone and
  Rust would have to rebuild the tree. A graph needs a relooper for both
  targets, and it buys only optimizations we are not doing yet. SSA buys
  nothing: FunctionalScript values are immutable, so almost every local is
  assigned once already (choice 6).

### 2. Six types, and the IR does not track a value's kind

- **Pick:** `any`, `f64`, `i32`, `bool`, `void` and `never`.
  - `any` is L0's opaque value, an `i64` in WASM and an `Any` in Rust.
  - `f64` is an unpacked number, and `bool` an unpacked boolean.
  - `i32` is an index, a length, a kind tag, a code index or a builder.
  - `void` is the type of a statement such as `push`.
  - `never` is the type of `br`, `return`, `throw` and `unreachable`. It
    fits wherever any type is expected.
- **Alternatives:** fold `bool` into `i32`, as WASM does; a type per kind
  of `any`, such as `string`.
- **Why:** `bool` is `i32` in WASM, but Rust keeps them apart, and an `if`
  on an `i32` would have to compare with zero. A kind is not a type here,
  because L0 has no typed references
  ([L0 design §2](./l0-design.md#2-typed-values-exist-only-in-the-compiler)).
  What the lowering knew about a kind shows up as the operations it chose:
  `l0.length` instead of `l1.length`.

### 3. A JavaScript primitive is its own constant

- **Pick:** following [DESIGN.md §8](../../DESIGN.md#8-embedded-dsls-should-reuse-host-language-syntax),
  a primitive written in the IR means that value.

  | Written | Type | Meaning |
  | --- | --- | --- |
  | `1.5`, `NaN`, `-0` | `f64` | the number, unpacked |
  | `true`, `false` | `bool` | the boolean, unpacked |
  | `undefined`, `null` | `any` | L0's constants |
  | `'abc'` | `any` | the string, made once at start-up |
  | `5n` | `any` | the bigint, made once at start-up |
  | `i32(3)` | `i32` | an integer |

- **Alternatives:** a tagged constant for every type, such as
  `['const', 'f64', 1.5]`; a string meaning a local, with string constants
  in a constructor.
- **Why:** each of these is exactly the JavaScript value the program
  means, so no tag adds anything. `i32` is the one type with no JavaScript
  value of its own: a number already means `f64`. Locals are read with
  `get('x')`, because `'x'` already means a string. How a literal is made
  belongs to the target. WASM writes the units to a data segment and calls
  `make_string` in `init` ([L0 design §6](./l0-design.md#6-literals-built-once-at-start-up)).
  Rust can keep a static `&[u16]`. The IR only says which value.

### 4. Every operation comes from a table

- **Pick:** the IR has one node for all operations,
  `['call', table, name, ...args]`. A table is data, one row per
  operation:

  ```js
  // the `l0` table, abridged
  export const l0 = table({
      kind:     [[any], i32, pure],
      to_f64:   [[any], f64, traps],
      from_f64: [[f64], any, allocates],
      push:     [[i32, own(any)], void, traps],
      call:     [[any, any], any, throws],
      // …
  })
  ```

  There are four tables:
  - `prim` holds the typed operations every target has: `f64_add`, `f64_lt`,
    `i32_add`, `bool_not`, `f64_from_i32`, and so on.
  - `l0` holds the L0 imports, under their ABI names
    ([L0 design, Summary](./l0-design.md#summary)), except the ones that
    take a pointer (choice 10).
  - `l1` holds the L1 operations, all `any` to `any`
    ([L1 design §5](./l1-design.md#5-one-calling-convention-for-every-l1-operation)).
  - The module's own functions form a fourth table, built from its
    definitions.

  `table` turns the rows into the constructors the example uses, so
  `l0.to_f64(x)` is the call node, and TypeScript checks its arity and
  operand types, the way RTTI's `Ts<typeof s>` is derived from a schema.
- **Alternatives:** a node kind per operation, such as `['f64.add', a, b]`;
  free-form calls by name, with signatures known only to each target.
- **Why:** this follows [DESIGN.md §5](../../DESIGN.md#5-declarative-over-imperative),
  as [`instruction/module.f.js`](../../../fjs/media/wasm/instruction/module.f.js)
  does for the WASM parser and writers. One row is read by the validator,
  the lifetime pass, the printer and every emitter. A new L1 operation is
  then a new row, and not a change to each of them. A proof checks that the
  `l0` table and the [L0 view](../../../fjs/wasm/runtime/l0/module.f.js)
  name the same functions, and that the `l1` table and the L1 module do.

### 5. A row says what a call may do

- **Pick:** each row has one of four effects, in increasing order:
  `pure`, `traps` (a precondition, [L0 design §11](./l0-design.md#11-misuse-traps-and-only-calls-fail)),
  `allocates`, and `throws`. Each `any` parameter is borrowed unless the row
  says `own`, and an `any` result is always owned.
- **Alternatives:** no effects at all, with every call opaque; a full
  effect system with reads and writes.
- **Why:** the lifetime pass needs ownership, and nothing else. The effects
  cost one word per row and let later passes move, merge or drop a call
  safely: a `pure` call whose result is unused can go. FunctionalScript has
  no mutable state a call could change, so reads and writes need no
  tracking.

### 6. Locals have names, and only loop state is mutable

- **Pick:** `let_('x', e)` binds an immutable local. `var_('i', e)` binds a
  mutable one, which `set('i', e)` alone changes. A local is read with
  `get('x')`. Names are unique within a function and parameters are
  locals.
- **Alternatives:** numbered locals, as in WASM; higher-order binders, as
  in `let_(e, x => body)`.
- **Why:** prepared FAST already has this split. A `define` is a `let_`,
  and a `slot` or a `while` slot is a `var_`. Names keep a printed IR
  readable and turn into Rust names directly. A WASM emitter numbers them
  when it lays out the locals. Higher-order binders cannot misspell a name,
  but the IR would then hold functions, and could not be printed, hashed or
  compared until something applied them. The lowering, not a person,
  writes almost all IR, so it keeps the data form.

### 7. Control flow mirrors WASM, and Rust follows by label kind

- **Pick:** the control nodes are:
  - `block(label, type, statements)`, a labelled block with its result
    type;
  - `if_(c, then, else)`, whose condition is a `bool`;
  - `loop(label, statements)`, whose body falls through to leave;
  - `br(label, value)`, which leaves a block with a value, or repeats a
    loop;
  - `return_(value)`, `throw_(value)` and `unreachable`.

  A Rust emitter spells `br` to a block as `break 'label value`, and `br`
  to a loop as `continue 'label`. It spells a loop body that falls through
  as a `break` at its end.
- **Alternatives:** Rust's shape, where a loop repeats until a `break`;
  `br_table` and `select`.
- **Why:** both shapes cost one of the two emitters one extra line. This
  one keeps the WASM emitter a direct mapping, because WASM is the target
  this IR exists for. `throw_` is a node and not an `l0` call, because it
  is `never`. In WASM it is `call $throw` and then `unreachable`
  ([L0 design §13](./l0-design.md#13-errors-a-throw-traps)), and in Rust it
  is the runtime's own throw. `br_table` and `select` can come later, as
  optimizations, once a lowering wants them.

### 8. A module is functions, exports and `init`

- **Pick:** a module holds named functions, the names it exports, and its
  `init` function ([L0 design §20](./l0-design.md#20-a-program-is-one-module-with-an-init-export)).
  `code('f')` is the `i32` code index of function `f`, for `make_function`.
  A function that becomes a value has the shape `(self any, args any) ->
  any`. Any other function may have any signature, and a direct call to it
  is a call to the module's own table.
- **Alternatives:** the module lists its imports and literals itself.
- **Why:** imports are the `l0` and `l1` rows the module calls, and
  literals are the strings and bigints it holds. Both are derived from the
  body, so listing them again could only drift. The direct call is what
  [L1 design §5](./l1-design.md#5-one-calling-convention-for-every-l1-operation)
  needs to compile a top-level function to a plain WASM function.

### 9. Lifetimes are one pass over the IR

- **Pick:** the IR has two stages. The lowering writes the *plain* stage,
  where an `any` is read with `get` as often as needed. The lifetime pass
  writes the *owned* stage. There, each `any` local is consumed exactly
  once on every path, `l0.dup` and `l0.drop` are explicit, and a borrowed
  argument stays a plain `get`. The validator checks the owned stage, and
  only it reaches an emitter.
- **Alternatives:** each emitter places `dup` and `drop` itself; Rust's
  ownership for Rust and a WASM-only pass for WASM.
- **Why:** reference counting is where a backend goes wrong quietly, and
  this way it goes wrong in one place, with one check. The Rust emitter
  gives a second check for free: it spells a consumed `get` as a move, a
  borrowed one as `&x`, and `dup` as `.clone()`, so a mistake in the pass
  is a borrow-checker error in the generated Rust. A frame the host
  abandons after a throw runs no `drop`, which L0 already allows
  ([L0 design §13](./l0-design.md#13-errors-a-throw-traps)).

### 10. No memory, table or bytes in the IR

- **Pick:** the IR has no loads, stores, pointers or table operations. The
  L0 functions that take a `ptr` are not in the `l0` table yet.
- **Alternative:** memory nodes, as in WASM.
- **Why:** nothing written in FunctionalScript reads memory. L1 reads a
  string through `unit`, not `read_units`. Literals are the only bytes a
  program has, and choice 3 gives them to the emitter. A native body that
  needs memory stays native, in the runtime. This keeps the IR portable to
  a target with no linear memory at all.

### 11. A target is a total emitter, spelling rows by rule

- **Pick:** an emitter takes a validated module, in the owned stage, and
  cannot refuse it. It spells each table by one rule. For WASM, `l0` and
  `l1` rows are imports and calls, and `prim` rows are instructions. For
  Rust, a row is a call to the runtime's function of that name. A per-row
  override can replace the rule, for example with a WASM
  [inline fragment](./inline-fragments.md).
- **Alternatives:** each emitter has its own case for every row.
- **Why:** everything an emitter could refuse is checked earlier, by the
  validator, so failures are found once. The rule means a new row needs no
  emitter change. Inline fragments are a property of a target's runtime
  and not of the program, so they belong to the emitter and not to the IR.

### 12. The normalized form is an RTTI schema

- **Pick:** the tuples that the constructors build are declared as an RTTI
  schema, like the compiler's other intermediate forms. A validator, a
  printer to text and the proofs read them.
- **Alternatives:** TypeScript types only.
- **Why:** the IR then has the same derived tools as the repository's
  other data: `validate` for a module that crosses a boundary, the
  TypeScript type from the same declaration, and a canonical form for
  comparisons. The printer gives the proofs and reviews a readable IR,
  before any WASM exists.

## What lives where

| Concern | Today, in the Rust path | With the IR |
| --- | --- | --- |
| Which operator is an instruction | each serializer, implicitly | the lowering, once |
| Closures and captures | Rust closures, in the serializer | the lowering: `make_function`, `frame` |
| Reference counts | Rust's own ownership | the lifetime pass, once |
| Literals | the serializer | each emitter, from the IR's constants |
| Runtime API names | `nanvm_lib` paths in the serializer | the `l0` and `l1` tables |
| Spelling | the serializer | each emitter |

## Steps

Each step is a PR or a short stack, proved before the next starts.

1. **The IR itself.** The schema, the constructors, the four tables, the
   validator and the printer, with proofs over hand-written functions such
   as `subtract` above.
2. **A WASM emitter.** From the IR to `fjs/media/wasm`'s AST, run on a
   JavaScript host whose `fjs:l0` imports are the L0 view's JavaScript
   bodies. A test compares each emitted function with its FunctionalScript
   original on the parity tables.
3. **The lifetime pass**, and the validator for the owned stage.
4. **The lowering** from prepared FAST with types, first for the L1 module,
   whose closure rule makes every operand's type known
   ([L1 design §2](./l1-design.md#2-the-closure-rule)).
5. **A Rust emitter** over the same IR, against NaNVM's L0 in Rust. It
   replaces the current serializer only after it does everything that one
   does ([DESIGN.md §11](../../DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces)).

## Where this draft is least sure

- **Where the IR sits ([Where it sits](#where-it-sits)).** If Rust should keep its
  higher-level `nanvm_lib` API, then only WASM uses the IR, and the IR could
  be lower still.
- **The lifetime pass (9).** Borrowed parameters and owned results are
  simple, but the pass needs to know when a value is last used across a
  `br` that leaves several blocks.
- **Names or numbers for locals (6).** Names read well. Each pass must keep
  them unique, though, and a pass that duplicates code must rename.
- **Where the code lives.** A proposal is `fjs/codegen/ir`, with
  `fjs/codegen/wasm` and `fjs/codegen/rust` as emitters. The IR is not
  WASM's alone, so `fjs/wasm` seems wrong for it.

## Comparison round

The next round compares this design with Binaryen's IR, which the owner
named as a guide, and with designs that solve a similar problem. These are
candidates for that round:

- Binaryen's IR, for a tree IR made to emit WASM;
- Cranelift's CLIF, for a typed IR shared by several targets;
- Rust's MIR, for ownership made explicit in an IR;
- the WebAssembly text format's folded form, for the smallest tree over
  WASM;
- the Perceus papers' reference-counting insertion, used by Koka and Lean,
  for choice 9.

For each one, the round records what it does on each axis above, what it
would change here, and why we would or would not follow it.
