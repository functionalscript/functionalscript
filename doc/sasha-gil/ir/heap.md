# A heap in the IR

2026-11-27. Proposed, with the owner's choices in it. A review of
allocator alternatives came first and ended in five choices, which the
owner took on 2026-11-26, beside an arena that counts in debug builds
only; memory as an interface of instructions followed on 2026-11-27
([The owner's choices](#the-owners-choices)). The rest waits for review.
[`fjs/ir/todo/heap.md`](../../../fjs/ir/todo/heap.md) lists the steps, and
two experiments have `todo/` files of their own: a
[line heap](../../../fjs/ir/todo/line-heap.md) and a
[recover by WASM exceptions](../../../fjs/ir/todo/recover-by-exceptions.md).

Line and instruction counts in this note are estimates from each
algorithm's shape, not measurements.

## Summary

- **One Heap interface, and a module for each variant**, which a runtime
  picks when it links, as Any's `checkedKind` is picked
  ([#4144](https://github.com/functionalscript/functionalscript/pull/4144)).
- **The bump arena first.** In a release build it has no header, counts
  nothing and frees nothing. In a debug build it counts in the shared
  header, keeps each block's size so that it can be walked, traps on a
  count of 0, and never reuses a block.
- **Paged size classes next, as the production heap**: mimalloc's core
  without its threads or its OS layer. A line heap in the style of RC Immix
  comes third, as an experiment.
- **Written in the IR's eDSL at the low level**, with a plain
  FunctionalScript model of each variant for the proofs.
- **Memory enters the IR as an interface** whose calls the WASM emitter
  writes as instructions, with an effect of its own that keeps them in
  place.
- **A caught throw is recovered by a recount from the roots** once no
  program frame is live. WASM exceptions that run the drops are an
  experiment.
- **Stale-reference tags in debug and test builds only.**
- **mimalloc compiled to WASM is a yardstick, not the heap, and WasmGC is
  not used**: it would give up the NaN box.

## Why

The runtime written in the IR has Any and short strings, and no heap, so
every object still lives in NaNVM. After
[#4144](https://github.com/functionalscript/functionalscript/pull/4144),
the benchmark programs that touch references still make 10,000 to 190,000
L0 calls each, `dup_ref`, `drop_ref` and the container imports among them
([benchmark.md](./benchmark.md#after-the-inline-reference-kind-d1)). With
the heap written in the IR and linked into the program, an allocation is a
few inline instructions, and a reference's `dup` and `drop` are an
increment and a decrement of a count in its object's header, or nothing at
all in a release arena. A reference is then its object's offset, so one
object has one box: `same` compares two boxes' bits, as `kind` already
reads a box's `tttt` bits.

## What the heap does

Heap is the one runtime module written at the low level: it owns the
memory, the count in each object and the cleanup after a throw
([type-system.md, The floor](./type-system.md#the-floor-state-lives-in-one-module)).
Every variant does the same jobs:

- **Make and free objects.** `alloc(O, fields, capacity)` gives a unique
  object, `push` and `set` fill it, and `freeze` makes it counted, with a
  count of 1
  ([type-system.md](./type-system.md#heap-objects-are-immutable-once-frozen)).
  When a `drop` takes a count to 0, the derived `release` drops what the
  object holds and frees it, through a work list instead of recursion
  ([Release is derived](./type-system.md#release-is-derived)).
- **Count.** A reference's `dup` and `drop` become an increment and a
  decrement of its object's count. Today they are the `Ref.dup_ref` and
  `Ref.drop_ref` imports into NaNVM ([defined-hooks.md](./defined-hooks.md)).
- **Keep literals and constants alive.** The start function builds each
  string and bigint literal once, `init` evaluates each other module
  constant once, and a use of either is a borrow that is never dropped
  ([L0 design §6](../wasm/l0-design.md#6-literals-built-once-at-start-up),
  [slice 6's decisions](../../../fjs/ir/todo/slices.md#decisions-for-slice-6-2026-11-14)).
  So each is a block like any other. Where the heap counts, the
  constant's own reference keeps its count at 1 or more, and the start
  function and `init` put that reference in the root table, where the
  recount finds it ([The root table](#the-root-table)).
  Compile-time `stat` data, whose box has the `s` bit set
  ([nan-box-patterns.md](./nan-box-patterns.md)) and which nothing counts,
  comes later
  ([type-system.md, open question 13](./type-system.md#open-questions)).
- **Recover after a throw.** The host's `enter`, `leave` and `recover`
  undo what the frames that a throw abandons held
  ([L0 design §21](../wasm/l0-design.md#21-the-host-is-an-l0-client)).
- **Serve both targets.** On WASM the heap is linear memory, and on Rust
  one buffer read by offset ([pointer-width.md](./pointer-width.md#decision)).
  So the allocator is IR code over memory, not a native allocator. Both
  cap the heap at 4 GiB, as wasm32 does anyway, so one layout serves both:
  a 32-bit count, a 32-bit link and a 16-bit tag fit any block. A larger
  Rust buffer is later work: it would need a count that checks for
  overflow, a wider link and a narrower tag.
- **Grow, never shrink.** `memory.grow` adds pages of 64 KiB, and WASM
  cannot give pages back: `memory.discard` is still a proposal, which
  Wasmtime does not implement. Running out of memory traps, as
  [L0 design §11](../wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)
  says.

What the heap knows that a general `malloc` does not is what makes a
small allocator enough:

| What it knows | What that allows |
| --- | --- |
| One thread | no atomics and no heap per thread |
| Every object's size at `alloc` and at free, often a constant | a sized free, and a constant size class, so the fast path inlines |
| No `realloc`: a builder knows its capacity | no growing or splitting in place |
| Frees are precise and prompt, from the lifetime pass | a freed block is reused while it is still in cache |
| No cycles and no finalizers | `release` is one pass over a work list |
| An object is immutable once frozen | its count is the only word that changes |
| A reference reaches the host only as a handle | the heap is closed, so it can be walked and recounted |

## The interface

One Heap interface, and each variant is a module of its own that
implements it; a runtime picks one when it links. Its functions, by what
each variant does:

| Function | Release arena, `module` | Debug arena, `counted` | Paged size classes |
| --- | --- | --- | --- |
| `alloc(t, n)`: a block of `n` bytes, 8-aligned, for an object of type `t` | moves the pointer | moves the pointer past a header with a count of 1 and the type `t` | pops the free list of `n`'s class and writes the same header |
| `dup(p)`: one owner more | nothing | adds 1, and traps on a count of 0 | the same |
| `drop(p)`: one owner less | answers `false` | takes 1, traps on 0, and answers `true` at 0 | the same |
| `free(p)`, once released | never called | marks the block freed, and traps on a count above 0 or a second `free`: the block is never reused | pushes the block on its class's list |
| `live()` | not exported | the blocks whose count has not reached 0 | the same, in debug builds |
| `root(p)`: keep an owned reference where the heap finds it, and answer its entry | puts it in the root table | the same | the same |
| `unroot(i)`: hand back the reference of entry `i` | frees the entry | the same | the same |
| `recover()` | clears the thrown value | the same | recounts from the roots |

`t` is the header's type byte, the kind included, which `release` and the
recount read: `alloc(O, fields, capacity)` lowers to `alloc` with `O`'s
type and size, both of which the data lowering knows
([What every counting variant shares](#what-every-counting-variant-shares)).
`drop` answers whether the caller must release what the block holds: the
derived `release` then drops each counted field and calls `free`. `enter`
and `leave` count the program calls in progress, so that `recover` knows
when no program frame is live
([A caught throw](#a-caught-throw)). `root` and `unroot` keep the
references that constants and the host hold, which the heap cannot see
where they are ([The root table](#the-root-table)).

A program that uses the heap correctly gives the same results on every
variant, and the debug arena traps where it does not.
[#4144](https://github.com/functionalscript/functionalscript/pull/4144) set
the pattern for the two builds: a builder takes the variant, `module` is
the default, and a runtime asks for the debug variant when it links.

**Later, a release `any` with no counting at all.** Once every kind of
reference lives in a release arena, a release build's Any can list every
variant as copy, and the lifetime pass then writes no `dup` and no `drop`.

## The variants

### The bump arena

One region and a pointer that only moves up. `alloc(t, n)` rounds `n` up to
8 bytes, moves the pointer, and grows the memory when the region is full.
Nothing is ever freed, so memory only grows.
[L0 design §10](../wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)
already allows an arena under the same ABI.

| | Release, `module` | Debug, `counted` |
| --- | --- | --- |
| Header | none | the 8-byte header that [every counting variant shares](#what-every-counting-variant-shares), whose tag stays 0 since no block is reused, and before it a word with the block's size, so that the arena can be walked in birth order, and with a mark once the block is freed: 16 bytes in all |
| Where blocks start | not kept | a bit for each 8 bytes, set where a block starts: a KiB of bitmap per page in its region's tail, found through a directory of a word per page of the memory, so that an address where no block starts traps |
| `alloc(t, n)` | about 6 instructions | the same, a check of the pointer, the stores of the size word, the header and the block's bit, and an update of `live()` |
| A block whose count reaches 0 | none does | is never reused, so a stale reference finds 0 and traps |
| `live()` | not exported | the blocks whose count has not reached 0, for balance checks in proofs |

- **For:** about 20 lines, and the fastest allocation. Objects made
  together sit together. As a debug heap it turns every stale reference
  into a trap, because nothing is reused.
- **Against:** memory only grows, so a long run reaches the 4 GiB of
  wasm32 and traps.
- **Use:** the first variant, the speed ceiling in benchmarks, and the
  debug heap. In release `drop` never answers `true`, so no block is
  released, and nothing that a block holds needs a `drop`.

### Paged size classes, the production heap

Memory is cut into pages, and each page serves one size class with its own
free list and a count of used blocks. A class allocates from its current
page. A page whose count reaches 0 goes back to a shared pool, where any
class can take it, except in the builds that check tags
([Tags](#what-every-counting-variant-shares)). An object above 8 KiB takes
whole pages. A page's
record is found from the address: the page index is the address shifted
right by 16, into a side table.

- **For:** this is mimalloc's free-list sharding
  ([Leijen, Zorn and de Moura](#sources)) without its threads and its OS
  layer. Empty pages move between classes, so the waste is bounded by the
  pages in part use. A page fills in address order, which keeps the objects
  of a class together. The heap is walked page by page.
- **Against:** about 300 lines. `alloc` and free take about 10
  instructions each, since both touch the page's record. Each class in use
  holds at least one page, so a small program pays about 64 KiB for each
  class; logical pages of 8 KiB cut that. More to tune: the page size, the
  spacing of the classes, and when to retire a page.

### The line heap, an experiment

Memory is cut into blocks of lines, such as 32 KiB blocks of 128-byte
lines, and each line counts the live objects that overlap it. `alloc`
bumps a pointer through a run of free lines and adds 1 to each line that
the object covers. When an object's count reaches 0, each of its lines
loses 1, and a line at 0 is free again. The allocator looks for the next
run of free lines when its current one is used up.

- **For:** allocation stays a bump, plus one increment of a line count for
  a small object. Objects made together sit together, and there are no
  classes to tune. RC Immix found that the layout of free lists was the
  main cause of the last 10% gap between reference counting and the
  fastest tracing collectors, because free lists scatter objects made at
  the same time, and with lines and blocks it closed that gap
  ([Shahriyar, Blackburn, Yang and McKinley](#sources)).
- **Against:** about 300 lines. Reuse is per line, so one surviving object
  pins its 128 bytes, and an object larger than a line needs a run of free
  lines. RC Immix fights that fragmentation by copying objects, which this
  heap cannot do: a reference is a raw offset in WASM locals, and nothing
  can update it. Without copying it is less proven than paged size
  classes, which is why it is an experiment
  ([`line-heap.md`](../../../fjs/ir/todo/line-heap.md)).

## What every counting variant shares

These hold whichever counting variant wins, so they are settled once. The
release arena counts nothing and keeps no header.

**An 8-byte header before each block**, which keeps `i64` items 8-aligned:

| Bits | Field | Why |
| --- | --- | --- |
| 0 to 31 | count | `dup` and `drop`; 0 marks a free block |
| 32 to 39 | size class | a free needs no lookup; paged size classes keep it per page, and the debug arena has no classes, so in both it is spare |
| 40 to 47 | type, the kind included | `release` and the recount reach an object by its offset alone, from a work list that holds no box, and find its fields from this byte: a flat string's, say, or a slice's |
| 48 to 63 | tag, in debug and test builds | a stale reference traps even after its block is reused |

- **Counts cannot overflow.** The references to one object are at most
  the 8-byte slots of 4 GiB, 2^29, plus those on the stack, so 32 bits
  suffice on both targets, since both cap the heap at 4 GiB.
- **A free block traps.** `dup` and `drop` trap on a count of 0, as NaNVM
  traps on a dropped handle today. It is one compare on a word that is
  loaded anyway.
- **Tags, in debug and test builds only.** A wasm32 offset without its 2
  alignment bits takes 30 of the box's 46 payload bits and leaves 16, and so
  does a Rust offset under the same cap. Each block keeps a tag in its
  header, `alloc` copies it into the reference that it answers, and a free
  moves it on, so a stale reference traps even after its block is reused. A
  block whose tag has taken all 65,536 values is retired, never reused: it
  keeps a count of 0 and takes a reserved type, which the recount's sweep
  passes over, so no reference ever names two objects. That is how NaNVM
  keeps its 14-bit generations exact today: `Slab::take` retires a slot
  whose generations are spent ([abi.rs](../../../nanvm/lib/src/l0/abi.rs)).
  A retired block costs memory only in the builds that check, and only once
  it has been allocated 65,536 times. For the same reason, storage keeps its
  shape in those builds: a page that empties stays with its class instead of
  going back to the pool, and the pages of a freed large object are not
  reused, so a header never moves and its tag only moves on. A tag costs a
  compare on every access through a reference, the one check with a steady
  cost, so release builds leave it out; count-0 traps and the debug arena
  catch stale references in tests.
- **The size class comes from the type.** The data lowering knows each
  object's size. For a record or a literal array it is a constant, so
  `alloc` inlines with a constant class; for `concat` it is computed in
  about 5 instructions.
- **Classes.** 8-byte steps up to 128 bytes, then 4 classes for each
  doubling up to 8 KiB: 40 classes, each of which wastes under 20% of its
  block beyond the rounding to 8 bytes.
- **Large objects.** Above 8 KiB an object takes whole pages, from a path
  for runs of pages: free runs in address order, first fit, merged with
  their neighbours when freed. An array of 100,000 items, 800 KB, wastes
  less than one 64 KiB page. TLSF can replace this path later.
- **Growth.** `memory.grow` by the larger of the request and half the heap,
  as walloc does, up to a maximum that the host sets. A JavaScript host
  makes a new view of the memory after each call, as the NaNVM host
  already does.
- **Release without recursion.** Once a count reaches 0 its word is free,
  so it holds the link of the work list, a 32-bit offset that reaches any
  block under the 4 GiB cap. `release` pops an object and writes 0 back
  into its count word, so a stale `dup` or `drop` traps and the debug
  recount reads no link as a count, even in the debug arena, whose `free`
  does nothing. It then drops the object's counted fields, queues each
  child whose count reaches 0, and frees the block, so a deep array needs
  no stack ([deep-value-drop](../../../nanvm/lib/todo/deep-value-drop.md)).
- **Reuse in place, later.** With size classes, a block that a drop frees
  can serve the next `alloc` of its class at once: Perceus's reuse
  ([Reinking, Xie, de Moura and Leijen](#sources)), which `try_unique` in
  [type-system.md](./type-system.md#heap-objects-are-immutable-once-frozen)
  asks for.

## Memory in the IR

The IR has no memory yet.
[type-system.md](./type-system.md#one-language-two-levels) plans `load` and
`store` as operators of a low level. The first step, H1, adds them instead
as a **`Memory` interface whose functions the emitter writes as WASM
instructions**, as the owner chose on 2026-11-27:

- `load8`, `load16`, `load32` and `load64` take an address, a `u(32)`, and
  answer a `u(8)` to a `u(64)`. `store8` to `store64` take an address and a
  value and answer `unit`. An address past the memory traps, which is a
  misuse, as a bad reference is to `Ref`, so none of them declares `fails`:
  a heap that reads past the memory has a bug, and no caller can recover
  from that.
- `size()` answers the memory's size in 64 KiB pages. `grow(n)` adds `n`
  pages and answers the size before, or `-1` when the memory cannot grow.
- The memory is the one that the loader makes
  ([L0 design §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
  imported from the interface's `abi`.
- An interface says `instructions` when the target binds it itself, and
  the checker takes only L0's `Memory`, or a part of it with its
  signatures, as one.

**Why calls and not operators.** The emitter writes the same instruction
either way. Calls already keep their order in every pass that exists,
while no operator has an effect, so each pass would first have to learn
that some do.

**Memory calls keep their place.** The IR has one effect, `fails`
([type-system.md](./type-system.md#functions-control-flow-and-failure)),
and it also says what a pass may do with a call: one that cannot fail may
be moved, removed when its result is unused, or merged with an equal call.
[comparison.md](./comparison.md#traps-overflow-and-effects) found that no
memory effects were needed, which holds for the high level, since it has
no memory. Memory's calls are the low level's, and they need the opposite:
a `store` answers `unit` and must stay, and two equal loads must not be
merged across a store. Declaring `fails` would keep them in order, but it
would spread to every function that touches memory, the heap's `dup` and
`drop` among them, which Any's hooks will call once references live in the
IR heap, and [defined-hooks.md](./defined-hooks.md#the-hooks) refuses a
hook that may fail. So Memory brings a second effect of one bit: a call of
a function that touches the memory keeps its place, and is neither removed
nor merged, whether or not it may fail. A function written in the IR
touches the memory when it calls one that does. No pass moves, removes or
merges calls today, so the bit binds the passes to come: the first of them
brings the checker's inference of it, as the checker infers `fails`, and
until then H1 proves that the passes that exist keep every Memory call
where it was.

**What else the low level needs.** `clz`, for the class of a size computed
at run time, which paged size classes need and the arena does not; and
module state, which is cells of memory at offsets that the heap keeps,
below.

## Where the heap keeps its state

The IR has no mutable globals. A module constant records, once in `init`,
where `Memory.grow` put the heap's first region, and the region's first
bytes hold the state: for the arena, the pointer, the region's end and, in
debug, the live count; later, the class heads, the thrown value and where
the root table is. When the region is full, `alloc` grows the memory.
Where the new pages follow the region, it extends the region; elsewhere it
starts a new region there and leaves the old one's tail unused. Each
region holds, in its first word, where the next region starts and where
its own blocks end, which `alloc` writes when it leaves the region, so a
walk of the heap, the recount's included, goes from region to region in
birth order. NaNVM's allocator grows the same memory, and each allocator
uses only the pages that its own `grow` answered. That changes
[L0 design §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules),
where the runtime owns everything outside the regions that the loader
reserves.

### The root table

The heap is a module of its own. It sees neither the program's globals nor
the host's handles, so the references that they hold are handed to it.
`root(p)` moves an owned reference into a table that the heap keeps in its
memory and answers the entry; `unroot(i)` hands the reference back.

- **Constants.** The start function and `init` root each constant that
  holds a heap object, once, and never unroot it. The program goes on
  reading the constant from its own global, as a borrow of the entry.
- **The host.** A reference crosses to the host as an entry, whose index
  is the host's handle, and the host's drop of a handle unroots its
  reference and drops it. Entries are reused as NaNVM's slots are, with a
  generation in the handle, so a stale handle traps
  ([abi.rs](../../../nanvm/lib/src/l0/abi.rs)).

So the table is the one that references need anyway, since they cross the
host boundary only as handles
([pointer-width.md](./pointer-width.md#decision)), and the recount finds
every root in it ([A caught throw](#a-caught-throw)).

## A caught throw

A throw traps ([l0-throw-trap.md](../wasm/l0-throw-trap.md)), so the
frames between the `throw` and the host never run their `drop`s.
FunctionalScript has no `try`: only the host catches, through the `catch`
and `sandbox` effects ([common effects](../../../fjs/effects/common/module.f.js)),
and then goes on with the same instance. Before it does, `recover` must
undo what the abandoned frames held.

**Why NaNVM's rule is exact today.** A NaNVM handle is one reference, not
one object: `dup_ref` makes a new handle
([abi.rs](../../../nanvm/lib/src/l0/abi.rs)). Each handle records its
birth. A program keeps no value across a call of the host but its
constants, literals among them, so every handle made since `enter`
belonged to an abandoned frame, and `recover` frees exactly those.

**Why it stops being exact.** With the count in the object's header, a
reference is the object's offset, and `dup` adds 1 to the object's count
wherever the object was made. When an abandoned frame held an owned
reference to an object made before `enter`, that count stays one too
high, and nothing records it. Say `first = xs => xs[0]` answers an owned
`xs[0]`, and its caller throws while it holds that: `xs[0]` and everything
it holds are never freed. Freeing what was made since `enter` still frees
the new objects, and their release drops the counts that they held, but
not these. Counts end up too high, never too low, so this is a leak and
not a safety hole. With size classes, "made since `enter`" is not even an
address range: finding those objects would need a birth stamp in every
header.

**The recount from the roots.** When no program frame is left on the
stack, every live reference is in a root or inside a live object. The
roots are the entries of the root table ([The root table](#the-root-table)):
the host's handles, since references reach the host only as handles, and
every constant that holds an object, the program's, literals included,
and the runtime's own. The thrown value and a call's result are handles by
then.
The recount:

1. sets the count of every block to 0;
2. walks from the roots with its own work list, adds 1 for each reference
   that it meets, and queues an object the first time it reaches it;
3. rebuilds the allocator's own records by a sweep of the heap. It
   empties every free list and clears every page's count of used blocks.
   Then each block whose count is still 0, free before or never reached,
   builders that abandoned frames left open included, goes back on its
   list, so none is listed twice, and every other block adds 1 to its
   page's count. A retired block is passed over, and a page left with no
   used block goes where a free would send it.

It is exact and costs nothing on the normal path. A recovered throw costs
about one mark and sweep of the heap. It needs what every counting variant
offers: a heap that it can walk, and objects whose fields it finds from
the type byte in the header.

**When frames are still on the stack.** Calls may nest: abi.rs names the
case "when the host answers an effect". If the host catches a throw from a
nested call and goes on, the frames below it are alive and hold references
in locals that no walk can see, so a recount then would free what they
hold. A `recover` that leaves an outer `enter` open therefore frees
nothing. It marks the heap as needing a recount, which runs when the
outermost call returns or recovers. Until then the abandoned objects stay,
with counts too high: late, but safe. Effects come back to the host as
values, so a `catch` thunk may always run as an outermost call, and the
deferral may never be needed; not every host has been checked for this.

**While NaNVM holds references into the IR heap.** From H3 until
containers move to the IR heap ([Order of work](#order-of-work)), a NaNVM
array or object may be the only owner of an IR string. The recount cannot
walk NaNVM's values, so it would free that string under a live container,
and as a checker it would report the container's reference as a missed
`drop`. Until NaNVM holds no reference into the IR heap, the recount
therefore either finds the references that NaNVM's values hold among its
roots, which NaNVM would put in the root table as it stores them, or does
not run. When it does not run,
`recover` frees nothing in the IR heap: late, but safe, as above. NaNVM's
own `recover` still frees its handles, and their release drops what they
held in the IR heap. The note on NaNVM's references before H3 decides
which ([open question 2](#open-questions)). The proposal is to wait:
rooting them is Rust code that step 5 removes again, and until then only
a caught throw leaks.

**In the arena** nothing is freed anyway, so its `recover` only clears the
thrown value. In debug its counts stay too high after a caught throw, as
they would in any heap without the recount, so its balance check holds for
proofs that catch no throw until the recount runs there too.

**Cost.** The recount takes time in proportion to the heap. A test run that
catches thousands of throws over a large heap pays it each time. Where
that shows, the recount can wait until the heap has grown by half since
the last one, as a tracing collector's trigger does, and what leaks in
between is bounded by that growth.

**The ways weighed:**

| Way | Exact | The normal path pays | A caught throw pays |
| --- | --- | --- | --- |
| The recount from the roots, chosen | yes, once no program frame is live | nothing | a mark and sweep of the heap |
| Free by birth: NaNVM's rule over header counts | no: owned references to older objects leak | a birth stamp in every header | a walk of the heap to find the young objects |
| WASM exceptions that run the `drop`s | yes, at any depth | a handler around each call made while holding owned references | the `drop`s themselves |
| A shadow stack of owned references | yes, at any depth | a store and a load for each owned local | the `drop`s above the mark |
| A snapshot of every count, as the counting host's `keep` takes | yes, when everything outside a call predates the snapshot | a pass over every count at each snapshot | a pass to restore every count |
| Accept the leak | no | nothing | nothing |

**WASM exceptions, an experiment.** They are part of Wasm 3.0, and
[l0-throw-trap.md](../wasm/l0-throw-trap.md) already names them as the way
to a future `try`. They are exact at any depth, but they would reopen the
throw ABI decided on 2026-11-04 and put a cleanup path behind nearly every
call, so they are an experiment of their own, measured against the
recount ([`recover-by-exceptions.md`](../../../fjs/ir/todo/recover-by-exceptions.md)).

## How misuse and leaks are caught

Each check catches what the one before it misses.

- **Misuse traps where it happens.** `dup` or `drop` on a count of 0
  traps. The debug arena never reuses a block, so it turns every stale
  reference into that trap, and tags do the same in the heaps that reuse.
- **A balance check after each proof.** `alloc` and free keep a count of
  live blocks for each class. Once a proof's calls have returned and the
  host has dropped its handles, every count must be back where it started.
  It is the counting host's `live` check
  ([count host](../../../fjs/ir/l0/host/count/module.mjs)) moved into the
  heap, and it costs a compare.
- **The recount as a checker.** In a debug build, the recount also runs at
  every outermost return as a check: it counts into a table of its own,
  leaves the headers alone, and compares its counts with the stored ones. A
  stored count above the recount is a missed `drop`; one below it, or a
  reference into a free block, is a `drop` too many. Unlike the balance
  check, it names the object and its type.
- **Poisoned blocks.** A debug free fills the block with a reserved box
  that every operation refuses, so a read through a stale reference fails
  at once instead of reading the next object.
- **A model to compare with.** A plain FunctionalScript model of the
  allocator, a map from offset to block, runs the same seeded random
  sequences of allocations and frees as the IR heap, and the two must
  agree on every live block. The proof also checks that no two live blocks
  overlap and that every free block is on exactly one list.
- **Differential runs.** Every program that runs on NaNVM's handles today
  runs on each Heap variant, with the same result and every count back
  where it started.
- **Out of memory.** A small maximum set by the host lets a proof reach
  the out-of-memory trap and check that the host stops cleanly.
- **Speed.** The programs of [benchmark.md](./benchmark.md) and the perf
  demos run on each variant, with an imported mimalloc as the yardstick.

## Where it is written

**Coding in the IR is coding in FunctionalScript.** The IR's eDSL is
FunctionalScript: Any is a `.f.js` module whose functions build IR terms
([any/module.f.js](../../../fjs/ir/runtime/any/module.f.js)). Written that
way, the heap has two halves. FunctionalScript runs at build time: the
class table, the size-class arithmetic, and helpers that work as macros.
The IR runs at run time, read by the checker and lowered by the emitter.
Plain FunctionalScript cannot be the run-time half, because it has no
memory to change.

| | The IR's eDSL at the low level, chosen | Plain FunctionalScript | C or Rust compiled to WASM |
| --- | --- | --- | --- |
| Fast path | inlined into each program | copies a value of the memory at each step | a call into another module |
| Checked | by the IR's checker, with proofs as Any has | as any `.f.js` | no |
| Rust target | the same module, through the Rust emitter | the same | Rust: the same code built natively; C: nothing |
| Missing today | memory at the low level | the update in place of a value held alone: a language change | nothing, but it adds a second toolchain |

- **The IR's eDSL at the low level**, as
  [type-system.md](./type-system.md#one-language-two-levels) plans: only
  the data lowering and the Heap module write low-level code. The IR has
  loops, integer arithmetic, shifts and masks, and still needs what
  [Memory in the IR](#memory-in-the-ir) lists.
- **Plain FunctionalScript** gives the model for the proofs, not the
  heap. As the heap, every store would copy the memory, unless the
  language learned to update a value that it holds alone in place, as Koka
  does with Perceus's reuse. That is a language change, which would start
  as a `todo/` proposal.
- **C or Rust** brings a mature optimizer, and it is how mimalloc or
  dlmalloc would be bound as yardsticks. As the heap, it keeps every change
  of a count behind a call, which is what the L0 calls of the benchmark
  cost today.

## The alternatives weighed

Five designs are worth writing in the IR, from the simplest to the most
general: the bump arena, segregated free lists, paged size classes, the
line heap and TLSF. Three are chosen above, and the rest are here.

### Segregated free lists

A small table holds one free-list head for each size class, such as
8-byte steps up to 128 bytes, then four classes for each doubling.
`alloc` pops its class's list, or carves from a bump pointer when the list
is empty. A free pushes the block back on its class's list.

- **For:** about 100 lines with a path for large objects. With a constant
  class, `alloc` is about 7 instructions and a free about 4, both inlined.
  Reuse is last in, first out, so a freed block comes back while it is
  still in cache.
- **Against:** a block never changes class. After a phase of many 32-byte
  objects, that memory stays reserved for 32-byte objects, so the
  footprint is the sum of each class's peak, not the peak of live bytes.
- **Precedent:** [walloc](https://github.com/wingo/walloc), Andy Wingo's
  small malloc for WASM: 64 KiB pages of 256-byte chunks, 10 classes up to
  256 bytes, and one free list for each class. A chunk takes a class when
  it is first needed, and its README describes no path back.
- **Decision:** measured only if paged size classes leave a gap to the
  arena worth closing.

### TLSF

Two-level segregated fit: free blocks of any size sit in lists indexed
twice, by their power of two and by a linear split of it, with bitmaps
that find a list that is not empty in constant time through `clz` and
`ctz`. Each block carries a boundary tag, and a free merges with free
neighbours at once.

- **For:** constant time for every size, large objects included, and low
  fragmentation, thanks to the merging. One design covers everything, and
  real-time and embedded systems use it.
- **Against:** about 500 lines, and 25 to 40 instructions each way,
  against 5 to 10 for size classes on the small objects that dominate. Each
  block pays a tag of 4 to 8 bytes and a minimum size.
- **Decision:** at most the path for large objects of a heap of classes,
  not the whole heap.

### A buddy allocator, dlmalloc and emmalloc

- **A buddy allocator** splits power-of-two blocks and merges each with its
  buddy when both are free. It is simple, but up to half of a block is
  wasted for sizes just above a power of two, which strings and arrays hit
  often. It fits only a path for runs of pages.
- **dlmalloc and emmalloc**, compiled from C, are mature general-purpose
  allocators: dlmalloc is Emscripten's default, and emmalloc its compact
  option. They solve problems this heap does not have, such as sizes that
  are not known and `realloc`, and they have mimalloc's costs, below.

### mimalloc compiled to WASM

It builds, and it could be bound, but as the heap it costs more than it
gives. Its [readme](https://raw.githubusercontent.com/microsoft/mimalloc/main/readme.md)
lists WASM among its ports, there is a WASI port, and Emscripten offers it
as `-sMALLOC=mimalloc`, beside dlmalloc, the default. The readme also says
that it was first written for the runtimes of Koka and Lean, which count
references as this runtime does, so its design is the right model: paged
size classes are its core.

**How it would be bound.** Compile it with clang for wasm32 against an
imported memory, place its data and its stack in a region that the loader
reserves
([L0 design §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
and import `malloc` and `free`. That is a host binding of the Heap
interface ([definition.md, Bindings](./definition.md#bindings)). It works,
with these costs:

- **The fast path stays behind a call.** Every `alloc` and free becomes a
  call into another instance. No source found shows V8 inlining across
  instances; its inlining work covers calls within a module. The whole
  fast path here is 5 to 10 instructions, about the price of the call.
  Merging mimalloc into the program's module instead needs a relocating
  link, clang's position-independent side modules, which would be a new
  job for the linker in `fjs/media/wasm`.
- **Most of it has nothing to do here.** Its heaps for each thread, its
  free list across threads with atomics, and its layer that reserves,
  commits and returns OS memory find one thread and a memory that never
  shrinks.
- **It does not know the sizes.** This heap knows each size at `alloc` and
  at free; mimalloc looks the size up from the page on free.
- **It cannot serve the Rust target.** Natively, mimalloc allocates from
  the OS, while the Rust heap is one buffer of offsets.
- **It is outside the checker.** About 10,000 lines of C that the
  interpreter's counting heap cannot run, where a bug corrupts the heap
  without a trap.

**Where it helps: as a yardstick.** A Heap variant bound to an imported
mimalloc, or to dlmalloc, shows how far the IR's variants are from it on
the same programs, with no change to the runtime.

### WasmGC

WasmGC would remove the heap, the counts and `recover`, but it gives up
the NaN box, so this runtime does not use it. It is part of Wasm 3.0
(September 2025): the engine allocates and collects structs and arrays.
Node and the major browsers run it, and Wasmtime turned it on by default
in version 47 (July 2026).

- **For:** no `dup` and no `drop` at all, allocation is the engine's bump,
  the collector compacts, nothing leaks after a throw, and values pass to
  JavaScript as they are.
- **The NaN box goes.** A GC reference cannot live in an `i64`, so `any`
  becomes `anyref`. A number stored in an array or passed as `any` then
  needs a box on the heap, since only 31-bit integers fit an `i31ref`.
  That undoes what [slice 1](./runtime-in-ir.md) bought: `sumTo` and `fib`
  at JavaScript's speed.
- **It is a new ABI.**
  [L0 design §1](../wasm/l0-design.md#1-the-wasm-type-of-any-i64-fixed-for-abi-version-1)
  fixes `any` as an `i64` for version 1.
- **Rust has no counterpart**, so the two targets would get two models of
  the heap.
- **Reuse in place goes.** Exact counts let a function update an object
  that it holds alone (`try_unique`, Perceus's reuse); a tracing collector
  cannot tell.

If it is ever wanted, it is a runtime of its own, with Any, String and
Containers over GC types, not a variant of the Heap module.

### Side by side

| Design | IR lines | `alloc` / free, WASM instructions | Reuse and waste | Large objects | Walked for `recover` | Serves Rust's buffer |
| --- | --- | --- | --- | --- | --- | --- |
| Bump arena, chosen | 20 | 6 / 0 | none: memory only grows | the same bump | yes, in birth order | yes |
| Segregated lists | 100 | 7 / 4 | within a class only: the footprint is the sum of each class's peak | needs a path for runs of pages | yes, if every block keeps its header | yes |
| Paged size classes, chosen | 300 | 10 / 10 | empty pages go to any class; the waste is pages in part use | whole pages | yes, page by page | yes |
| Line heap, an experiment | 300 | 10 / 8 | per 128-byte line; a survivor pins its line | runs of lines, or pages | yes, line by line | yes |
| TLSF | 500 | 25 to 40 / 25 to 40 | merges free neighbours: low | built in | yes, by boundary tags | yes |
| Buddy | 150 | 15 to 30 / 15 to 30 | up to half of a block | built in | yes | yes |
| dlmalloc, emmalloc (C) | none of the IR's | a call, then 20 to 40 | low | built in | partly | no: native code allocates from the OS |
| mimalloc (C) | none of the IR's; about 10,000 of C | a call, then about 10 | low | built in | yes, through its block visitor | no, for the same reason |
| WasmGC | none | the engine's bump; no frees | a compacting collector | built in | not needed | no counterpart |

## Order of work

Each step is one stack of pull requests, and each keeps every proof green.

1. **H1, memory at the low level**: the `Memory` interface, which says
   `instructions`, the checker's rules for it, the emitter, and proofs that
   the passes keep its calls in place. The effect's inference comes with
   the first pass that moves calls. No runtime change yet.
2. **H2, the arena** under `fjs/ir/runtime/heap`, `module` for release and
   `counted` for debug, proven against the FunctionalScript model before
   any program uses it.
3. **H3, long strings in the IR heap**, the first objects to move, since
   short strings are already in the IR ([short-strings.md](./short-strings.md)).
   NaNVM's arrays and objects then hold references into the IR heap, so
   NaNVM needs the heap's `dup` and `drop` for them, through the table that
   the loader gives both modules
   ([L0 design §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)).
   That handover needs a note of its own first. The root table comes with
   them: a long string is the first IR object that a constant or the host
   holds.
4. **H4, paged size classes** with the recount from the roots, measured
   against the arena, which is the ceiling, and against NaNVM. While NaNVM
   holds references into the IR heap, the recount takes them as roots or
   waits ([A caught throw](#a-caught-throw)).
5. **Containers, functions and bigints** move to the IR heap kind by kind,
   until NaNVM holds no references.
6. **The experiments**: the [line heap](../../../fjs/ir/todo/line-heap.md)
   and the [recover by WASM exceptions](../../../fjs/ir/todo/recover-by-exceptions.md).
   Segregated free lists only if paged size classes leave a gap worth
   closing, with an imported mimalloc as the yardstick.

## The owner's choices

The review of the alternatives ended in five choices, and the owner took
the proposed option of each on 2026-11-26, with two experiments filed
beside them:

1. **The variants and their order.** The bump arena first, then paged size
   classes as the production heap. A line heap comes third, as an
   experiment ([`line-heap.md`](../../../fjs/ir/todo/line-heap.md)).
   Segregated free lists are measured only if a gap is left.
2. **Where the heap is written.** In the IR's eDSL at the low level, as
   [Any](../../../fjs/ir/runtime/any/module.f.js) is, with a plain
   FunctionalScript model of each variant that the proofs compare it with.
3. **How a caught throw is recovered.** By the recount from the roots once
   no program frame is live, deferred after a nested `recover`. WASM
   exceptions that run the drops are an experiment of their own
   ([`recover-by-exceptions.md`](../../../fjs/ir/todo/recover-by-exceptions.md)).
4. **Stale-reference tags** in debug and test builds only.
5. **How a variant is chosen.** One Heap interface, each variant its own
   module, which a runtime picks when it links, as
   [#4144](https://github.com/functionalscript/functionalscript/pull/4144)'s
   `checkedKind` is picked.

Beside them, the owner chose the arena first, counting in debug builds
only (2026-11-26), and memory as an interface of instructions rather than
operators (2026-11-27).

## What changes in the other notes

These edits wait until this note is decided.

- [type-system.md, The floor](./type-system.md#the-floor-state-lives-in-one-module):
  `recover` needs no list of the objects made since the innermost `enter`,
  since it recounts from the roots.
- [type-system.md, One language, two levels](./type-system.md#one-language-two-levels):
  `load` and `store` are Memory's calls, not operators, and memory has an
  effect of its own beside
  [one effect](./type-system.md#functions-control-flow-and-failure).
- [comparison.md](./comparison.md#traps-overflow-and-effects): its finding
  that no memory effects are needed holds for the high level alone.
- [L0 design §5](../wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules):
  each allocator owns the pages that its own `grow` answered, where today
  the runtime owns everything outside the loader's regions.
- [L0 design §21](../wasm/l0-design.md#21-the-host-is-an-l0-client): over
  the IR heap, `recover` recounts instead of freeing what was made since
  the innermost `enter`.

## Open questions

1. **How a build asks for debug.** A runtime flag beside `checkedKind`,
   such as `countedHeap`, or one `debug` flag that links every debug
   variant, `checkedKind`'s Any included. One flag is the proposal.
2. **The first client.** Long strings in the arena mean that NaNVM's
   arrays and objects hold references into the IR heap. In release such a
   reference needs no count; in debug NaNVM must call the heap's `dup` and
   `drop`. That needs a note of its own before H3. The same note decides
   how H4's recount sees those references: NaNVM roots them, or
   the recount waits until NaNVM holds none. Waiting is the proposal
   ([A caught throw](#a-caught-throw)).
3. **A trap for misuse.** The debug arena traps on a count of 0, and every
   heap traps when the memory cannot grow. A `trap` fails, so `alloc`
   would fail, and with it every function that allocates, though
   [type-system.md](./type-system.md#functions-control-flow-and-failure)
   says that allocation does not count as failing; and once Any's hooks
   call the heap's `dup` and `drop`,
   [defined-hooks.md](./defined-hooks.md#the-hooks) refuses them, since a
   hook may not fail.
   [L0 design §11](../wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)
   tells misuse from failure: a misuse traps and declares nothing, as
   `Ref`'s functions do. So the IR needs a trap for misuse that the
   checker does not count as failing, which would also free Any's `kind`
   of the `fails` that its trap on a forged box gives it today. The
   proposal for H2 is a mark on `trap`. The other way, a Memory function
   that traps where a condition does not hold, keeps the terms as they are
   but puts a general check into Memory. H2a writes the proposal,
   `misuse(reason)`, while the answer is open
   ([README](../../../fjs/ir/README.md#what-a-trap-on-misuse-adds)).

## Sources

**Opened**

- mimalloc's [readme](https://raw.githubusercontent.com/microsoft/mimalloc/main/readme.md):
  the WASM port, the Koka and Lean origin, and free-list sharding; its
  latest release then was v3.4.5, of 2026-08-05.
- walloc's [README](https://github.com/wingo/walloc): 64 KiB pages,
  256-byte chunks, 10 classes, and growth by half the heap.
- Shahriyar, Blackburn, Yang and McKinley,
  [Taking Off the Gloves with Reference Counting Immix](https://microsoft.com/en-us/research/wp-content/uploads/2016/02/rcix-oopsla-2013.pdf),
  OOPSLA 2013.
- In this repository: [type-system.md](./type-system.md),
  [pointer-width.md](./pointer-width.md), [definition.md](./definition.md),
  [defined-hooks.md](./defined-hooks.md),
  [runtime-in-ir.md](./runtime-in-ir.md), [benchmark.md](./benchmark.md),
  [comparison.md](./comparison.md) and
  [nan-box-patterns.md](./nan-box-patterns.md);
  [l0-design.md](../wasm/l0-design.md),
  [l0-throw-trap.md](../wasm/l0-throw-trap.md),
  [modular-runtime.md](../wasm/modular-runtime.md) and
  [modular-l0.md](../wasm/modular-l0.md); Sergey's
  [NaN box](../../sergey-shandar/nanvm/README.md); NaNVM's
  [abi.rs](../../../nanvm/lib/src/l0/abi.rs);
  [Any in the IR](../../../fjs/ir/runtime/any/module.f.js); the
  [counting host](../../../fjs/ir/l0/host/count/module.mjs); and the
  [common effects](../../../fjs/effects/common/module.f.js).

**From search results, not opened.** web.dev, bytecodealliance.org and
webassembly.org were out of the network's reach when this was written, so
these are known from search snippets alone:

- The [Wasm 3.0 announcement](https://webassembly.org/news/2025-09-17-wasm-3.0/),
  September 2025.
- [Wasm GC in Wasmtime](https://bytecodealliance.org/articles/wasmtime-gc),
  and the [Wasmtime 47.0.0 release](https://newreleases.io/project/github/bytecodealliance/wasmtime/release/v47.0.0).
- [Scaling multithreaded WebAssembly applications](https://web.dev/articles/scaling-multithreaded-webassembly-applications),
  on Emscripten's `-sMALLOC=mimalloc`.
- The [WebAssembly proposals](https://github.com/webassembly/proposals) and
  [Wasmtime's proposal support](https://docs.wasmtime.dev/stability-wasm-proposals.html),
  for `memory.discard`.
- [V8's speculative Wasm optimizations](https://v8.dev/blog/wasm-speculative-optimizations),
  on inlining.
- Leijen, Zorn and de Moura,
  [mimalloc: Free List Sharding in Action](https://www.microsoft.com/en-us/research/publication/mimalloc-free-list-sharding-in-action),
  APLAS 2019.
- Reinking, Xie, de Moura and Leijen,
  [Perceus: Garbage Free Reference Counting with Reuse](https://www.microsoft.com/en-us/research/publication/perceus-garbage-free-reference-counting-with-reuse/),
  PLDI 2021.
- Masmano and others, TLSF, 2004, and
  [Matt Conte's implementation](https://github.com/mattconte/tlsf).
