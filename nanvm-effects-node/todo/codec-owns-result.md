## The codec owns `ok` but not `error`

**Priority:** P4
**Status:** open

### Problem

[`codec.rs`](../src/codec.rs) is where the language's answer shapes are
spelled, and it exports `encode_ok` — `encode_tuple("ok", value)`. There is
no `encode_error`, so the other half of a `Result` is spelled by each
caller:

- `result` in [`common.rs`](../src/common.rs) matches `Ok` to
  `encode_tuple("ok", …)` — not `encode_ok` — and `Err` to
  `encode_tuple("error", …)`.
- `not_implemented` and `answer` in [`native.rs`](../src/native.rs) each
  build `encode_tuple("error", encode_tuple(kind, …))` by hand.

The decode side has the same shape in the tests. `native.rs`'s test module
has `ok`, `error_info` and `error_code` helpers, yet several of its tests
re-inline the two-element destructure those helpers perform; `items` is
defined once in [`lib.rs`](../src/lib.rs)'s tests and again in the
harness's [`effects.rs`](../../nanvm-harness/tests/effects.rs), and
[`parity.rs`](../../nanvm-harness/tests/parity.rs) destructures an `ok`
answer by hand.

### Proposal

- `encode_error` beside `encode_ok`, and `encode_result(Result<Any, Any>)`
  over both. `common::result` is then `encode_result`; `answer` is
  `encode_result(result.map(ok).map_err(encode_io_error))`; the
  `"ok"`/`"error"` strings are spelled in the codec alone.
- Add `TryFrom<Array<A>> for [Any<A>; N]` beside
  [`nanvm-lib`'s `Array`](../../nanvm-lib/src/vm/array/mod.rs), available in
  normal dependency builds. `nanvm-effects-node`'s `lib.rs` and `native.rs`
  unit tests and `nanvm-harness`'s integration tests can all use that lower
  dependency layer, without a reverse dependency or an import from another
  crate's `cfg(test)` module. The conversion checks the exact length and
  unpacks the fixed-size array; callers still assert the tag and decode the
  payload. Tagged-pair tests use `N = 2`.

### Tasks

- [ ] `encode_error` and `encode_result`; the listed callers onto them.
- [ ] The fixed-array conversion in `nanvm-lib`, proving exact-length
      success and length-mismatch refusal; migrate the pair decoding in
      `native.rs`, `lib.rs`, `effects.rs` and `parity.rs` onto it while
      retaining each test's tag and payload assertions.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.
