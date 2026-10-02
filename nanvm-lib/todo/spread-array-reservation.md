## spread-array-reservation. `spread_array` can abort the process on a length it cannot allocate

**Priority:** P3
**Status:** open

### Problem

The spread helpers that [spread-operations](./spread-operations.md) adds to
`nanvm_lib::vm::unstable` (`spread_array`, in the pull request that prints an
array and a call spread) bound the result's length against JavaScript's limit,
`2³² − 1` elements, and then reserve the whole of it before building anything:

```rust
if at_least > limit { return Err(TOO_LONG.into()); }
let mut values = Vec::with_capacity(at_least as usize);
```

A length under the limit that the machine cannot back passes the check and the
reservation aborts the process. One 65,537-element array spread 65,535 times is
exactly `2³² − 1` elements, and the run dies with

```
memory allocation of 103079215080 bytes failed
```

from `handle_alloc_error`: an abort, not a `Result`. A program that
`sandbox` runs cannot capture it, and it is not the outcome JavaScript gives,
a `RangeError` or an out-of-memory throw. The specification's
[failure rule](../../spec/README.md#failure-is-one-outcome) counts a throw and
a memory failure as one outcome, so an abort that no caller can observe as a
failure is a gap in it, not a different kind of failure.

The reservation is the only place the count is trusted. The same abort is
reachable from any `nanvm-lib` operation that sizes an allocation from a count
the program controls; the general answer is
[131-non-panicking-allocator](./131-non-panicking-allocator.md), and this file
is the narrow case that should not wait for it.

### Proposal

Do not reserve more than the arrays can back, and fail through a `Result`
where the allocator cannot give what was asked:

- `Vec::try_reserve(at_least)`, answering the `RangeError` the helper already
  uses (`TOO_LONG`) or a dedicated allocation error when it fails; or
- reserve `min(at_least, bound)` and let the `Vec` grow, which still aborts on
  a genuine out-of-memory but not on a count no spread could fill.

The first is the honest one: the result is an operation's `Result` already, so
the failure has a place to go. The per-element backstop (`values.len() ==
limit`) stays.

### Tasks

- [ ] A test that spreads one `2¹⁶ + 1`-element array `2¹⁶ − 1` times and
      expects an `Err`, not an abort. It must run with a bounded address space
      or be skipped where the machine really can back the length.
- [ ] Reserve through `try_reserve` and return the error.
- [ ] Check the same pattern in the other helpers and in `array/create.rs`.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [spread-operations](./spread-operations.md) — the design these helpers
  implement.
- [131-non-panicking-allocator](./131-non-panicking-allocator.md) — the
  general allocation-failure channel.
- [array-deep-nesting](./array-deep-nesting.md) — the other way a deep or wide
  value aborts the process.
