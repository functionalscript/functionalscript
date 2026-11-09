## Host crates import `vm::unstable`

**Priority:** P3
**Status:** open

### Problem

[`vm/unstable`](../src/vm/unstable/README.md) says what it is for: helpers
the compiler's printers call from generated code, "not part of the crate's
API", free to change, move or disappear in any release. Every hand-written
host crate imports it anyway. At `d7bead6`:
[`nanvm/effects-node`](../../effects-node/src/native.rs)'s `native.rs`,
`files.rs` and `codec.rs` take `number_text`, `string_any`, `string_key`
and `bigint_any_words`; [`nanvm/demos`](../../demos/src/lib.rs) takes
`string_any`; the harness's integration tests take `string_any`; and
`nanvm/lib`'s own `tests/` take `strict_eq` and more.

What they need is small. `string_any` and `string_key` are `.into()` with
`A` fixed by the call site's return type; `bigint_any_words` is
`BigInt::normalize_new(sign, words).to_any()` with a `bool` for the sign;
`number_text` is the only public spelling of a number as text, because
`string_coercion::number_text` is `pub(crate)` and asks for an `A` it uses
only to tie-break against `BigInt<A>`. The README itself names the exit: "a
helper that keeps earning its calls is a candidate for the `vm` API
proper". One module serves two audiences, and the runtime audience's
stability hangs on a module that reserves the right to vanish.

### Proposal

Give the earned pieces a stable home in `vm`: `number_text` as a documented
export of `vm/number` or `vm/string_coercion`, with the `Naive`-pinned
convenience `files.rs` needs, since it has no `A`; host code writes
`x.into()` where it wrote `string_any(x)` and `string_key(x)`, and
`codec.rs`'s `encode_bytes` builds its `BigInt` directly. `unstable` then
keeps only what generated code calls. `nanvm/lib/tests` may keep its
imports: that harness is the corpus printer's twin by design.

### Tasks

- [ ] `number_text` as a `vm` export.
- [ ] `effects-node`, `demos` and the harness tests off `unstable`.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`unstable/todo/object-entries-runtime-binding`](../src/vm/unstable/todo/object-entries-runtime-binding.md)
  — the module's one open issue, about what it owes generated code.
