## `decode_result` is runtime API, not test support

**Priority:** P4
**Status:** open

### Problem

`decode_result` in [`codec.rs`](../src/codec.rs) reads a `['ok' | 'error',
value]` tuple back, and is gated `#[cfg(any(test, feature =
"test-support"))]` on the premise its doc states: "the runners never read
one back, so it is the tests' own". [`nanvm/demos`](../../demos/src/lib.rs)
is a runtime consumer, depends on this crate without the feature, and does
read one back, so its `output` writes the reader again, more loosely:

```rust
let tag = Array::try_from(result.clone()).ok().and_then(|items| items.into_iter().next());
if tag == Some(string_any("ok")) { Ok(stdout) } else { Err(result) }
```

which takes a one- or three-element array as `ok`, where `decode_result`
refuses it. `perform` in the same file builds `Native::new(std::io::empty(),
Vec::new(), Vec::new())` where `Native::buffered(&[])` is the constructor
for that.

### Proposal

Export `decode_result` and `Malformed` unconditionally, keeping
`test-support` for `Scratch` alone, and correct the doc and the feature's
comment in `Cargo.toml`. `output` matches on `decode_result(result)` and
`perform` uses `Native::buffered(&[])`.

### Tasks

- [ ] `decode_result` exported; `demos` over it.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [shared-test-support](./shared-test-support.md) — introduced
  `decode_result` as test support; this corrects its premise.
