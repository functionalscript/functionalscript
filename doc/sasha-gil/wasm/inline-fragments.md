# Inline fragments

**Proposed.** A runtime may offer small pieces of WASM that the compiler
inlines into a program in place of a call to the runtime. This is how an
opaque `any` ([l0-core.md](./l0-core.md#values)) is made nearly free on a
runtime whose encoding is cheap to read.

## Where it pays

| Layer | Example | Gain |
| --- | --- | --- |
| L0 | NaNVM's `kind`, `to_f64`, `from_f64`, `dup`, `drop` | High: each is a few instructions, and these are the costs an opaque `any` adds |
| L1 | A fast path: if both operands are numbers, `f64.add`, else call `+` | Medium: the common case skips the call |
| L2 | Statics and member bodies | Low: the functions are large, and a call costs little next to them |

## Form

A fragment is a small exported function of the runtime's own `.wasm`,
named in a custom section, for example `fjs.inline`. No new format is
needed: [`fjs/media/wasm`](../../../fjs/media/wasm/README.md) already parses
and writes modules, so the compiler reads the runtime module, takes the
bodies of the listed functions, and splices them in. A fragment's
parameters become locals of the caller.

## Rules

- **Reach.** A fragment uses only what the program can reach too: the
  runtime's memory and globals, which the program imports, and other runtime
  functions, which become imports of the program.
- **Two modes.** A *portable* program imports everything and runs on any
  runtime. A *specialized* program has fragments inlined and is compiled for
  one runtime and version. This is the same trade as choosing the WASM type
  of `any` per runtime, and the two are decided together.
- **Equivalence.** A fragment behaves exactly as the function it replaces.
  The conformance run covers both modes.

## Our own linker first

The inliner is ours, built on `fjs/media/wasm`, so that no external
toolchain sits on the path from FunctionalScript to WASM. Binaryen
(`wasm-merge` and `wasm-opt`) may be tried later, to compare its results
with our design decisions and to offer an alternative pipeline.

## Open

- How small must a fragment be, and who decides: the runtime by listing
  it, or the compiler by a size limit?
- Whether a fragment may contain loops and branches, or only straight-line
  code.
- How a specialized program records the runtime and version it was compiled
  for, so that a loader refuses a mismatch.
