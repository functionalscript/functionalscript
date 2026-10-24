# EDAG to Rust

The entry from an EDAG into the Rust writer. [`module.f.mjs`](./module.f.mjs)
converts a graph to the Foundation AST once and prepares it; how each
construct is spelled in Rust lives in
[`fjs/rust/serializer`](../../rust/serializer/module.f.mjs).

`fjs compile input.f.js output.rs` reaches this module: the compiler lowers
the source to an EDAG, this module admits it, and the serializer writes a Rust
module that calls the `nanvm-lib` API. The NaNVM demos build that Rust to
WebAssembly ([`fjs/nanvm`](../../nanvm/README.md)).

Inputs are immutable, shape-checked EDAG data. The named values of the
compiled corpus enter as bindings that already exist, and a fragment keeps the
invocation environment it was given.
