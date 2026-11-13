# Design to-do

This is a reminder list for the notes in this folder. It comes from a
review of every note on 2026-11-12, read with the FAST-to-WASM role of the
IR first, and from lowering three bodies of the L1 module by hand from the
FAST that the compiler makes. Each item says where the notes stand.
[definition.md](./definition.md) proposes an answer to most of them, and
the item says where. None of the items is decided. Remove an item when a
note takes it up.

The list for the runtime boundary is
[`../wasm/TODO_DESIGN.md`](../wasm/TODO_DESIGN.md).

## Contradictions

Two notes say different things, or one note says two.

1. **Two definitions at once.** [type-system.md](./type-system.md) is
   proposed, and [ir-design.md](./ir-design.md) is "unchanged until it is"
   decided. So each row of type-system.md's
   [table of changes](./type-system.md#what-changes-in-ir-designmd) has two
   answers today, and the notes around them use the older one: the
   [README](./README.md#what-the-ir-builds-on) and
   [modular-l0.md](../wasm/modular-l0.md#the-code-ir) speak of the `l0`,
   `l1` and `str` tables, which type-system.md turns into modules.
   Proposed: [one definition](./definition.md).
2. **Which FAST the lowering reads.** Both notes say prepared FAST:
   ir-design.md in [Where it sits](./ir-design.md#where-it-sits), choice 6
   and its steps, type-system.md in its summary,
   [Two purposes, one language](./type-system.md#two-purposes-one-language)
   and its plan, and the [README](./README.md#next). type-system.md also
   says that no local is ever reassigned, and its
   [refinement](./type-system.md#flow-refinement-is-two-rules) and its
   [lifetime pass](./type-system.md#the-lifetime-pass) depend on that.
   Prepared FAST is where mutable slots, memo storage and `while` loops
   come in ([prepare](../../../fjs/js/ast/prepare/README.md)), and
   ir-design.md's choice 6 says so: "a `slot` or a `while` slot is a
   `var_`". [comparison.md](./comparison.md) has the lowering turn
   "prepared FAST's while slots" back into loop parameters, which
   normalized FAST already has. Proposed:
   [normalized FAST](./definition.md#from-normalized-fast-to-the-ir).
3. **Who places `dup` and `drop`.** ir-design.md's
   [Where it sits](./ir-design.md#where-it-sits) lists lifetimes among the
   three things the lowering decides. Its
   [choice 9](./ir-design.md#9-lifetimes-are-one-pass-over-the-ir) makes
   them a pass over the IR, after the lowering. The
   [README](./README.md#next) repeats the first.
4. **Three rules for a literal.**
   [IR choice 3](./ir-design.md#3-a-javascript-primitive-is-its-own-constant)
   says `5n` is a bigint `any` and an integer is `i32(3)`.
   type-system.md's [Surface syntax](./type-system.md#surface-syntax) says
   the expected type picks, so `5n` is an integer unless an `any` is
   expected, and that this "keeps IR choice 3". Its
   [Heap section](./type-system.md#the-floor-state-lives-in-one-module) has
   `constant(T, value)` for a copy type only, and a constant that owns a
   reference "is built once in `init`" with no way to write one. No note
   says what a literal is in the data form. Proposed:
   [`lit` and constants](./definition.md#constants).
5. **How a loop repeats.**
   [IR choice 7](./ir-design.md#7-control-flow-mirrors-wasm-and-rust-follows-by-label-kind)
   has `br(label)` to a loop, with no value. type-system.md has
   `next({ … })`, and says that `block`, `br(label, value)` and `return_`
   "stay as in" that choice. The data form of `next` is not given, so an
   inner loop has no way to name the outer loop it repeats. Proposed:
   [`br` is the only transfer](./definition.md#terms).
6. **Whether `to_f64` can fail.** ir-design.md's table has
   `to_f64: [[any], f64, traps]`. type-system.md says reading the number
   out of an `any.only('number')` "is total and cannot trap". The second
   holds only if a program's values are refined, and nothing in the notes
   refines them ([No term for a cast](#no-term-for-a-cast)).
7. **What `push` returns.** In L0 and in ir-design.md's table,
   `push(builder, v)` returns nothing. In type-system.md a builder is a
   `uniq` object, and `push` takes it and gives it back. An import cannot
   do both. Proposed: [binding rule 3](./definition.md#bindings).
8. **Three plans.** ir-design.md's [Steps](./ir-design.md#steps) has five
   steps, type-system.md's [Plan](./type-system.md#plan) ten, and the WASM
   README's [step 4](../wasm/README.md#plan) is the goal. type-system.md's
   plan reaches the WASM emitter at step 8 and the lowering at step 9,
   after layouts, the interpreter, data lowering and Heap, none of which
   step 4 needs. Proposed: [Order of work](./definition.md#order-of-work).
9. **Who declares L0 for the checker.**
   [IR choice 4](./ir-design.md#4-every-operation-comes-from-a-table) says
   the `l0` table "is written from the L0 design". type-system.md says the
   table becomes "the runtime modules' exports", and the first of those
   modules is written at step 5 of its plan. Until then, and for a program
   that runs on a host, nothing declares L0's types and signatures. Proposed:
   [interfaces](./definition.md#modules-and-interfaces), written from the
   L0 design.
10. **Two ways to inline.** A
    [fragment](../wasm/inline-fragments.md#form) is a body taken from the
    runtime's `.wasm`. type-system.md's template form compiles a module's
    IR into the program. modular-l0.md's manifest has "one template per
    target", which type-system.md says "goes away". No note says which of
    the two the specialized program of the WASM plan's step 4 uses, where
    the runtime is NaNVM compiled from Rust. Proposed:
    [two bindings of one interface](./definition.md#bindings).

## Stale statements

Small, mechanical fixes.

1. **The number of tables.** ir-design.md's
   [Summary](./ir-design.md#summary) names four: `prim`, `l0`, `l1` and
   `self`. Its choice 4 and its steps say five, with `str`.
2. **The comparison round.** ir-design.md's introduction and its
   [last section](./ir-design.md#comparison-round) announce the round as
   next. It is done: [comparison.md](./comparison.md).
3. **Rows missing from type-system.md's table of changes.** What the `l1`
   and `self` tables become, what a call node names, `void` as `unit`,
   `unreachable` as `trap(reason)`, and `throw_`, which needs no node once
   `never` is a type.
4. **`bool` in the comparison.** [comparison.md](./comparison.md) calls
   `bool` "a sum carried in an `i32`". type-system.md now declares its one
   bit, `bits(1, …)`.
5. **Four items that wait on a proposal.** type-system.md says it answers
   four items of [`../wasm/TODO_DESIGN.md`](../wasm/TODO_DESIGN.md): the
   precondition of `unpack`, one rule for BigInt, the CPU-saving `at`, and
   the kinds that the split `length` needs. They stay listed there, which
   is right while type-system.md is proposed. A line on each could say so.

## Design gaps

Found by lowering real FAST and by running the result.

### No term for a cast

The L0 view's `asBoolean`, `asNumber`, `asString` and the others are
where a program's types come from. type-system.md has `narrow` for
integer ranges only, and
[`as`](./type-system.md#names-do-four-jobs) converts a name, not a kind.
So `asString(a)` cannot be lowered, and "the closure rule … is ordinary
typing" does not yet hold for the L1 bodies as they are written. Proposed:
[`narrow` on a sum, and its statement form](./definition.md#terms).

### No exact conversion between a float and an integer

`unit(a, i)` takes a number and traps on 1.5 as "not an index".
type-system.md's [`trunc`](./type-system.md#checks-come-in-two-forms)
truncates, and the conversion of an integer to an `f64c` has a rule but
no name. Proposed: `exact` and `float`.

### No place for a module constant

`typeOf` reads `typeNames`, an array that the module builds once. In FAST
every top-level function captures the module-level bindings it uses.
ir-design.md's module is "functions, exports and `init`". type-system.md
adds constants in its Heap section, for runtime code. Proposed:
[constants](./definition.md#constants) as a part of every module.

### Refinement stops at `&&`

FAST has no `&&`. It computes `i < n && unit(a, i) === unit(b, i)` in a
block, binds the first test, and branches on the result later. The rule
"a branch on a comparison narrows its operands" does not reach the place
where `i + 1` is computed, so an integer counter does not check. The
lowering keeps the counter a float, as FAST has it, until a pass can
prove a range
([What the check found](./definition.md#what-the-check-found), 3 and 4).

### A kind test teaches the checker nothing

`const k = kind(v)` and then `if (k === BOOLEAN) { asBoolean(v) }` is
how the L1 bodies branch. The checker keeps
"nothing that relates two locals", so `v` is still an `any` in the branch
and the cast tests again. `isPrimitive` is `kind(v) < ARRAY`, which also
uses the order of the tags. type-system.md says "`kind` is a `match`",
which is true inside Any and does not help a body written against the L0
view. Proposed: the cast tests at first, and the lowering may rebuild a
chain of kind tests as one `match` later.

### An interface and its binding are not defined

"A module can seal a type" says what a seal hides. No note says what an
importing module is checked against, or what an emitter needs besides a
signature: the import module, a type's carrier, a renamed function, an
`own` parameter that the function gives back and the import does not
return, or three functions on one import. Proposed:
[interfaces](./definition.md#modules-and-interfaces) and
[bindings](./definition.md#bindings).

### A builder cannot be abandoned

type-system.md's ownership has three kinds, and a unique value may be
dropped. L0's ABI has no function that abandons a builder. Only the
host's `recover` frees one, after a trap. So in import form a builder
must be sealed on every path. Proposed:
[a fourth kind, linear](./definition.md#ownership-is-two-capabilities).

### `dup` and `drop` have no signature

The owned stage has them as operations, and for a sealed type they are
imports. Typed as `(any) -> any`, a `dup` loses the refinement of its
argument. Proposed: operators that answer their argument's type.

### A lazy definition

FAST marks a definition `required` or `lazy`.
[`edag/to_fast`](../../../fjs/edag/to_fast/README.md) makes a lazy one
for a shared allocation or call that only conditional regions reach, and
preparation gives it memo storage. The L1 module has none. The IR has no
mutable local to hold one. Proposed: refuse it for now. A definition that
cannot fail could be evaluated where it is defined, which
[the one effect](./definition.md#one-effect) allows.

## Words that mean two things

| Word | Its meanings | Proposed |
| --- | --- | --- |
| frame | a function's captures ([L0 design §12](../wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)); Any's own layout of the box ([Layouts compose](./type-system.md#layouts-compose)); a stack frame ([modular-runtime.md](../wasm/modular-runtime.md#stack-frame-offsets-are-a-compile-time-notion)) | keep it for captures, the ABI's name; call Any's layout its *outline* |
| slot | a mutable local of prepared FAST; the locals of an unpacked value; a variant of Any's layout whose one field is a hole; the `thrown` slot. The last three are all in type-system.md | keep it for the locals of an unpacked value; call the variant a *hole* |
| kind | L0's nine kinds; the ownership of a type, in "Three kinds of type" and in "checked: types, layouts, matches, kinds" | *ownership* for the second |
| view | the L0 view, a FunctionalScript module ([L0 design §17](../wasm/l0-design.md#17-a-functionalscript-view-of-l0)); `view(O)`, a borrowed reference | keep the first; `lent(O)` for the reference |
| form | plain, owned and low, which are also called stages and levels; import form and template form; the data form; the two forms of a check | *stage* for the first; *binding* where import and template form are chosen |
| module | four meanings in [`../wasm/TODO_DESIGN.md`](../wasm/TODO_DESIGN.md#structure-of-the-folder), and an IR module is a fifth | as that list proposes, another word for a part with a manifest |
| `at`, `unit` | L0 and its view say `unit(s, i)`; the String module and type-system.md say `at` | `String.at`, bound to the ABI name `unit`, said once |
| `as` | type-system.md's `as(T, e)` converts a name; the view's `asNumber` narrows a kind | keep `as` for names, and `narrow` for kinds |

Choice numbers collide across the notes too, which
[`../wasm/TODO_DESIGN.md`](../wasm/TODO_DESIGN.md#structure-of-the-folder)
already lists.

## Structure of the folder

- **One definition, and notes that explain it.** If
  [definition.md](./definition.md) is accepted, ir-design.md is the
  history of the first round, type-system.md the reference for types,
  layout, ownership and the low level, and comparison.md the reasons.
  [What changes in the other notes](./definition.md#what-changes-in-the-other-notes)
  lists the edits.
- **A status line on every note.** As in the WASM folder's list: a fixed
  first line, such as *Status: proposed*, so that a reader knows which of
  two notes holds.
