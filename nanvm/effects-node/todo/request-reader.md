## A request reader for `Native::dispatch`

**Priority:** P4
**Status:** open

### Problem

Every arm of `Native::dispatch` in [`src/native.rs`](../src/native.rs) reads
its arguments the same way:

```rust
"stat" => {
    arity(payload, 1)?;
    let path = decode_string(argument(payload, 0, "path")?)?;
    Ok(answer(files::stat(&path), encode_stat))
}
"access" => {
    arity(payload, 1)?;
    let path = decode_string(argument(payload, 0, "path")?)?;
    Ok(answer(files::access(&path), encode_nothing))
}
```

At `c162c3a` the arity check appears in about two dozen arms and the
decode-a-path line in about fourteen. The arity check is a separate statement
an arm can omit, and the argument's index, its name and its decoder are three
facts an arm states separately where one accessor could carry them. The
`codec.rs` readers (`arity`, `argument`, `optional_argument`, `decode_*`) are
the right primitives; what is missing is the thing that holds them together
for one request.

### Proposal

A `Request<'a, A>` in [`src/codec.rs`](../src/codec.rs), constructed once per
arm with the parameter count so the arity check cannot be skipped, and typed
accessors over it:

```rust
let r = Request::new(payload, 1)?;
let path = r.string(0, "path")?;
```

with `string`, `bytes`, `number`, `choice`, `optional` and the like. An arm
then says which operation it is and how its answer is encoded, and nothing
about how a request is read. The one-path file operations — `stat`,
`access`, `rmdir`, `rm`, `readFile`, `createExclusive` and the rest — could
further become rows of a `(command, fn(&str) -> Result<T, IoError>, encoder)`
table, hand-written, per the no-`macro_rules!` rule.

### Tasks

- [ ] `Request` with its unit tests, beside the readers it wraps.
- [ ] `dispatch`'s arms over it; the parity corpus still passes.
- [ ] Decide whether the one-path operations become a table.

### Related

- [filesystem-error-codes](./filesystem-error-codes.md) — the answer side of
  the same arms.
- [nanvm-effects-node-operations](../../../todo/nanvm-effects-node-operations.md)
  — the operations the dispatcher serves.
