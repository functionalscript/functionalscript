# WASM Demos

FunctionalScript runs as the JavaScript it already is, and compiled by
`fjs compile` to Rust on the NaNVM runtime, then to WebAssembly. These
pages run the same source both ways, side by side, and show every step in
between: the source, the Rust, and the WebAssembly text (WAT) of the
functions compiled from it. [Sorting](./sort/README.md) and
[Collatz](./collatz/README.md) also run a third route: IR `from_fast` +
`linkAny` emitted directly to WebAssembly on NaNVM L0. The design is in
[`todo/wasm-demos.md`](../../../todo/wasm-demos.md).

## Programs

Each of these pages runs a whole program, which writes to standard output,
and compares what each run wrote and how long it took.

- [Hello, world](./hello/README.md): the smallest program, a greeting
  written byte by byte.
- [Sorting](./sort/README.md): a quicksort of 100,000 integers, which
  allocates as it goes (JS, Rust→WASM, and IR→WASM).
- [Collatz](./collatz/README.md): the longest Collatz chain below 30,000 —
  JS and Rust→WASM stay allocation-free (number handling alone); the IR→WASM
  route uses records so `from_fast` can lower the loop.

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

- [`samples`](./samples/module.f.js) lists every sample, with the calls a
  feature page makes and the answers JavaScript gives.
- `npm run gen` compiles each sample to `nanvm/demos/gen.samples/<name>.rs`,
  committed, with a Rust test per listed call, so the two runs a page
  compares are tested before it is deployed.
- `nanvm/demos/gen.build.sh`, which `npm run gen` writes, builds the
  `nanvm-demos` crate for `wasm32` into `nanvm/demos/wasm/`, writes
  each sample's WAT and its Rust, both marked for colouring, beside it,
  then builds `nanvm-l0-wasm` and emits the IR programs for sort and
  Collatz (`*.ir.wasm` plus `nanvm_l0_wasm.wasm`). All are ignored build
  artifacts. Cloudflare builds them before generating the website.
  For a local website build, first run
  `./dev.sh sh ./nanvm/demos/gen.build.sh`, then `npm run website`.
