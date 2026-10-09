## spread-array-reservation. `spread_array` can abort the process on a length it cannot allocate

**Priority:** P3
**Status:** open

### Problem

`spread_array`, which [spread-operations](./spread-operations.md) added to
`nanvm_lib::vm::unstable` for an array literal and a call's arguments with a
spread, bounds the result's length against JavaScript's limit,
`2³² − 1` elements, and then reserve the whole of it before building anything:

```rust
if at_least > limit { return Err(error::array_too_long()); }
let mut values = Vec::with_capacity(at_least as usize);
```

A length under the limit that the machine cannot back passes the check and the
reservation aborts the process. One 65,537-element array spread 65,535 times is
exactly `2³² − 1` elements, and, at revision `f10b277` of `main`, the run dies
with

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

Fail through a `Result` wherever the allocator cannot give what was asked, on
**every** path that grows the result, not only the first reservation: the
lower bounds of the iterators are exact for an array, so a smaller initial
capacity would not make a 103 GB result fillable, and each later `push` would
abort at its own growth step.

- `Vec::try_reserve(at_least)` up front, answering the `RangeError` the helper
  already uses (`error::array_too_long`) or a dedicated allocation error when it fails;
- and a fallible reservation, `try_reserve(1)` or a chunked
  `try_reserve(chunk)`, before any `push` that can grow past what was reserved,
  which is only the per-element backstop for a string spread, whose length the
  lower bound undercounts.

The result is an operation's `Result` already, so the failure has a place to
go. The per-element backstop (`values.len() == limit`) stays.

### Tasks

- [ ] A test that spreads one `2¹⁶ + 1`-element array `2¹⁶ − 1` times and
      expects an `Err`, not an abort. It must run with a bounded address space
      or be skipped where the machine really can back the length.
- [ ] Reserve through `try_reserve` up front and before every growing `push`,
      and return the error.
- [ ] Check the same pattern in the other helpers and in `array/create.rs`.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [spread-operations](./spread-operations.md) — the design these helpers
  implement.
- [131-non-panicking-allocator](./131-non-panicking-allocator.md) — the
  general allocation-failure channel.
- [array-deep-nesting](./array-deep-nesting.md) — the other way a deep or wide
  value aborts the process.
