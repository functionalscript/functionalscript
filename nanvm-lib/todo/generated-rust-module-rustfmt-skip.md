## generated-rust-module-rustfmt-skip. Skip rustfmt once for the generated module

**Priority:** P4
**Status:** open

### Problem

`fjs/nanvm/rust/module.f.mjs` currently emits `#[rustfmt::skip]` before every
generated function in `nanvm-lib/tests/test/generated.rs`.

The whole file is generated and intentionally uses one statement per test case.
Formatting individual functions is therefore not useful, and repeating the
attribute for every function adds generated noise and requires the printer to
remember the same policy at each function-emission site.

This follows the post-merge review comment on #1489 to make the formatting skip
global for the generated module.

### Proposal

Emit one inner attribute at the top of the generated Rust module:

```rust
#![rustfmt::skip]
```

Then remove the repeated outer `#[rustfmt::skip]` attributes from `eq` and the
per-operation generated functions.

The generated file should remain readable and deterministic, with one statement
per case, while `cargo fmt -- --check` continues to accept the repository.

### Tasks

- [ ] Emit `#![rustfmt::skip]` once near the top of
      `nanvm-lib/tests/test/generated.rs`.
- [ ] Stop emitting `#[rustfmt::skip]` before individual generated functions.
- [ ] Update comments/documentation in `fjs/nanvm/rust/module.f.mjs` to describe
      the module-wide formatting policy.
- [ ] Update the Rust generator proof if its expected output covers these
      attributes.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs` with `npm run ci-update`.
- [ ] Verify a second `npm run ci-update` leaves the tree unchanged.
- [ ] Run `fjs test`, `cargo test`, and `cargo fmt -- --check`.

### Related

- #1489 — introduced the generated shared operator tests.
- #1489 review: https://github.com/functionalscript/functionalscript/pull/1489#discussion_r3770843238
