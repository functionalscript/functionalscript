# WASM Demos

FunctionalScript runs two ways: as the JavaScript it already is, and compiled
by `fjs compile` to Rust on the NaNVM runtime, then to WebAssembly. These
pages run the same source both ways, side by side, and show every step in
between: the source, the Rust, and the WebAssembly text (WAT) of the
functions compiled from it. The design is in
[`todo/wasm-demos.md`](../../../todo/wasm-demos.md).

## Programs

Each of these pages runs a whole program, which writes to standard output,
and compares what each run wrote and how long it took.

- [Hello, world](./hello/README.md): the smallest program, a greeting
  written byte by byte.
- [Sorting](./sort/README.md): a quicksort of 100,000 integers, which
  allocates as it goes.
- [Collatz](./collatz/README.md): the longest Collatz chain below 30,000,
  arithmetic with no allocation.

## Language Features

Every feature page of the [language specification](../../../spec/README.md)
whose status is "implemented" runs its own example the same way: the page
shows the expression graph (EDAG) the example lowers to, the Rust, the WAT,
and a Run button that calls the example with the inputs its page lists, as
JavaScript and as WebAssembly. The [comma operator](../../../spec/operators/comma/README.md)
was the first. The constructs FunctionalScript refuses have pages of their
own, listed in each area of the specification, and the ones not yet decided
are on the [Undecided](../../../spec/undecided/README.md) page.

## How the Pages Are Built

- [`samples`](./samples/module.f.mjs) lists every sample, with the calls a
  feature page makes and the answers JavaScript gives.
- `npm run gen` compiles each sample to `nanvm/demos/gen.samples/<name>.rs`,
  committed, with a Rust test per listed call, so the two runs a page
  compares are tested before it is deployed.
- The deployment build (`gen.cloudflare/build.sh`) builds the `nanvm-demos`
  crate for `wasm32` and prints each sample's WAT. Neither is committed.
