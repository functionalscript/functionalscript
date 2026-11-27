# Long strings in the IR heap

2026-11-27. Decided: the owner chose option A on each of the six choices
below on 2026-11-27. This note is step H3 of
[heap.md](./heap.md#order-of-work), and it answers that note's open
questions 1 and 2.

## Summary

H3 puts the long strings that the IR makes into the IR heap, and NaNVM
never holds a reference into it: an IR string that crosses into NaNVM is
copied there. That answers [heap.md's open question
2](./heap.md#open-questions) without rooting or waiting, needs no Rust
change, and moves the root table to H4, where the recount first needs it.
It departs from the order of work that heap.md first had, in which NaNVM's
arrays and objects held IR references from H3 on: option C of choice 1.
heap.md now follows this note.

| # | Choice | Chosen | Why |
| --- | --- | --- | --- |
| 1 | Whether NaNVM holds references into the IR heap | A: no; the IR copies an IR string as it crosses | no Rust change, no counting across modules, nothing that a recount could miss |
| 2 | Which long strings live in the IR heap | A: the results of the IR's own `concat` and `substring` | NaNVM's strings stay where they are until containers move |
| 3 | The box of a reference into the IR heap | A: a kind nibble of its own, 9 for a string | NaNVM's handles and heap.md's 16-bit tags keep every bit they have |
| 4 | A long string's block | A: a length word, then the units | 4 bytes before the units; the type byte leaves room for other forms |
| 5 | Literals and the host | A: both stay NaNVM's in H3, and the root table comes with H4 | neither holds an IR object before then |
| 6 | How a build asks for debug | A: one `debug` flag | as heap.md's open question 1 proposes |

The trade to measure: choice 1 adds a copy each time a long IR string
crosses into NaNVM, as when it enters a container, reaches the host or is
thrown, and saves the L0 calls of `concat`, `substring`, `length` and
`unit` on every long string that stays in the IR. Step H3d measures both
before the heap links by default.

## Where things stand

Today every string that no short box holds lives in NaNVM, and the heap
from H2 has no client yet.

- **Short strings are in the IR.** A string that fits one of Sergey's tags
  is its own box, and String's B variant reads its length and units with
  bit operations ([short-strings.md](./short-strings.md)). NaNVM decodes
  such a box into a string of its own whenever it takes one, in `unbox`
  ([abi.rs](../../../nanvm/lib/src/l0/abi.rs)).
- **Long strings are NaNVM's.** Every other string is a reference,
  `0x7FF0_0000_0000_0002 | kind << 48 | handle << 2`, whose 46-bit handle
  is 32 bits of index and, above them, 14 of generation. `length` and
  `unit` on one are L0 imports, and so are `concat` and `substring` of any
  strings.
- **Containers and functions are NaNVM's**, and NaNVM's `item`, `key`,
  `join` and `text` answer NaNVM strings, as do L1's natives
  `numberToString` and `bigintToString`.
- **Any's hooks count through `Ref`.** `dup` and `drop` test `isRef`, a
  mask and a compare, and call `Ref.dup_ref` or `Ref.drop_ref` on a
  reference ([any/module.f.js](../../../fjs/ir/runtime/any/module.f.js)).
- **The heap has two arenas and no client**: `module` for release and
  `counted` for debug, behind one interface, in `fjs/ir/runtime/heap` (H2c
  and H2d, #4151 and #4155).
- **A value crosses into NaNVM in three places**: as the argument of an L0
  function or an L1 native that takes an `any` or a string, such as `push`,
  `push_property`, `find`, `join`, `make_function`, `throw` or
  `stringToNumber`; as the result of the program's code that NaNVM calls
  through a code index; and as `init`'s result, which the host reads
  through NaNVM.

## 1. Whether NaNVM holds references into the IR heap

Chosen: A, NaNVM holds none. Where a long IR string crosses into NaNVM, the
IR copies it into a NaNVM string first, as NaNVM already decodes a short
box into a string of its own.

| Option | Where an IR string crosses | For | Against |
| --- | --- | --- | --- |
| A. The IR copies it (chosen) | a link step wraps each crossing: a long IR string becomes a NaNVM string through NaNVM's `make_string` over its units, and the IR drops its own reference | no Rust change; NaNVM and both hosts never see an IR box; no counting across modules, so no recount can miss a reference | a copy for each long string that crosses, and a test of the box at each crossing |
| B. NaNVM copies it | NaNVM's `unbox` reads the string's block from the memory, as it decodes a short box, and a function that owns its argument drops the IR reference through the heap's exports in the loader's table | the decoding is one place in Rust | Rust learns the block's layout and the heap's exports, and the debug drop is an indirect call |
| C. NaNVM keeps the reference | NaNVM stores the box; in debug it counts it through the heap's `dup` and `drop` in the loader's table, and releases it on its own drop | no copy | a new kind of value in NaNVM; the recount must root NaNVM's references or wait; all of it is Rust that step 5 removes again |

- **What A copies.** Only long strings, and only where they cross. A
  borrowed argument, such as `find`'s key, crosses as a NaNVM string that
  the IR drops after the call. An owned one, such as `push`'s value,
  crosses as an owned NaNVM string, and the IR drops its own reference. A
  call through L0's `call` crosses too: a long IR string among the
  arguments is copied as it is pushed into their array, and one that the
  callee answers is copied as its result.
- **What A saves.** Inside the IR a long string costs no import: `concat`,
  `substring`, `length` and `unit` run in the IR, and a block costs a bump
  of the pointer. A `repeat` loop that grows one string crosses once, when
  its result reaches the host.
- **Why not C now.** C is what heap.md's order of work planned for H3, and
  the Rust that it needs goes again at step 5, when containers move to the
  IR heap. If H3d finds the copies costly, C is the fallback for containers
  that hold long strings.

## 2. Which long strings live in the IR heap

Chosen: A, the results of the IR's own `concat` and `substring` that no
short box holds. NaNVM's strings stay NaNVM's, so String's functions meet
three forms: a short box, an IR string and a NaNVM string.

| Option | What lives in the IR heap | For | Against |
| --- | --- | --- | --- |
| A. The IR's results (chosen) | what `concat` and `substring` make, where no short box holds it | NaNVM is untouched, and a string made in the IR stays there | three forms, so each String function tests which it has |
| B. A, and every NaNVM string that the IR reads | the IR copies a NaNVM string into its heap as `item`, `key` or `join` answers it | two forms inside the IR | a copy for each long string read out of a container, even one only passed on, and `read_units` on the counting host |
| C. Every long string | NaNVM allocates its strings in the IR heap, through the heap's exports in the loader's table | one form everywhere | NaNVM's strings move before its containers do: a large Rust change, to code that step 5 retires |

- **`length` and `unit` under A** decode a short box, read an IR string's
  block, and import L0's for a NaNVM string, as the B variant's long miss
  does today.
- **`concat` of mixed forms.** Where both are short or IR strings, the IR
  copies their units into a new block, or into a short box where one fits.
  Where one is NaNVM's, the IR copies an IR string among them into a NaNVM
  string, as at a crossing, and calls L0's `concat`, so the result is
  NaNVM's; a short box needs no copy, since NaNVM takes short boxes.
  Copying NaNVM's units into an IR block instead needs `read_units` on the
  counting host, which only NaNVM has today.
- **`substring`** of an IR string makes an IR string or a short box, and of
  a NaNVM string calls L0's. **`from_unit`** stays L0's, since one unit
  never needs a block.

## 3. The box of a reference into the IR heap

Chosen: A, a kind nibble of its own for each IR kind, 9 for a string. An IR
string's box is then `0x7FF9_0000_0000_0002 | p`, where `p`, the block's
address, is 8-aligned and leaves the reference tag's two bits clear.

| Option | Bits | For | Against |
| --- | --- | --- | --- |
| A. A kind nibble of its own (chosen) | `tttt` from 9 up: 9 a string, and later 10 a bigint, 11 an array, 12 an object and 13 a function; the address in bits 3 to 31 | NaNVM's handles keep their 46 bits; heap.md's 16-bit tag fits in bits 32 to 47; one compare tells both the heap and the kind | `kind` maps 9 to 13 back to L0's 4 to 8: one test and a subtraction |
| B. The top bit of the payload | bit 47 set for the IR heap, and L0's kind in `tttt` | `kind` reads `tttt` as it does now | NaNVM's handles lose a bit of generation, 13 instead of 14, which is a Rust change, and the IR's tag loses a bit or the address a shift |
| C. The sign bit | `s` set, which the [NaN-box patterns](./nan-box-patterns.md) call `lit`: a reference that nothing counts | in release Any's hooks pass it by with no code, since `isRef` is false for it | the debug arena counts, so a debug build's hooks need a test of their own for it, and `lit` is meant for compile-time data |

- **Any's hooks under A.** `isRef` stays a mask and a compare. The hooks
  then compare `tttt` with 9: an IR reference goes to the Heap's `dup` and
  `drop`, and at a count of 0 to its `free`, and any other reference to
  `Ref`, as today. In release the arena's `dup` does nothing and its `drop`
  answers `false`, so with inline hints on both, an IR reference costs the
  hooks the compare and an `if` on `false`.
- **`kind`** answers 4 for nibble 9. A debug build's checked Any can also
  ask the debug arena whether the block's count is above 0, as `kind_ref`
  checks a handle: one more debug export, which H3a adds.
- **`same`** takes only arrays, objects and functions, so it meets no IR
  string in H3.

## 4. A long string's block

Chosen: A, a 32-bit length and then the UTF-16 units. The type that `alloc`
takes, `t`, is `0x40`: L0's kind 4 in the high nibble and form 0 in the
low, so `release` and the recount find the form from the header.

| Option | The block | For | Against |
| --- | --- | --- | --- |
| A. A length, then the units (chosen) | a `u32` length, then that many `u16` units: `n = 4 + 2 * length` | the fewest bytes before the units, and `make_string(p + 4, length)` copies it into NaNVM as it stands | a hash for object keys, later, needs a word of its own or a form of its own |
| B. A length and a hash, then the units | a length, a 32-bit hash written once, then the units: `n = 8 + 2 * length` | a lookup by key in an IR object compares hashes first | 4 more bytes per string, for objects that the IR does not have yet |
| C. Two forms, 8-bit units where they fit | form 0 for 16-bit units and form 1 for 8-bit | Latin-1 text takes half the memory, as V8's one-byte strings do | each reader of units tests the form, and NaNVM's `make_string` takes 16-bit units, so form 1 crosses by a widening copy |

- **The length** is at most `2^31 - 1`, L0's `u(31)` index. Near that, `n`
  passes the arena's `0xFFFF_FFF8`, so `concat` checks the sum first and
  traps as out of memory, which no 4 GiB memory could hold anyway.
- **More forms later.** The low nibble of `t` names the form, so a slice of
  another string, a rope or C's 8-bit form can come later behind the same
  String functions.
- **C as an experiment of its own.** C's 8-bit form deserves a String
  variant of its own in the IR, as the line heap is a Heap variant of its
  own: one that writes form 1 wherever every unit fits a byte, linked in
  place of A's for the experiment and measured against it, on memory and on
  speed, with the widening copy at each crossing counted
  ([one-byte-strings.md](../../../fjs/ir/todo/one-byte-strings.md)).

## 5. Literals and the host

Chosen: A, both stay NaNVM's in H3, and the root table comes with H4. Under
choice 1 the host never holds an IR reference, since `init`'s result
crosses by a copy. A constant still can, such as a long string that `init`
concatenates, but only H4's recount needs to find it there.

| Option | Literals | The host | For | Against |
| --- | --- | --- | --- | --- |
| A. NaNVM's in H3 (chosen) | a long literal stays a NaNVM string, made once by the start function through `make_string`, as today | reads only NaNVM values | nothing for H3 to root, and the root table arrives with the recount that reads it | `concat` of a long literal and an IR string takes choice 2's mixed path |
| B. Literals in the IR heap | the start function builds each long literal in the IR heap and roots it once | as A | every long string that the program names is in the IR | `root` and `unroot` come before anything reads the table; and under choice 1 A, a long literal is copied into NaNVM each time it crosses, where A's crosses as it is |
| C. The root table now, for the host too | as B | an IR reference crosses to the host as an entry of the root table, its handle | the host reads an IR string without a copy | both hosts learn IR handles, which choice 1 A avoids |

- **Most literals are short.** A literal that fits a short box is its own
  box, so A's mixed path is for long literals only.
- **What moves to H4.** heap.md has the root table come with H3, since a
  long string would be the first IR object that a constant or the host
  holds. Under A the host holds none, and a constant's string matters only
  to the recount, so the table moves to H4, beside it. Until then a
  constant's block stays live, so H3's balance checks compare `live()` with
  what `init` left, as the counting host's `keep` does for NaNVM's cells.

## 6. How a build asks for debug, and a caught throw

Chosen: A, one `debug` flag that links every debug variant, Any's `checked`
and the Heap's `counted`, as heap.md's open question 1 proposes.

| Option | What a runtime says | For | Against |
| --- | --- | --- | --- |
| A. One `debug` flag (chosen) | `debug: true` links `checked` and `counted` | one switch, and a debug run checks all that has a check | a proof that wants one check alone has no switch for it |
| B. A flag for each variant | `checkedKind`, as today, and `countedHeap` beside it | each check on its own | each new debug variant adds a flag, and their mixes need runs of their own |

- **`checkedKind` stays** under A as the name of its Any part, so the
  programs and proofs that set it keep working, and `debug` sets it.
- **A caught throw needs nothing in H3.** Under choice 1 NaNVM holds no IR
  reference, and a thrown value crosses by a copy, so NaNVM's `recover`
  never reaches the IR heap. The release arena frees nothing anyway. In
  debug, the references of abandoned frames leave counts too high, so the
  balance check holds for proofs that catch no throw, as heap.md says,
  until H4's recount runs there too.

## What ends with NaNVM

The split between IR strings and NaNVM strings is temporary. The goal is a
runtime written in the IR with no NaNVM, and the split ends at heap.md's
step 5, when containers move into the IR heap. Choices 1, 2 and 5 serve
only that interval: the copy at each crossing, the three forms of a string
and the literals that stay NaNVM's all go with NaNVM. So does the reason
for choice 3's nibbles from 9 up: once no NaNVM reference is left, IR
references can take L0's own 4 to 8, and `kind`'s mapping goes too. Choice
4's block and choice 6's flag stay. NaNVM learns nothing of the IR heap for
the same reason: anything it learned would be Rust that step 5 removes
again.

## Steps

With A on every choice, H3 is five stacked PRs, each with its proofs green,
and nothing links by default before H3d's numbers.

1. **H3a, IR references in Any.** `kind` maps nibble 9 to 4, and the hooks
   send an IR reference to the Heap's `dup`, `drop` and `free`, so Any
   imports the Heap interface. The debug arena gains its liveness check for
   the checked Any. Proofs: the hooks' WAT on both arenas, and NaNVM
   references counted as before.
2. **H3b, long strings in the IR.** String's IR path for `concat`,
   `substring`, `length` and `unit` over flat blocks, with a short box
   where one fits and choice 2's mixed path. Proofs: a FunctionalScript
   model of strings against the IR on the host, on both arenas, with
   `live()` back where `init` left it after each debug proof.
3. **H3c, the crossing.** A link step wraps each L0 function and L1 native
   that takes an `any` or a string, the result of each function with a code
   index, and `init`'s result: a long IR string becomes a NaNVM string
   through `make_string`, and the IR drops its reference. `make_string`,
   which only the emitter calls today, for literals, becomes an import that
   the crossing calls at the low level, where an address is a value.
   Proofs: NaNVM and the counting host both refuse an IR box, so every
   program proof shows that none crosses.
4. **H3d, link and measure.** `linkHeap` after `linkAny` and `linkString`,
   with the release arena by default and `counted` under `debug`. Every
   program proof runs on both hosts, and `repeat`, `shortOps` and a
   benchmark of containers of long strings are measured against today's
   long path.
5. **H3e, the notes.** benchmark.md's new rows, and what H3d's numbers
   change in this note and in heap.md, whose order of work and open
   questions 1 and 2 already follow this note.

## Open questions

- **Where the crossing is wrapped.** A link step over the L0 imports, as
  `linkString` merges String's bodies, or the lowering from FAST, which
  knows each call's arguments. The link step is the proposal.
- **`read_units` on the counting host.** With it, choice 2's mixed `concat`
  could copy NaNVM's units into an IR block, so its result stays in the IR.
  It is a small addition to the host.
- **The root table's layout**, with handles and generations as NaNVM's
  slots have, is H4's, beside the recount.
- **No benchmark holds containers of long strings yet.** H3d adds one, to
  price choice 1's copies.

## Sources

- [heap.md](./heap.md), the design in #4146: the interface, the root table,
  a caught throw, the order of work and open questions 1 to 3
- [short-strings.md](./short-strings.md): String's variants and the B
  variant's long miss
- [nan-box-patterns.md](./nan-box-patterns.md): the reference patterns and
  the `s` bit
- [abi.rs](../../../nanvm/lib/src/l0/abi.rs): NaNVM's box, handles and
  `unbox`
- [l0/module.f.js](../../../fjs/ir/l0/module.f.js): L0's String and
  Containers functions and what each owns, and why `make_string` is no
  function of String's;
  [native/module.f.js](../../../fjs/ir/native/module.f.js): L1's native
  rows, some of which take strings
- [any/module.f.js](../../../fjs/ir/runtime/any/module.f.js): `isRef`, the
  hooks and `checkedKind`
- [L0 design](../wasm/l0-design.md): §5 the loader's memory and table, §10
  lifetime, §21 the host as an L0 client
