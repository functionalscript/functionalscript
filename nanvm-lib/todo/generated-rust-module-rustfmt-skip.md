## generated-rust-module-rustfmt-skip. Skip rustfmt once for the generated module

**Priority:** P4
**Status:** open

### Problem

`fjs/nanvm/rust/module.f.mjs` currently emits `#[rustfmt::skip]` before `eq`
and each generated per-operation function in
`nanvm-lib/tests/test/generated.rs`. The final `all` function is not currently
annotated.

The whole module is generated and intentionally uses one statement per test
case. Formatting those generated functions is therefore not useful, and
repeating the attribute at every function-emission site adds generated noise.

The per-function skips are still necessary today: removing them without a
replacement causes `cargo fmt` to rewrap generated assertions and destroys the
one-statement-per-case layout.

This follows the post-merge review comment on #1489 to make the formatting skip
global for the generated module.

### Proposal

Do not use an inner `#![rustfmt::skip]` attribute inside `generated.rs`.
Custom tool attributes in inner position are unstable on stable Rust and make
`cargo check --tests` fail.

Instead, annotate the generated module declaration in the hand-written
`nanvm-lib/tests/test/main.rs`:

```rust
#[rustfmt::skip]
mod generated;
```

Then stop emitting the repeated `#[rustfmt::skip]` attributes from
`fjs/nanvm/rust/module.f.mjs`.

This keeps one formatting-policy declaration for the whole generated module
while remaining valid on stable Rust. The attribute belongs to `main.rs`, not
to the generated file, so the generator should only stop emitting its
per-function attributes; it should not try to emit a replacement inner
attribute.

A module-wide skip also covers `generated::all`, which is currently the one
generated function without a `#[rustfmt::skip]` attribute. That broader skip is
intentional: the entire module is generated and should be left byte-for-byte in
the layout chosen by the generator.

### Tasks

- [ ] Add `#[rustfmt::skip]` to the `mod generated;` declaration in
      `nanvm-lib/tests/test/main.rs`.
- [ ] Stop emitting `#[rustfmt::skip]` before `eq` and individual generated
      operation functions.
- [ ] Do not emit `#![rustfmt::skip]` inside `generated.rs`.
- [ ] Update comments/documentation in `fjs/nanvm/rust/module.f.mjs` to describe
      the module-level formatting policy owned by `main.rs`.
- [ ] Update the Rust generator proof if its expected output covers these
      attributes.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs` with `npm run ci-update`.
- [ ] Verify a second `npm run ci-update` leaves the tree unchanged.
- [ ] Run `fjs test`, `cargo check --tests`, `cargo test`, and
      `cargo fmt -- --check`.

### Related

- #1489 — introduced the generated shared operator tests.
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770843238
