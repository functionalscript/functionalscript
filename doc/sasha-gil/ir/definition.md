# The code IR: one definition

**Proposed** on 2026-11-12, from the owner's direction for the next step:
the IR is first of all what the compiler lowers FAST into on the way to
WASM, and it keeps its second purpose, a typed low-level language for
writing the runtime. This note shapes what
[ir-design.md](./ir-design.md) and [type-system.md](./type-system.md) hold
into one definition that serves both. Where the two notes disagree, or
leave open a point that the FAST-to-WASM path needs,
[TODO_DESIGN.md](./TODO_DESIGN.md) lists it and this note picks an answer.
Nothing here is decided.

A prototype checks the definition. Its checker, lifetime pass and WASM
emitter take seven functions, three of them bodies of the L1 module, to a
WASM module that runs under Node ([Running it](#running-it)).

## Summary

- **One definition, two producers.** The IR is a data form: modules of
  types, constants and functions. The lowering from FAST produces it, and
  so does the eDSL in which people write runtime code. Nothing below the
  data form depends on who wrote a module.
- **Eight questions, each answered once.** Which values, which bits, who
  releases, who may look inside, what is computed, whether it can fail,
  who provides it, and how far it is lowered
  ([The IR on one page](#the-ir-on-one-page)). An answer to one changes no
  other.
- **A program depends on interfaces, never on a runtime.** An interface is
  what a module shows: sealed types, constants and function signatures.
  L0's five modules and L1's native rows are interfaces written from their
  designs. So program code is compiled against a small host in JavaScript
  today, and later, unchanged, against NaNVM as a `.wasm`, against runtime
  modules written in the IR, or with those modules inlined.
- **Sixteen term forms.** Each type former has one form that makes a value
  and one that uses it. Names, calls and four control forms are the rest.
  `if`, `not`, `return`, `throw`, the four fits, casts and conversions are
  definitions over them.
- **A core that needs no memory.** Program code and the L1 bodies use
  integer ranges, floats, products, `bool`, sealed names and code. Declared
  bits, heap objects, references, `load` and `store` are for runtime
  modules. The core is enough for
  [step 4 of the WASM plan](../wasm/README.md#plan), so it comes first.
- **The lowering reads normalized FAST.** Its blocks with results, loops
  with parameters and immutable definitions are the IR's own shape.
  Prepared FAST adds mutable slots, which the IR does not have.
- **Checked on real code.** In the prototype, 312 calls of emitted WASM
  agree with the FunctionalScript originals, a host that counts every value
  finds none left over, and 16 deliberate mistakes are refused. Ten points
  that the notes do not state came out of it
  ([What the check found](#what-the-check-found)).
- **What needs the owner.** Whether this note becomes the reference, the
  lowering's input, the order of work, and seven smaller points
  ([Open questions](#open-questions)).

## The IR on one page

```text
FunctionalScript source                eDSL in FunctionalScript
        │  compiler: normalized FAST           │  runtime modules, by hand
        ▼                                      │
     lowering ─────────────┐     ┌─────────────┘
                           ▼     ▼
                   module, plain stage      checked: types, matches, the effect
                           │  lifetime pass
                           ▼
                   module, owned stage      checked: each owned value consumed once
                           │  data lowering, where a module has layouts or objects
                           ▼
                   module, low level        integers, floats and memory
                      ┌────┴────┐
                      ▼         ▼
                    WASM       Rust
```

| Question | Answered by | Section |
| --- | --- | --- |
| Which values can it be? | its **type**: seven formers and names | [Types](#types) |
| Which bits hold it? | its **layout**: derived, or declared where bits matter | [type-system.md, Layout](./type-system.md#layout) |
| Who may copy it, and who must release it? | its **ownership**: whether its type has `dup` and `drop` | [Ownership](#ownership-is-two-capabilities) |
| Who may look inside it? | the **seal**: an interface shows a type's name and public variants | [Modules and interfaces](#modules-and-interfaces) |
| What is computed? | **terms**: sixteen forms | [Terms](#terms) |
| Can it fail? | one **effect** bit on a function | [One effect](#one-effect) |
| Who provides it? | the **binding** of an interface, chosen when linking | [Bindings](#bindings) |
| How far is it lowered? | its **stage**: plain, owned, low | [Stages](#stages) |

The answers are independent:

- changing the layout of `any` changes no function that uses it;
- changing a binding changes no IR, only what the emitter writes for a
  call;
- the lifetime pass reads ownership and nothing else;
- a seal limits which arms a module may write, not what an arm means;
- the checker, the passes and the emitters read a module the same way
  whether the lowering or a person wrote it.

## Modules and interfaces

A module has five parts.

| Part | Holds |
| --- | --- |
| Imports | the interfaces it uses, by name |
| Types | named types |
| Constants | `name: type = term`, evaluated once, in order |
| Functions | `name(parameters) -> result = term` |
| Exports | the names it shows; its own interface follows from them |

An **interface** is what the checker needs to know about a module and
nothing more.

- **A type** has a name. If it is a sum, the interface lists its public
  variants in the order of their tags. It names the functions that are the
  type's `dup` and `drop`, where it has them, and the function that makes a
  literal of it, where it has literals.
- **A constant** has a name and a type.
- **A function** has parameters with modes, `borrow` unless it says `own`,
  a result type and the effect bit.

An interface is written by itself, as data. A module written in the IR
satisfies one with its exports, and a host satisfies one with imports. This
is how the two purposes meet: program code sees `any` through the
interface of the Any module and never through its bits.

Part of L0 as interfaces, from the
[L0 design's summary](../wasm/l0-design.md#summary) and the split of
[modular-l0.md](../wasm/modular-l0.md), as the prototype writes them:

```text
interface Any
    type any = undefined | null | boolean | number | string | bigint | array | object | function
        kind: kind, dup: dup, drop: drop, a string literal: String.make_string
        need no release: undefined, null, boolean
    const undefined: any.only(undefined)                    and null, true, false
    fn kind(v: any) -> int(0, 8)
    fn to_f64(v: any.only(number)) -> f64c
    fn from_f64(x: f64) -> any.only(number)

interface String
    fn length(s: any.only(string)) -> u(31)
    fn at(s: any.only(string), i: u(31)) -> u(16)           may fail

interface Containers
    type builder                                            no dup, no drop
    fn begin_array(n: u(31)) -> builder
    fn push(own b: builder, own v: any) -> builder          may fail
    fn seal(own b: builder) -> any.only(array)              may fail
    fn item(a: any.only(array), i: u(31)) -> any            may fail

interface Functions
    fn make_function(c: code([any.only(function), any.only(array)], any),
                     own frame: any.only(array), length: u(31),
                     own text: any.only(string, undefined)) -> any.only(function)
    fn frame(self: any.only(function), i: u(31)) -> any     may fail
    fn throw(v: any) -> never                               may fail
```

Three things the types say that the `l0` table of
[IR choice 4](./ir-design.md#4-every-operation-comes-from-a-table) could
not:

- `to_f64` takes a number, so it cannot fail, and passing a value of
  unknown kind is a type error;
- `throw` answers `never`, so it needs no node of its own;
- a builder is a type, so an index cannot be pushed into.

### Bindings

An interface is bound when a program is linked. The IR of the program is
the same for every binding.

| Binding | Its functions are | Serves |
| --- | --- | --- |
| A host | imports of a module that the host provides | step 4: a runtime in JavaScript, or NaNVM as a `.wasm` |
| An IR module in import form | functions of another compiled module | runtime modules written in the IR; the stock module, for a program |
| An IR module in template form | compiled into the program and inlined | the specialized mode |
| Fragments | bodies taken from the runtime's `.wasm` | the specialized mode, before a runtime module exists in the IR |

Template form and [inline fragments](../wasm/inline-fragments.md) are then
two bindings of one interface. Fragments work on a runtime compiled from
anything, and template form needs the module's IR.

For WASM, a binding adds what a signature does not say: the import module,
such as `fjs:l0`, a carrier for each sealed type, and the ABI name where it
differs. The emitter then follows six rules:

1. A sealed type is its carrier: `any` is an `i64`, and a builder an `i32`.
2. A result of type `unit` is no result. After a call whose result is
   `never`, the emitter writes `unreachable`.
3. An `own` parameter that the function gives back is passed once and not
   returned, and the result has that parameter's type.
   `push(own b, own v) -> builder` is L0's `push(builder, v)`, and the
   emitter reads `b` again after the call.
4. Several functions may bind to one import when their WASM types agree.
   `String.length`, `BigInt.length` and `Containers.length` are all
   `fjs:l0`'s `length` today, and one import each with a modular L0.
5. A constant of an interface is an imported global
   ([L0 design §3](../wasm/l0-design.md#3-constants-imported-immutable-globals)).
6. A literal of a sealed type is bytes in a data segment and one call of
   the type's literal function
   ([L0 design §6](../wasm/l0-design.md#6-literals-built-once-at-start-up)).

### Constants

A constant is a named term that is evaluated once. `init` is derived: it
evaluates the constants in their order
([L0 design §20](../wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)).
So the term of a constant reads only the constants before it, itself or
through a function that it names, and the checker refuses any other read.
Normalized FAST gives such an order: its definitions run in sequence, and
a function holds its captures from where it is defined. A use of a
constant is a borrow. One notion covers four things that the notes treat
apart:

- a module-level definition of FAST, such as L1's `typeNames`;
- a string or bigint literal, which is a constant named by its spelling,
  so that it is made once
  ([IR choice 3](./ir-design.md#3-a-javascript-primitive-is-its-own-constant));
- the constants of L0, which a module reads from the Any interface;
- the `constant(T, value)` of
  [type-system.md](./type-system.md#the-floor-state-lives-in-one-module).
  A constant of a copy type whose term is a literal is data, and an
  emitter may place it in a data segment.

## Types

The seven formers of [type-system.md](./type-system.md#types) stay. Each
has one term form that makes a value and one that uses it.

| Former | Its values | Made by | Used by | In the core |
| --- | --- | --- | --- | --- |
| Integer range | the integers from `a` to `b` | `lit`, operators | operators, `match` | one word |
| Float | `f64`, and `f64c` with one NaN | `lit`, operators | operators | yes |
| Product | one value per field | `make` | `field` | yes |
| Sum | one variant of a tree | `variant` | `match` | `bool`, and sealed sums |
| Code | a top-level function | `code` | `call_ref` | `code` only |
| Heap object | a record in the heap | `alloc`, `push`, `set` | reads through a reference | no |
| Reference | `ref`, `uniq`, `stat`, `view` | `freeze`, lending | field and tail reads | no |

A **name** is not a former. It gives a type an identity: a brand, a seal,
an object's identity, or recursion
([type-system.md](./type-system.md#names-do-four-jobs)). A sealed type is
a name whose definition its interface leaves out.

`unit`, `never`, `bool`, `option(T)` and `u8` to `u64` are definitions in a
prelude. Subtyping is the subset relation, integers are exact, and a
`T.only(…)` keeps some variants of a sum. All of that is type-system.md's
and does not change.

### Ownership is two capabilities

A value can be duplicated or not, and it can be discarded or not. A type
is one of four kinds by which of the two it has.

| The type has | It is | In code as written | The lifetime pass |
| --- | --- | --- | --- |
| both, and they do nothing | copy | used freely | adds nothing |
| `dup` and `drop` | counted | used freely | adds `dup` and `drop` |
| `drop` only | unique | consumed at most once on each path | adds `drop` |
| neither | linear | consumed exactly once on each path | adds nothing, and refuses a path that leaves the value over |

- **A type that a module can see inside** gets its kind from what it
  holds, as in [type-system.md](./type-system.md#three-kinds-of-type). The
  strictest part decides.
- **A sealed type** gets its kind from its interface: the functions that
  the interface names as its `dup` and `drop`.
- **A subset of a sealed sum** is copy when the interface says that each
  of its variants needs neither. NaNVM's box can say that of `undefined`,
  `null`, `boolean` and `number`. A value known to be a number then costs
  no `dup` and no `drop`, in import form as well. A `drop` of a wider type
  still accepts such a value and does nothing.
- **Linear is the fourth kind**, and L0 already has one. The ABI seals a
  builder and has no function that abandons one
  ([L0 design §8](../wasm/l0-design.md#8-containers-a-builder-handle-then-seal)),
  so in import form every path seals a builder or traps. Where Containers
  is a module in the IR, a builder is a `uniq` object and has a `drop`. A
  program that checks against the stricter interface checks against the
  other.

Parameter modes, views, heap objects and the derived `release` stay as
[type-system.md](./type-system.md#ownership-and-memory) has them.

## Terms

A function's body is one term. There are sixteen forms.

| Group | Form | Is |
| --- | --- | --- |
| Names | `lit(T, value)` | a literal: of an integer range or a float anywhere, of a sealed type as the whole term of a constant |
| | `get(x)` | a local |
| | `let(x, e, body)` | `e` bound to `x` in `body`; with no `x`, `e` for its effect |
| Computing | `op(name, …)` | an operator, typed by its operands |
| | `call(module, f, …)` | a function of this module, or of an interface it imports |
| | `constant(module, c)` | a constant, borrowed |
| Data | `make(fields)`, `field(e, k)` | a product, and one of its fields |
| | `variant(T, v, e)`, `match(e, arms)` | a sum, and a branch on it |
| | `code(f)`, `call_ref(c, …)` | a function as a value, and a call of one |
| Control | `block(label, T, body)` | a region that a `br` can leave with a `T` |
| | `loop(label, parameters, body)` | a region that a `br` can repeat; its value is its body's |
| | `br(label, e)` | the one transfer |
| | `trap(reason)` | a failure at a named point |

- **Locals are never reassigned.** A `let` binds once, and a loop's state
  is its parameters, so the IR is in SSA form by construction
  ([type-system.md](./type-system.md#functions-control-flow-and-failure)).
- **`br` is the only transfer.** To the label of a `block` it leaves with
  the block's result. To the label of a `loop` it repeats with the next
  parameters, which is type-system.md's `next`. A function's body is a
  block labelled `return`. So `return` is a `br`, and a `continue` of an
  outer loop from an inner one needs nothing new.
- **A call names a function, not a table.** The `l0`, `l1`, `str` and
  `self` tables of
  [IR choice 4](./ir-design.md#4-every-operation-comes-from-a-table)
  become modules: the five of L0, L1's native rows, and the module itself.
  The `prim` table becomes the operators.
- **`match` is the only branch.** On a sum it has an arm per variant or
  group, on an integer an arm per value, and an `else`. Its arms see the
  operand at their own type, and a branch on a comparison narrows a local
  ([flow refinement](./type-system.md#flow-refinement-is-two-rules)). A
  `match` lends its operand to its arms.
- **A literal of a sealed type is a constant.** Its `lit` is the whole
  term of a [constant](#constants) named by its spelling, so a string is
  made once however often a module writes it. A producer may write the
  literal where it is used.

The operators are a fixed table, each typed by its operands.

| Where | Operators |
| --- | --- |
| Integers | `add`, `sub`, `mul`, `div`, `rem`, `and`, `or`, `xor`, `shl`, `shr`, `eq`, `lt`, `le` |
| Floats | `add`, `sub`, `mul`, `div`, `eq`, `lt`, `le`, `neg`, `abs`, `sqrt`, `min`, `max`, `canon` |
| Between them | `float(i)`, exact for a range within ±2^53; `trunc_sat(T, x)`; `to_bits`, `from_bits` |
| The owned stage | `dup`, `drop`; for a sealed type, the functions that its interface names |
| Heap objects | `alloc`, `push`, `set`, `freeze`, and reads of a field or a tail |
| The low level | `load`, `store` |

What a producer may write, and what it stands for:

| Written | Stands for |
| --- | --- |
| `if_(c, a, b)` | `match(c, { true: a, false: b })` |
| `not(b)`, `ne(a, b)` | `if_(b, false, true)`, `not(eq(a, b))` |
| `return_(e)` | `br('return', e)` |
| `throw_(v)` | `Functions.throw(v)`, whose result is `never` |
| `lit(T, value)` of a sealed type, inside a term | `constant(self, spelling)`, and that constant in the module |
| `narrow(T, e)` | a test with a `trap` in the other branch: of the bounds for a range, of the variants for a sum |
| a cast, `narrow` as a statement | `match(e, { T: x => the rest of the block, else: trap })` |
| `try_narrow(T, e)` | the same test, answering `option(T)` |
| `wrap(T, e)`, `clamp(T, e)` | as in [type-system.md](./type-system.md#one-exact-operation-four-fits) |
| `exact(T, x)` | `trunc_sat`, `float` of the result, `eq` with `x`, and a `trap` where they differ |
| `trunc(T, x)`, `try_trunc(T, x)` | tests for a NaN and for the bounds, then `trunc_sat` |
| `div`, `rem` and shifts of the high level | the tests that the types need, then the low level's operator ([type-system.md](./type-system.md#no-targets-corner-case-leaks-in)) |

Two of them are new.

- **A cast is a `narrow` on a sum.** type-system.md has `narrow` for
  integer ranges only, and the L0 view's `asNumber`, `asString` and the
  rest are where a program's types come from
  ([L0 design §17](../wasm/l0-design.md#17-a-functionalscript-view-of-l0)).
  As a statement it puts the rest of the block into the arm. The arm's
  local is the operand itself, lent, at the narrower type, so a cast
  costs no `dup`.
- **`exact` is the conversion that the L0 view makes.** An index of 1.5 is
  "not an index" there, where type-system.md's `trunc` would answer 1.

### One effect

A function may fail, by a trap or a throw, or it cannot
([type-system.md](./type-system.md#functions-control-flow-and-failure)).
An interface declares the bit, and the checker infers it for a function
written in the IR, repeating over a module until no function changes. A
call that cannot fail may be moved, merged or removed, and a call that may
fail keeps its order.

### Stages

A module goes through three stages, as
[type-system.md](./type-system.md#one-language-two-levels) has them.

| Stage | Written by | Has | Checked for |
| --- | --- | --- | --- |
| Plain | the lowering, or a person | no `dup` and no `drop` | types, matches, the effect |
| Owned | the lifetime pass | `dup` and `drop` as operators | each owned value consumed once on every path |
| Low | data lowering | no sums, objects or references; `load` and `store` | integers, floats, memory |

Derived forms are written out before the plain stage is checked, so the
checker knows the sixteen forms and nothing else. A module that has no
layout and no heap object has nothing for data lowering to do, and its
owned stage goes to the emitter as it is.

## The core and the rest

The two purposes use different parts of one language.

| | The core | Layout and heap |
| --- | --- | --- |
| Types | integer ranges in one word, floats, products, `bool`, sealed names, code | declared `bits`, other sums, heap objects, the four references, integers in two words |
| Terms | fifteen forms: no `call_ref` | all sixteen, with the heap operators |
| Passes | checker, lifetime pass, emitter | also the layout proof, data lowering, the wide-integer pass and Heap |
| Who needs it | program code, the L1 bodies, L2 | Any, String, BigInt, Containers, Functions, Heap |
| Proved on | a host that implements the interfaces | the interpreter with its counting heap |

- **The core is the FAST-to-WASM path.** With the interfaces of L0 and a
  host, it is all that
  [step 4 of the WASM plan](../wasm/README.md#plan) needs.
- **The two parts meet at interfaces.** So they can be built in either
  order, or side by side. Nothing in the core changes when a host import
  becomes a module written in the IR.
- **Nothing is lost for the runtime language.** Everything in
  type-system.md that this note does not mention stays as it is there:
  exact integers up to 128 bits, layouts, the NaN box, heap objects, the
  Heap module and the low level.

## From normalized FAST to the IR

The compiler's pipeline is
([architecture](../../../fjs/compiler/architecture.md)):

```text
JS text -> tokens -> source AST -> FAST -> EDAG -> FAST -> prepared FAST -> target text
```

The lowering reads the FAST that comes back from the EDAG, before
preparation. That FAST "has immutable values and explicit branch results,
loop inputs, loop results and resolved transfers"
([architecture](../../../fjs/compiler/architecture.md)). Preparation is
"the physical plan shared by the JavaScript and Rust serializers"
([prepare](../../../fjs/js/ast/prepare/README.md)): it adds mutable result
slots, memo storage and `while` loops over slots. The IR has no mutable
local, and both flow refinement and the lifetime pass depend on that. The
other notes name prepared FAST throughout
([TODO_DESIGN.md](./TODO_DESIGN.md#contradictions)).

| Normalized FAST ([types](../../../fjs/js/ast/types.ts)) | The IR |
| --- | --- |
| A module-level `define` | a constant |
| A module-level `define` of a function | a function |
| The object that the module yields | the exports |
| `define b = v`, `required` | `let` |
| `define b = v`, `lazy` | refused for now; the L1 module has none |
| `['ref', b]` | `get`, a `constant`, or a capture |
| A primitive | a `lit`, a constant of Any, or a literal constant |
| An operator with operands of known types | an operator ([L1 design §4](../wasm/l1-design.md#4-typed-lowering-is-the-compilers-not-l1s)) |
| Any other operator | a `call` of L1 |
| A function of the L0 view | a `call` of an L0 module, or a cast |
| `['if', c, a, b]` and the `if` statement | `match` on a `bool` |
| `['block', b]` and the `block` statement | the block's body, in a `block` where an exit leaves it |
| A statement with several results | a `let` of a product |
| `['loop', l]` | `loop`, with the loop's parameters and their first values |
| `yield` | the value of the region |
| `continue` | `br` to the loop |
| `break` | the loop's value where it ends the body, else `br` to a `block` around the loop |
| `return` | `br` to `return` |
| `throw` | `Functions.throw` |
| A function that is only called | a function, with its captures as its first parameters |
| A function that is a value | that, a `(self, args)` function that calls it, and `make_function` |

Six rules do the work that the table leaves.

1. **Imported names resolve when lowering.** A module-level `define` that
   reads a name of the L0 view is not a value. `kind` is `Any.kind`,
   `BOOLEAN` is the tag of `boolean`, and `unit` is `String.at`.
2. **A capture of a module-level binding is not a capture.** In FAST every
   top-level function captures the constants and functions it uses. The
   lowering reads the constant, or calls the function.
3. **A binding has the narrowest type its definition gives.** A number is
   an `f64`, a condition a `bool`, a length a `u(31)`, and a value of
   unknown kind an `any`. In the L1 module every operand's type is known
   ([the closure rule](../wasm/l1-design.md#2-the-closure-rule)).
4. **A cast gets a name, and its scope is the rest of the block.** FAST
   has `asString(b)` as a statement whose value nothing reads, and goes on
   reading `b`. The lowering reads the narrowed local instead.
5. **A function that is only called is lifted.** A source loop reaches the
   lowering as a function that its block calls once. Its captures become
   parameters, typed as they are where it is defined.
6. **A typed value meets `any` through a conversion.** `to_f64`,
   `from_f64`, `to_bool` and `from_bool` are written where a known type
   and an `any` meet, so every boxing is visible, as in ir-design.md's
   example.

### A worked example

`stringEquals` of the
[L1 module](../../../fjs/wasm/runtime/l1/module.f.js):

```js
export const stringEquals = (a, b) => {
    const n = length(asString(a))
    asString(b)
    if (n !== length(b)) { return false }
    let i = 0
    while (i < n && unit(a, i) === unit(b, i)) {
        i = i + 1
    }
    return i === n
}
```

Its normalized FAST, which `node definition.fast.mjs stringEquals` prints
in full, in short:

```text
function 150 (a, b)                     captures length, asString, unit
    define 125 = length(asString(a))
    define _ = asString(b)
    return if 125 !== length(b)
        then false
        else
            define 145 = function 145 (i0)          captures 125, unit, a, b
                loop 145 (i = i0), results (r)
                    if (block: define 133 = i < n
                               yield (if 133 then unit(a, i) === unit(b, i) else 133))
                        then continue 145 (i + 1)
                        else break 145 (i)
                return r
            145(0) === 125
```

Lowered by hand, rule by rule, and printed by the prototype:

```text
fn stringEqualsF(a: any, b: any) -> any =
    match a
      string as sa =>
        let n = String.length(sa)
        match b
          string as sb =>
            if not(eq(n, String.length(sb))) then
                Any.false
            else
                Any.from_bool(eq(stringEqualsF.loop(n, sa, sb, 0.0), float(n)))
          else => trap('not string')
      else => trap('not string')

fn stringEqualsF.loop(n: u(31), a: any.only(string), b: any.only(string), start: f64) -> f64 =
    loop L (i: f64 = start)
        if
            let c = lt(i, float(n))
            if c then
                eq(String.at(a, exact(u(31), i)), String.at(b, exact(u(31), i)))
            else
                c
        then
            br L { i: add(i, 1.0) }
        else
            i
```

The lifetime pass adds nothing to these two functions. Both arguments are
borrowed, the casts lend them on, and `Any.false` is a copy value.

A later pass can do better, and the IR has room for it. With the loop
function inlined and the counter as an integer, the same function is:

```text
fn stringEquals(a: any, b: any) -> any =
    match a
      string as sa =>
        let n = String.length(sa)
        match b
          string as sb =>
            if not(eq(n, String.length(sb))) then
                Any.false
            else
                loop L (i: u(31) = 0)
                    if lt(i, n) then
                        if eq(String.at(sa, i), String.at(sb, i)) then
                            br L { i: add(i, 1) }
                        else
                            return Any.false
                    else
                        Any.true
          else => trap('not string')
      else => trap('not string')
```

Inside `lt(i, n)` the counter is at most 2^31 − 2, so `add(i, 1)` fits a
`u(31)` with no check. The emitter writes the loop as follows, shown
without the writer's label comments:

```wat
i32.const 0
local.set $i
loop (result i64)
  local.get $i
  local.get $n
  i32.lt_s
  if (result i64)
    local.get $a
    local.get $i
    call $unit
    local.get $b
    local.get $i
    call $unit
    i32.eq
    if
      local.get $i
      i32.const 1
      i32.add
      local.set $i
      br 2
    else
      global.get $false
      return
    end
    unreachable
  else
    global.get $true
  end
end
```

Both forms answer as the FunctionalScript original does on 121 pairs of
strings, and trap where it throws.

## What the check found

The prototype is the files `definition.*.mjs` next to this note
([Running it](#running-it)). It writes the interfaces above, lowers seven
functions by hand, and takes them through a checker, a lifetime pass and a
WASM emitter for import form. The module then runs under Node on a host that implements the
`fjs:l0` imports and counts every value.

| Function | From | Shows |
| --- | --- | --- |
| `typeOf` | L1 | a module constant, and an array read with its bounds test |
| `toBoolean` | L1 | kind tests, casts, a `bool` result, `length` split by module |
| `stringEquals`, twice | L1 | casts as statements, a loop as a lifted function, a float and an integer counter |
| `chain` | `a?.[0]?.[0]` | an optional chain as a `block`, left while it owns a value |
| `repeat` | a loop that joins strings | a loop that owns its state |
| `adder` | `a => b => a + b` | a function value: code, a frame, and a `(self, args)` function |

- **312 calls** of the emitted WASM agree with the FunctionalScript
  originals, and after each one the host has no value left over.
- **16 mistakes** are refused: 14 by the checker, such as a string
  function on a value of unknown kind, a counter incremented without a
  comparison, or a constant that reads a later one, and 2 by the lifetime
  pass, a builder used after `seal` and a builder never sealed.
- **9 modules that break no rule** of typing or of ownership are refused
  all the same. Each meets a limit of the prototype or uses a name that is
  taken ([What the prototype is not](#what-the-prototype-is-not)).
- **Without the lifetime pass** the host reports values left over, so
  the count has teeth.

What it found, with where this note takes it up:

1. **The first function needs a module constant.** `typeOf` reads
   `typeNames`, and a module had no place for it
   ([Constants](#constants)).
2. **A cast written as an expression copies.** `length(narrow(string, a))`
   binds an owned value, so the pass adds a `dup` and a `drop`. As a
   statement the cast lends ([Terms](#terms)).
3. **Refinement does not see through `&&`.** FAST computes
   `i < n && …` in a block and tests the result later, so the rule for a
   branch on a comparison never fires. The lowering keeps a float counter
   there, or a later pass rebuilds the condition.
4. **A float counter costs a conversion on each read.** `unit(a, i)` with
   `i` a number is `exact(u(31), i)`: a truncation, a conversion back, a
   comparison and a branch. Finding an integer counter is an optimization
   for later.
5. **A `dup` answers its argument's type.** Typed as `(any) -> any` it
   loses a refinement, and an `undefined` could not be passed where a
   string or `undefined` is wanted.
6. **L0 has a linear type.** Nothing abandons a builder
   ([Ownership](#ownership-is-two-capabilities)).
7. **A binding needs rules.** A threaded builder, a function that never
   returns, and three functions on one import each needed one
   ([Bindings](#bindings)).
8. **A transfer drops what its regions own.** Inside a label, the locals of
   the regions around it are only lent. A `br` then drops exactly what the
   regions it leaves own, after its value is computed. This answers
   ir-design.md's
   [least sure point](./ir-design.md#where-this-draft-is-least-sure) about
   a `br` that leaves several blocks.
9. **Copy variants pay.** With `undefined`, `null` and `boolean` marked as
   needing no release, every `dup` of a constant went away.
10. **A kind test and a cast test twice.** After `kind(v) === NUMBER`,
    `asNumber(v)` tests the kind again, because no fact relates `k` to
    `v`. In import form the import tests a third time. The emitter may
    leave a cast's test to an import that makes it, and the lowering may
    turn a chain of kind tests into one `match`. Both can wait.

## What changes in the other notes

Nothing is changed yet. If this note is accepted, these follow.

| Note | Change |
| --- | --- |
| [ir-design.md](./ir-design.md) | Becomes the history of the first round. Its choices 1 and 12 stand, and the rest are as type-system.md's table and this note have them |
| [type-system.md](./type-system.md) | Stays the reference for types, layout, ownership and the low level. "Prepared FAST" becomes "normalized FAST". `next` becomes a `br` to a loop. `narrow` covers sums. `exact` and `float` get their names. Ownership gets the fourth kind. Its plan is replaced by [Order of work](#order-of-work) |
| [README.md](./README.md) | "What the IR builds on" names interfaces, not tables |
| [modular-l0.md](../wasm/modular-l0.md#the-code-ir) | Its section on the IR names the five interfaces, and `str` as a type that String exports |
| [inline-fragments.md](../wasm/inline-fragments.md) | Says that a fragment and template form are two bindings of one interface |
| [WASM README](../wasm/README.md#plan) | Step 4 names the core and its order of work |

## Order of work

Each step is a PR or a short stack, proved before the next starts. Steps
1 to 6 are the core and end at step 4 of the WASM plan. Steps 7 to 10 are
the runtime language and can start beside step 2.

1. **Types and interfaces as data.** Integer ranges in one word, floats,
   products, `bool`, sealed names and code, with subtyping and interval
   arithmetic. The interfaces of L0's five modules and of L1's native rows,
   written from their designs, with a proof that every function of the L0
   view has a row.
2. **Terms and the checker.** The sixteen forms, the derived forms, the
   effect, the printer and the first golden tests.
3. **The lifetime pass**, and the check of the owned stage.
4. **The WASM emitter for import form**, and a counting host in JavaScript
   for the `fjs:l0` imports. Each emitted function is compared with its
   FunctionalScript original on the parity tables.
5. **The lowering from normalized FAST**, first for the L1 module.
6. **One small program**, on that host, and on NaNVM as a `.wasm` once it
   exists. This is the smallest proof.
7. **Layouts**: `bits`, the proofs, frames, and the derived tests
   ([nan-box-in-ir.md](./nan-box-in-ir.md) sketches it).
8. **Heap objects and references**, and the interpreter with its counting
   heap.
9. **Data lowering, Heap and the wide-integer pass.**
10. **Runtime modules in the IR**, bound in import form and then in
    template form.
11. **The Rust emitter.**

## Open questions

Each has a recommendation.

1. **Is this note the reference?** Recommended: yes, with ir-design.md as
   history and type-system.md as the reference for what the core leaves
   out.
2. **Which FAST does the lowering read?** Recommended: normalized FAST.
   This needs the view of the compiler's owner, because the lowering then
   depends on what `edag/to_fast` produces and not on `js/ast/prepare`.
3. **Interfaces before runtime modules?** Recommended: yes. The L0
   interfaces are written once from the L0 design, a host satisfies them
   first, and the runtime modules satisfy them when they exist.
4. **Is `br` the only transfer?** Recommended: yes. The eDSL can keep
   `next`, `return_` and `throw_` as spellings.
5. **Does a cast always test?** Recommended: yes at first. Where every use
   of the narrowed value is an argument of an import that tests, the
   emitter may leave the test out later. This is
   [open question 7](./type-system.md#open-questions) of type-system.md
   seen from the program's side.
6. **Is linear a fourth kind, and may an interface mark copy variants?**
   Recommended: yes to both. The first is what L0's builders are, and the
   second removes counts from typed code at no cost to the rules.
7. **A `lazy` definition.** FAST holds one for a shared allocation or
   call that only conditional regions reach
   ([`edag/to_fast`](../../../fjs/edag/to_fast/README.md)), and the L1
   module has none. Recommended: the lowering refuses it until a program
   needs it
   ([DESIGN.md §10](../../DESIGN.md#10-refuse-what-you-cannot-handle)).
   One that cannot fail may then be evaluated where it is defined.
8. **A loop counter.** Recommended: an `f64` with `exact` at first, as
   FAST has it, and an integer where a later pass proves the range.
9. **Names.** Several words mean two things across the notes
   ([TODO_DESIGN.md](./TODO_DESIGN.md#words-that-mean-two-things)).
   Recommended: the renames listed there, in one pass, once this note is
   accepted.
10. **Where the code lives.** Still open from both notes. Recommended, as
    there: `fjs/codegen/ir`, with `fjs/codegen/wasm` beside it.

## What the prototype is not

- **Not the lowering.** The seven functions are lowered by hand from the
  FAST that `definition.fast.mjs` prints.
- **Not the whole core.** It has no `call_ref`, no `match` on an integer,
  no sum of its own but `bool`, and integers of one word only. A sum is
  carried as its tag, so a sum whose variant holds a field is refused,
  even one whose variants are named `false` and `true`. Its WASM
  blocks have one result, so a product crosses a label only as a loop's
  parameters. A constant is one global, so a constant of a product is
  refused, and a literal is made from the units of a string only. The
  lifetime pass copies and releases values of sealed types only: a product
  that holds an owned value can be made, lent, moved and given back, and a
  use that would copy it, release it or read an owned field of it is
  refused.
- **Not a validator of data.** Its input is what its constructors build.
  It refuses what it cannot emit, and a name that is taken: an import
  named `self`, a function named `init`, a constant named as a literal
  is spelled, or a local named as a pass names its own. The checker names
  its locals `$1`, `$2` and so on, and the lifetime pass `t1` and `r1`
  and so on. Where such a local and the pass's own would be in scope
  together, the module is refused, because the name is bound twice, and
  no reference is captured.
- **Not a check of the owned stage.** The counting host stands in for it.
- **Not a runtime.** The host keeps every value in a JavaScript map behind
  a handle, numbers too, so that a misplaced `dup` or `drop` shows.
- **Not the eDSL.** Its constructors take positions where type-system.md's
  take object keys. The surface stays
  [type-system.md's](./type-system.md#surface-syntax).

## Running it

In this folder, with Node 22 or later:

```sh
node definition.check.mjs                   # the check, with a summary
node definition.check.mjs ir stringEquals   # a function as written, and in the owned stage
node definition.check.mjs wat stringEquals  # its WAT, from fjs/media/wasm's writer
node definition.fast.mjs stringEquals       # the normalized FAST it was lowered from
```

| File | Holds |
| --- | --- |
| [`definition.ir.mjs`](./definition.ir.mjs) | types and terms as data, interfaces, the derived forms, the checker and the printer |
| [`definition.lifetime.mjs`](./definition.lifetime.mjs) | the lifetime pass |
| [`definition.wasm.mjs`](./definition.wasm.mjs) | the WASM emitter for import form, to [`fjs/media/wasm`](../../../fjs/media/wasm/README.md)'s AST |
| [`definition.host.mjs`](./definition.host.mjs) | the counting host for `fjs:l0` |
| [`definition.samples.mjs`](./definition.samples.mjs) | the interfaces, the seven functions, the 16 mistakes, and the 9 modules that are refused besides |
| [`definition.check.mjs`](./definition.check.mjs) | the check; it ends with a summary, and exits with 1 on a difference |
| [`definition.fast.mjs`](./definition.fast.mjs) | the normalized FAST of a module, from the compiler |
