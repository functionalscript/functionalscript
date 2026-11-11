# Design to-do

This is a reminder list of improvements to the notes in this folder. It
comes from a review of every note on 2026-11-09, and is trimmed to what
is still open after [modular-l0.md](./modular-l0.md) merged. None of the
items here is decided. Remove an item when a note takes it up.

## Stale statements

Small, mechanical fixes. Each is one line.

1. **The L0 function count.** [l0-core.md](./l0-core.md) says the design
   "names 31" functions. The [L0 design summary](./l0-design.md#summary)
   says 32, since `throw` was added on 2026-11-04. A modular L0 would make
   it 35 ([modular-l0.md §2](./modular-l0.md#2-length-splits-into-one-function-per-module)).
2. **The `make_function` signature.** [l0-core.md § Calls and returns](./l0-core.md#calls-and-returns)
   still shows `make_function(code_index, frame, length, text_ptr, text_len)`.
   Its own introduction and [L0 design §12](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)
   take the text as a string value: `(code, frame, length, text)`.
3. **The lifetime pass.** [l0-core.md § Lifetime](./l0-core.md#lifetime)
   says the last-use analysis is something "no pass does today". The
   [IR design, choice 9](./ir-design.md#9-lifetimes-are-one-pass-over-the-ir)
   now plans that pass.
4. **`i64` is decided in practice, but still open on paper.**
   [README open question 1](./README.md#open-questions) and
   [l0-core.md](./l0-core.md#the-wasm-type-of-any) keep the WASM type of
   `any` open. The NaNVM i64-handle ABI (#3648) is merged, and the IR,
   inline fragments and runtime modules all assume `i64`. It could move
   to [Decisions](./README.md#decisions).
5. **The README plan.** It says "Steps 1 and 2 are done as drafts".
   Step 3, the runtime in FunctionalScript on a JavaScript host, is done
   too (#3615 to #3655). Step 4 is now IR-first. Step 1's check against
   `vm::unstable` is still marked to do.
6. **The L1 operation count.** [l1-operations.md](./l1-operations.md)
   option A says "about 50 operations". The
   [L1 design](./l1-design.md#the-operations) has the real table, so the
   count can be exact or dropped.
7. **Which VM is which.** The other notes call today's Rust runtime
   NaNVM. [modular-runtime.md](./modular-runtime.md#two-vms-any) calls it
   the "Naive" VM and the NaN-boxing one "upcoming", and says "we have
   based the first WASM runtime on that implementation", which reads as
   done. One sentence mapping the names would help.
8. **A byte in a local.** The CPU-saving String module "claims one byte
   stack frame" for the length. WASM locals are at least `i32`, so the
   smallest slot is 4 bytes. [modular-l0.md §6](./modular-l0.md#6-a-manifest-per-module)
   now gives slots as `i32`, `i64` or `f64` locals.
9. **A status per choice.** The [L0 design](./l0-design.md) header lists
   §22 and §13 as the only decided choices, while §2 and §16 carry notes
   tied to the 2026-11-09 decisions. A one-line status on each choice
   would say this more clearly.

## Design gaps

### The CPU-saving `at` cannot index locals at run time

A WASM local index is an immediate, so `at(s, i)` with a run-time `i`
cannot pick one of 8 unit locals directly. It needs a `br_table` or a
chain of `select`s, which may cost more than the decoding it saves. Two
layouts avoid it:

- pack the units into two `i64` locals, four 16-bit units each, and
  answer `(slot >> (16 * (i & 3))) & 0xFFFF`, choosing the `i64` by
  `i < 4`;
- keep the 6-bit or 7-bit codes packed as in the NaN payload, and decode
  one unit with a shift, a mask and a small table.

The second is close to the memory-saving module, which suggests measuring
before keeping two NaN String modules.

### What a runtime may do while a value is borrowed

A Naive or long-string slot holds a raw pointer into the runtime's heap.
It stays valid only if the runtime never moves or frees a string's storage
while its `any` is alive. Reference counting gives that today, and a
compacting collector later would not. One sentence of contract belongs in
[modular-runtime.md](./modular-runtime.md) or
[modular-l0.md](./modular-l0.md).

### The precondition of `unpack`

`unpack` assumes its `any` is a string. The IR does not track kinds
([IR choice 2](./ir-design.md#2-seven-types-and-the-ir-does-not-track-a-values-kind)),
so its validator cannot check this. Either the lowering emits `unpack`
only after a `kind` test, or where the closure rule proves the type, or
`unpack` traps on a non-string, as L0 misuse does
([L0 design §11](./l0-design.md#11-misuse-traps-and-only-calls-fail)).
A trapping template costs a test on every unpack.

### One rule for BigInt and later types

[modular-l0.md](./modular-l0.md#the-code-ir) says a BigInt template form
would follow `str`: the module declares a type and its rows, and the IR
names them. That rule is still a sentence. Deciding it before the second
case avoids an eighth hard-coded IR type.

### How strings are made

The String module only reads. `concat`, `substring`, `join` and literals
go through import-form functions and produce an `any`. Two consequences
are worth writing down: a literal is known at compile time, so its `str`
could be a constant with no `unpack`; and a loop that builds a string
never benefits from the module.

### How the String experiment is measured

[modular-runtime.md](./modular-runtime.md) compares three String modules
on speed and memory, but does not yet say on what corpus, with which
metrics (instructions, peak memory, code size), or how a program picks
its modules (a build flag, the manifest, the loader).

## Structure of the folder

- **Fold each proposal note into its design.** Three pairs say much the
  same thing twice: [l0-core](./l0-core.md) and [l0-design](./l0-design.md),
  [l1-operations](./l1-operations.md) and [l1-design](./l1-design.md),
  [l2-stock-runtime](./l2-stock-runtime.md) and [l2-design](./l2-design.md).
  Moving the option tables into the designs' "Alternatives" lines would
  leave one note per layer and remove most stale statements above. A
  lighter option is a banner on each proposal note: "historical, see the
  design".
- **A status line on every note.** "Decided" lives in the README table,
  some headers, and some first lines. A fixed first line, such as
  *Status: decided 2026-11-04* or *Status: proposed*, would let a reader
  trust a section without the README.
- **"Module" means four things.** A WASM module, a FunctionalScript
  module, the stock runtime module, and a runtime module with a manifest.
  Another word for the last (a runtime *component* or *pack*) would help.
- **Choice numbers collide.** L0 design §13 is errors, IR choice 13 is
  `str`, and modular-l0 has its own numbering. Prefixing references (L0
  §13, IR 13, ML0 7) avoids ambiguity.
- **A glossary.** A short one in the [README](./README.md) for `any`,
  typed or unpacked value, slot, offset, fragment, template, manifest,
  import form, template form, portable and specialized.
- **The modular runtime memo's shape.** Once its parts settle, it could
  split into a decided part (what the README records) and an open part
  (the experiment plan, the CPU-saving layout).
- **Where the IR code lives.** The [IR design](./ir-design.md#where-this-draft-is-least-sure)
  proposes `fjs/codegen/ir`, while the runtime lives in
  `fjs/wasm/runtime`. Deciding before IR step 1 avoids a move PR later.
