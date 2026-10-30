# WebAssembly

`application/wasm`, read and written in FunctionalScript: an AST of a
module's sections, a binary parser and a binary writer. The WASM demo pages'
publisher ([`fjs-publish.md`](../../nanvm/demos/todo/fjs-publish.md)) is
their first user, and none of them depends on it.

| Module | What it does |
| --- | --- |
| [`types.ts`](./types.ts) | The AST |
| [`instruction`](./instruction/module.f.mjs) | The opcode table every module below reads |
| [`binary/parse`](./binary/parse/module.f.mjs) | Bytes to the AST, or an error naming the byte |
| [`binary/write`](./binary/write/module.f.mjs) | The AST to bytes |

## Scope

The WebAssembly 2.0 core instruction set without the vector (SIMD)
instructions, which holds every instruction Rust 1.99 emits into the demo
module. Anything outside it is refused, never skipped.

## Round trip

`parse(write(m))` is `m`, and `write` depends on the module alone. The
bytes need not survive `write(parse(bytes))`: the writer is canonical
(shortest LEB128, shortest element encoding, no empty sections) and
`wasm-ld` is not, so the 1,007,871-byte demo module comes back as 962,789
bytes that `wasmprinter` prints identically.
