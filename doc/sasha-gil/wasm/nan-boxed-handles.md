# NaN-boxed handles for NaNVM's ABI

**Proposed, 2026-11-21.** The last lever of
[the benchmark](../ir/benchmark.md#levers): NaNVM's `i64` handle becomes
the NaN box's bits, so a number or a constant needs no slot, and `kind`,
`to_f64` and `from_f64` become a few instructions that a module can
inline. Nothing here is decided; each choice has a recommendation.

## Where the time goes today

A handle is an index into a slab of Rust `Any` values, with the slot's
generation in the high 32 bits
([`abi.rs`](../../../nanvm/lib/src/l0/abi.rs)). The four constants are
the handles `0` to `3`. Every other value, a number too, takes a slot:

- `from_f64` allocates a slot and `drop` frees it: 27.5 ns the pair.
- `kind` and `to_f64` enter the thread-local state, set and clear its
  busy flag, check the generation and read the slot: about 8 ns each,
  of which the call itself is about 2.4 ns.
- In the re-profile taken after the borrow, number and records levers
  (#4054, commit `55870ce76b`), the handle layer is still 53% to 92% of
  every benchmark program but `repeat`, and 90% or more of the numeric
  loops.

The programs never see a handle's bits. A module reads Any's constants
from imported globals ([L0 design §3](./l0-design.md#3-constants-imported-immutable-globals)),
and `from_f64` may already change a NaN's payload (§4). So the encoding
is NaNVM's to change, and a portable module does not change with it.

## The proposal in short

1. **NaNVM** encodes scalars in the handle itself, as
   [type-system.md](../ir/type-system.md) lays out the box, and keeps the
   slab for references only, with the kind in the tag bits.
2. **The IR's WASM emitter** may then inline the scalar half of `kind`, and `to_f64`,
   `from_f64`, `to_bool`, `from_bool`, and the scalar half of `dup` and
   `drop`, in a module compiled for NaNVM alone.

Each is a PR, step 2 on step 1, and the benchmark runs after each.

## Choice 1: what the box holds

| Option | Number, constants | References | Change |
| --- | --- | --- | --- |
| **A. Scalars in the box, references in the slab** (recommended) | In the bits | A NaN-space pattern with the kind's 4-bit tag and the slab index and generation in the 46-bit payload | `abi.rs` and the hosts' constants |
| B. The whole box of type-system.md | In the bits | Short strings and bigints in the bits, others as offsets into one heap buffer ([pointer-width.md](../ir/pointer-width.md), option A) | NaNVM's value representation, rewritten |
| C. Numbers only | In the bits | One NaN-space pattern with no kind tag, the slab index and generation in the payload; the constants at fixed NaN patterns | Smallest |

A is most of B's gain for numeric code at a small part of its cost:
`kind` of a number or a constant, and `to_f64`, `from_f64`, `to_bool` and
`from_bool`, read no state at all. `kind` of a reference still reads its
slot, to check the generation and that the tag matches the slot's kind,
so a dropped or forged reference traps as today (see the misuse checks
below). B is
a rewrite of NaNVM's heap, which is a project of its own. C needs a NaN-space
reference pattern too, since a raw index and generation can be any bit
pattern, a valid number's among them. It differs from A only in leaving
the kind out of the tag: under both, `kind` of a reference reads its
slot. A's tag costs nothing more and keeps type-system.md's patterns,
so a later move to B changes no reference's bits.

Under A the patterns are type-system.md's, so a later move to B keeps
every scalar's bits:

| Value | Bits |
| --- | --- |
| A number | its `f64` bits, every NaN as `0x7FF8_0000_0000_0000` |
| `false`, `true` | `b111_1111_1111_0…0_0001_0000`, `b` the sign bit |
| `undefined` | `0111_1111_1111_0…0_0010_0000` |
| `null` | `0111_1111_1111_0…0_0011_0000` |
| A string, bigint, array, object or function | `0111_1111_1111_tttt_p…p_10`: `tttt` the kind's tag (`0100`, `0101`, `0111`, `0011`, `0110`), `p…p` the slab index and generation |

## Choice 2: how a reference's 46 bits split

Today a value handle has 32 bits of index and 32 of generation. The box
leaves 46 for both. A slot is retired after its last generation, so
fewer generation bits retire slots sooner on a hot free list.

| Option | Live references | Reuses of one slot |
| --- | --- | --- |
| **A. 24 + 22** (recommended) | 16.7 million | 4.2 million |
| B. 32 + 14 | 4.3 billion | 16,384 |
| C. 20 + 26 | 1 million | 67 million |

A keeps both far past the benchmark's needs, which reuse a few slots
hundreds of thousands of times. B's 16,384 reuses would retire a hot slot
after a few milliseconds of a loop.

## Choice 3: how the module inlines (step 2)

A module compiled for NaNVM alone is *specialized*
([inline-fragments.md](./inline-fragments.md)): it runs only on NaNVM of
this ABI version, not on the counting host. So the proofs compile each
program both ways, the portable one on both hosts and the specialized one
on NaNVM.

| Option | How | Cost |
| --- | --- | --- |
| **A. Fragments from NaNVM's `.wasm`** (recommended) | NaNVM's `.wasm` lists its fragments in an `fjs.inline` section, and the compiler splices their bodies, as inline-fragments.md proposes | Medium: a fragment reader and inliner on `fjs/media/wasm` |
| B. Templates in the emitter | The WASM emitter holds the few instructions of each function for NaNVM's ABI version, picked by a compile option | Small: the seven functions are each 3 to 10 instructions |
| C. No inlining yet | Step 1 alone, measured first | None |

A keeps one source of the bits, NaNVM's Rust, and is the general form
that the [modular runtime](./modular-runtime.md) needs anyway. B writes
the bits a second time, in FunctionalScript: a parity test against
NaNVM's exports checks the values it tries, but cannot stop the two from
disagreeing on a pattern it does not try, and the repository's rules ask
for one implementation, not a copy that can drift
([AGENTS.md](../../../AGENTS.md), "Reuse code; export what you need").
So B is cheaper only until the bits change once. C is a fine first
step either way: step 1 is measured before step 2 starts.

## What changes for the misuse checks

Sasha prefers refusing over ignoring, so this is the cost to weigh:

- **A number cannot be "not a value".** Every bit pattern outside the NaN
  space is a number, so `kind` of a made-up handle such as `12345` answers
  `number`, where it traps today. `drop` of a number does nothing, as it
  does for a constant today.
- **The rest of the NaN space still traps.** A pattern that is no
  constant and no reference, or a reference whose tag does not match its
  slot's kind, is `not a value`. `from_f64` never makes one, since it
  canonicalises every NaN.
- **A reference still traps after its `drop`**, by its generation, as
  today. So `kind` of a reference keeps its slab lookup: the tag alone
  would answer a kind for a stale or forged reference, which is the
  ignoring this note avoids.
- **The proofs that pass a made-up handle** pass one from the NaN space
  instead, so that both hosts still refuse it.

## Expected gains

Estimates, not measurements:

- **Step 1:** `from_f64` and `drop` of a number stop allocating, and
  `kind` of a scalar, `to_f64` and the boolean calls stop entering the
  state. Each becomes about the 2.4 ns of the call itself. `sumTo` and `fib` might be
  2× to 3× faster, and the others less, since their references stay in
  the slab.
- **Step 2:** the inlined calls cost about one instruction each, so
  `sumTo` comes near the typed IR's 5 µs. The numeric loops might gain up
  to about 10× over today in all.

## Steps

1. **NaNVM's ABI** (`abi.rs`, `l0-wasm`): the encoding of choices 1 and 2.
   NaNVM exports its four constants, so the JavaScript host reads them
   instead of writing `0` to `3`. The ABI's tests and the host proofs on
   the rebuilt `.wasm` pass, and the benchmark runs.
2. **The inliner and the specialized mode** (choice 3): NaNVM's `.wasm`
   names its fragments, the compiler splices them, and the proofs run in
   both modes, then the benchmark again.
3. **The benchmark note** gets the new numbers.
