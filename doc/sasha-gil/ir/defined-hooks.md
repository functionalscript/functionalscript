# Counting a type that the module defines: hooks over the carrier's bits

2026-11-24. **Decided:** choice C (Sasha, 2026-11-24). **Built:** 4d-1
(#4108, #4109). This note gives
the scheme in full, as it will be built in checkpoint 4d of
[runtime-in-ir.md](./runtime-in-ir.md#checkpoints). It builds on 4c
(#4104), where a module names the sealed types it implements with
`defines`, and `seal` and `unseal` convert between such a type and its
carrier's bits, only in that module.

## The problem

A counted sealed type names a `dup`, which copies a value, and a `drop`,
which gives one up. The [lifetime pass](../../../fjs/ir/lifetime/module.f.js)
writes the calls: a `dup` where a borrowed value must become owned, and a
`drop` where an owned value leaves scope unused. For an imported type,
such as L0's `any`, both are functions of the interface, and the pass
writes `Any.dup(v)` and `Any.drop(x)`.

Once the module that implements `any` is written in the IR, its own
`dup` and `drop` are functions of that module. Written over the type
itself, they do not work:

```text
fn drop(own v: any) -> unit =
    ...                 // the pass sees v owned and unused at the end
    self.drop(v)        // so it writes a drop of v: drop calls itself
```

`drop` can never get rid of the `v` that it owns, since the pass is
what gets rid of owned values, and the pass does that by calling
`drop`. `dup` has the same problem with any temporary `any` in its
body. So 4c refuses a `dup` and a `drop` on a defined type for now.

## The scheme in one paragraph

A defined type's `dup` and `drop` are plain functions of the module over
the type's **carrier bits**: `dup(b: u(64)) -> u(64)` and
`drop(b: u(64)) -> unit` for an `i64` carrier. They never hold a value
of the type, so the pass never writes a hook inside a hook. In the
defining module, the pass wraps each hook call it writes: a copy is
`seal(T, self.dup(unseal(e)))`, and a drop is `self.drop(release(x))`,
where `release` is a new term that consumes an owned value and gives its
bits. To every other module the type looks like any imported counted
type: its interface's `dup` is `(v: T) -> T` and its `drop` is
`(own v: T) -> unit`, which at the WASM level are the same functions,
since a value and its bits are one `i64`.

## Terms

The defining module has three terms between a type it defines and that
type's carrier bits. All three are refused in any other module, with
4c's message, "only the module that defines T sees its carrier".

| Term | Operand | Result | Ownership | WASM |
| --- | --- | --- | --- | --- |
| `unseal(v)` | a value of `T` | its bits, `u(64)` or `u(32)` | borrows `v` | nothing |
| `release(x)` | an owned value of `T` | its bits | **takes `x` over** | nothing |
| `seal(T, b)` | bits within the carrier | a value of `T` | the context owns the value | nothing |

- `unseal` and `seal` are as 4c (#4104) has them. Since 4c's last
  review, a value that `seal` makes is owned, as a call's result is, so
  it is taken at most once and must be taken.
- `release` is new in 4d. It is `unseal` that also ends the value's
  ownership, as passing it to an `own` parameter does. The owned check
  refuses it on a borrowed value ("release's operand is borrowed") and
  on a value used later ("x is used after it was consumed"). The pass
  writes it in each drop, and only the pass writes it: a `release` that
  the module writes is refused ("only the lifetime pass releases a T").
- **Bits carry no ownership**, since `u(64)` is copy. So the module may
  not turn bits back into a counted value by itself: a `seal(t, b)` that
  it writes is refused unless `t` is narrowed to copy variants ("only
  the lifetime pass seals a counted T: seal t's copy variants, or let
  the pass copy"). Otherwise `seal(T, unseal(v))` of a borrowed `v`
  would make a second owner of one NaNVM handle without a `dup_ref`,
  and a `release(x)` whose bits were dropped on the floor would leak
  `x`'s handle, and the owned check would see neither. With these two
  rules and rule 4 below, every place where bits become an owner or
  stop being one is written by the pass, in the two forms of
  [the table below](#what-the-lifetime-pass-writes), or is in a hook.
  Any's 4d-2 functions (`from_f64`, `from_bool`, the constants) seal
  only copy variants. H3b widens the rule with two forms of a `seal` of
  a counted type that the module defines. One is a new owner,
  `seal(t, f(…))` or `seal(t, or(c, f(…)))` with `c` a literal that
  sets no bit of the 8-aligned address, where `f`'s signature says
  `counts: 'new'`, as the Heap's `alloc` does: its bits are a value that
  no one owns yet, a call of it anywhere else is refused, and the owned
  check follows the sealed value from there. The other is bits that hold
  no address: literals and integers of 16 bits at most joined by `or`
  and `shl`, as a short string's box is made of its units (the owner's
  choice, 2026-11-28). The checker sees an integer's range, not where it
  came from, so it trusts the module that each one is a code unit or a
  tag and not a piece of an address, which a 16-bit piece of an
  `unseal`'s bits may be: `firstUnit` takes one from a short box, and
  the same pieces of a long string's box would make a second owner,
  whose `drop` the debug arena traps. That hole is not kept: a dedicated
  IR spelling so code units cannot reconstitute an address is tracked in
  [`fjs/ir/todo/addressless-code-units.md`](../../../fjs/ir/todo/addressless-code-units.md)
  (after H3 measure).
- All three emit no instruction: the value and its bits are one WASM
  value. So the wrapping in the pass costs nothing at run time.

## The hooks

A defined type `T` with carrier `c` (`i64` or `i32`, bits `B` = `u(64)`
or `u(32)`) may name, as an interface's type does:

- **`dup`**: a function of the module of signature `(b: B) -> B`, its
  parameter borrowed. It answers the bits of a new owner of the same
  value. They may differ from `b`: NaNVM's `dup_ref` gives the copy a
  handle of its own (it is `put(get(v))` in
  [abi.rs](../../../nanvm/lib/src/l0/abi.rs)). So the result must be
  used, and two owners of one value compare equal by `same`, not by
  their bits.
- **`drop`**: a function of the module of signature `(b: B) -> unit`.
  The bits it gets are no longer a value of `T` (`release` ended that),
  so the pass writes nothing more for them.
- **`kind`**: as 4c has it, a function of the module of signature
  `(v: T) -> int(0, n - 1)`, borrowing `v`. Borrowing writes no hook, so
  `kind` needs no change (but see the open questions).
- **`copy`**: as for an interface, the variants whose values need no
  count. The pass writes no hook for a value whose type is narrowed to
  copy variants.

The checker refuses, each with the type's name:

1. a `dup` or a `drop` alone, as it does for an interface: "T names a
   dup and no drop, and a counted type names both";
2. a hook that names no function of the module, or one whose signature
   is not the one above: "T's dup is (b: u(64)) -> u(64), over its
   carrier's bits", "T's drop is (b: u(64)) -> unit, over its carrier's
   bits";
3. a `dup` or a `drop` that may fail, by the effect the checker infers:
   "T's drop may fail, and the drops that the lifetime pass writes
   cannot". The pass writes hooks after the effects are inferred, on
   paths that a throw or an early `br` takes too, so a failing hook would
   be a failure that no function declares. NaNVM's `dup_ref` and
   `drop_ref` trap only on a dropped or forged box, which is a misuse,
   as L0's `dup` and `drop` do today, so their imports declare no
   failure, as L0's do;
4. a call to `T`'s `dup` or `drop`, or to `Ref.dup_ref` or
   `Ref.drop_ref`, that the module writes itself, outside the two
   hooks: "only the lifetime pass calls T's dup and drop", and "Ref's
   dup_ref and drop_ref are called only in T's dup and drop". Their
   bits are a `u(64)`, which is copy, so the owned check can't see a
   discarded `dup_ref` result (a leaked handle) or a second `drop_ref`
   of the same bits (a "not a value" trap). Keeping the calls inside
   the hooks and the pass's own wrapping leaves two places to check:
   the pass, whose wrapping is the table below, and the hooks
   themselves;
5. in `dup`, a `Ref.dup_ref` result that is not the hook's result on
   its path, and in `drop`, more than one `Ref.drop_ref` on one path:
   "T's dup must answer dup_ref's result", "T's drop calls drop_ref at
   most once on each path".

The checker can't see more than that inside the hooks, since it can't
tell a reference's bits from others: a `dup` that answers `b` on a
reference's path, or a `drop` that skips `drop_ref` for one, passes
every rule. The two hooks are the module's trusted base, a few lines
each, and the NaNVM host's leak check (below) is their proof.

Built in 4d-1 (#4108, #4109), the rules take these shapes:

- Only the pass writes `release`, a call of a hook and a `seal` of a
  variant that is not copy. The checker refuses them in the plain stage,
  and takes them in the owned stage only in the pass's two forms. No
  code value names a hook either, so `call_ref` cannot reach one.
- Each hook counts one type: two types that name one function, or a
  type whose `dup` and `drop` are one, are refused, so that a call of a
  hook names the type whose value it counts.
- Rule 4's `Ref` functions are any of an interface's whose signature
  says `counts: 'dup'` or `'drop'`, as `dup_ref` and `drop_ref` do. An
  interface that marks a function so is refused unless the signature
  fits the marker: one borrowed word of bits, `u(64)` or `u(32)`,
  `dup` answering bits of that word and `drop` answering `unit`, and
  neither may fail, so that a hook cannot hand one reference to it
  twice in one call. Every interface function that is the same import
  (the same ABI and name) carries the same marker, and the marker that
  L0's `Ref` gives it, whether or not the module imports `Ref`: so an
  unmarked alias of `dup_ref`, beside `Ref` or alone, cannot call it
  outside a hook. Such a function also has `Ref`'s signature, which is
  how NaNVM's host exports it, so a `u(32)` alias of `dup_ref` is
  refused rather than failing when the module links. Rule 5 is that such a call is the hook's last term: the body's, a
  `let`'s body's or a `match` arm's.

4c's refusal of a `dup` or a `drop` on a defined type goes. A hook may
call other functions, and those may hold values of `T`: that is
ordinary recursion, whose end is the module's to prove, as for any
function. Any's hooks call only NaNVM.

## What the lifetime pass writes

The pass decides where to copy and drop exactly as it does today; only
the term that it writes for a defined type changes. With `own` the name
that the module defines and `t` a sealed type whose interface is `own`:

| | an imported type | a type that the module defines |
| --- | --- | --- |
| copy of a borrowed `e` | `Any.dup(e)` | `seal(t, self.dup(unseal(e)))` |
| drop of an owned `x` | `Any.drop(x)` | `self.drop(release(x))` |

- `t` in the copy is the type of `e`, refined as it is: `dup` keeps the
  variant, as an interface's `dup` does today ("a dup answers the type
  of its argument, so a refined value stays refined"). For a defined
  type this is the module's promise, since `seal` can make any variant
  from bits.
- The pass's output is checked again (the lifetime proofs check every
  module that they write), so a wrapping that broke ownership would be
  refused there.
- In the printer, which writes a call of the module's own function
  without `self.`, a drop of `s` in Any's own module reads
  `let $3 = drop(release(s))` where an importer's reads
  `let $3 = Any.drop(s)`.

The WASM of a drop of local `x` in the defining module is one call:

```wasm
local.get $x
call $drop
```

which is what an importer emits for `Any.drop(x)`, with `$drop` its
import. The difference is that the defining module's `$drop` is a
function of its own, which an engine can inline, and which choice 5 of
runtime-in-ir.md inlines once Any is linked into the program.

## Any's hooks, written out

With the box of [Sergey's README](../../sergey-shandar/nanvm/README.md),
a value needs a count only when it is a reference
(`0x7FF0…0002 | kind << 48 | handle << 2`), and NaNVM keeps that count.
`Ref` is a new L0 interface of 4b's exports, over bits. Those exports
are on main since #4100 (`kind_ref`, `dup_ref`, `drop_ref` and
`same_ref` in `nanvm/lib/src/l0/abi.rs`, exported by
`nanvm/l0-wasm/src/lib.rs`); this note's branch is stacked on 4c
(#4104), which was cut before #4100 merged, so they show here only once
it is rebased on main. 4d-1 needs no new NaNVM work, only the IR side:

```text
import Ref from fjs:l0
    fn kind_ref(b: u(64)) -> int(0, 8)
    fn dup_ref(b: u(64)) -> u(64)
    fn drop_ref(b: u(64)) -> unit
    fn same_ref(a: u(64), b: u(64)) -> bool
```

Any's module then defines `any` and writes its hooks:

```text
define Any
    type any = undefined | null | boolean | number | string | bigint | array | object | function
        kind: kind, carrier: i64, dup: dup, drop: drop, copy: undefined | null | boolean | number

fn isRef(b: u(64)) -> bool =
    eq(and(b, 0xFFF0_0000_0000_0003), 0x7FF0_0000_0000_0002)

fn dup(b: u(64)) -> u(64) =
    if isRef(b)
    then
        Ref.dup_ref(b)
    else
        b

fn drop(b: u(64)) -> unit =
    if isRef(b)
    then
        Ref.drop_ref(b)
    else
        {}
```

(This is the printer's form; `{}` is the `unit` value.)

- **`number` joins `copy`.** Since #4096 a number is its own `f64`
  bits and takes no NaNVM slot, so a value narrowed to `number` needs no
  count at all: the pass writes no `dup` and no `drop` for it. L0's `any`
  can't say that today, because its `copy` was written while a number
  still took a slot. This is the main saving for collatz, where most
  values are numbers.
- For a value that may be a reference, a hook costs one `and`, one
  compare and a branch, and calls NaNVM only for a reference.
- `kind` `unseal`s its borrowed `any` and dispatches on the box's tag
  exactly as runtime-in-ir.md's
  [kind table](./runtime-in-ir.md#6-the-tests-are-the-frames) does: a
  number (`is_number`) is 3, `Ref.kind_ref(b)` answers for a reference,
  and the scalar tags give boolean, undefined and null. Short bigints
  (`x & 1 == 1`) and short strings (`x & 0xC != 0`) keep their own
  branches, 5 and 4, so a later slice that makes them needs no change to
  `kind`; until then no box takes those branches.
- Short strings and short bigints take no NaNVM slot either. When a
  later slice makes them, `isRef` is still false for them, so `dup` and
  `drop` pass their bits through unchanged.

## What other modules see

An importer of Any sees an interface, as it sees L0's `Any` today: `any`
with `dup: dup` and `drop: drop`, `dup` as `(v: any) -> any`, and `drop`
as `(own v: any) -> unit`. At the WASM level these are the same
functions as Any's hooks: an `any` is an `i64`, as its bits are. So:

- the defining module's exports `dup` (`(i64) -> i64`) and `drop`
  (`(i64) -> ()`) have the types of NaNVM's `fjs:l0` `dup` and `drop`,
  and the module can stand in for them;
- 4d writes Any's interface for importers by hand, as `l0` writes it
  today, and a proof checks that each of its functions and the defining
  module's export of that name have one WASM type;
- in 4e, linking Any into a program turns the program's `Any.dup(e)`
  and `Any.drop(x)` into the defining module's form above, since the
  program then defines `any` itself.

## Proofs

- **Checker:** one refusal for each rule above (for rules 4 and 5: a
  discarded `self.dup(b)`, a `Ref.dup_ref` in an ordinary function, a
  `dup` that answers `b` after calling `dup_ref`, a `drop` that calls
  `drop_ref` twice), and the hooks of a small
  defined type (as `tagging` is in 4c) accepted.
- **Lifetime:** printed goldens of a defining module, showing
  `seal(t, self.dup(unseal(e)))` and `self.drop(release(x))` on each
  path the pass already covers for imports: a borrowed argument to an
  `own` parameter, a value left over, a `match` arm, a `br`, a throw.
- **Owned:** `release` of a borrowed value, `release` twice, and a value
  used after `release`, each refused in the pass's output; a `release`
  that the module writes, and a `seal(T, unseal(v))` of a counted `T`
  that it writes, each refused, while `seal` of a copy variant is
  accepted.
- **NaNVM host:** Any's hooks and a module that copies and drops
  references run on NaNVM's `.wasm`. The test runner already checks
  after each call that NaNVM holds no live slot (`h.live()` is empty),
  so a missing `drop_ref` shows as a leak and a doubled one as a
  "not a value" trap. They also run on the counting host once it speaks
  boxes (4e-1).

## Steps

1. **4d-1: hooks over bits.** `release`, the hook rules, the pass's
   wrapping and its proofs, and the `Ref` interface, which the NaNVM
   host passes through from NaNVM's exports. A small defined type over
   NaNVM references, whose hooks call `Ref`, runs on NaNVM.
2. **4d-2: Any in the IR.** `fjs/ir/runtime/any` with `Ref`, `isRef`,
   `kind`, `dup`, `drop`, then `to_f64`, `from_f64`, `to_bool`,
   `from_bool`, `same` and the constants, proved against the L0 view on
   NaNVM. **Built.**
3. **4e:** link it into programs, move the counting host to boxes, and
   measure the demos, as runtime-in-ir.md plans. **Built** as #4114
   (boxes), #4115 (`linkAny`), #4116 (remeasure).

## Open questions

1. **Should `kind` take bits too?** It works on a borrowed `T` today,
   and borrowing writes no hook. Taking bits would make every hook one
   shape, `B -> …`, and match would call `self.kind(unseal(e))`. It
   doesn't change what runs.
2. **Is a hook's effect inferred or declared?** Rule 3 refuses a hook
   that the checker infers may fail. The other way is for the `define`
   block to declare it, as an interface's signature does, and for the
   checker to check the body against that.
3. **Must a `dup` keep the variant?** The pass relies on it to keep a
   refined type refined (`seal(t, …)` with `t` the operand's type). A
   proof can test it on the host, and the checker can't, since the hook
   works on bits.
