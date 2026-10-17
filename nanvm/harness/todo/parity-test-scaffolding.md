## `parity.rs` and `console.rs` copy the fixture loop

**Priority:** P4
**Status:** open

### Problem

`tests/parity.rs` and `tests/console.rs` each define `type V`, `fn member`,
`fn names`, and the same loop over a fixture's cases: take `run` from the
exports, call it, build a `Native` host, `run(effect, |c, p| host.perform(c,
p))`, destructure `[tag, answers]`, assert `ok`, compare `to_json` with the
expectation. `parity.rs` also carries a `Scratch` temp-directory guard. A
third fixture is a third copy of the loop.

```rust
// both files, identical
fn member(object: &Object<Naive>, name: &str) -> V { object.own_property(&name.into()).unwrap() }
fn names(exports: &Object<Naive>) -> Vec<String> { exports.own_entries().into_iter().map(|(key, _)| key.into()).collect() }
```

### Proposal

`tests/common/mod.rs` — or a `pub mod host` in `src/`, since
`nanvm-effects-node` is already a dev-dependency — with `member`, `names`,
`Scratch` and `perform_case(host, effect) -> Any<Naive>`, which runs the
effect, checks the tag and answers the answers. The two tests keep what
differs: the stdin bytes, the stdout and stderr asserts. The JavaScript twins
in [`fjs/nanvm/parity`](../../../fjs/nanvm/parity/proof.mjs) are short and
not the subject here.

### Tasks

- [ ] The shared module; both tests reduce to their differences.

### Related

- [document-nanvm-harness](./document-nanvm-harness.md) — the harness's
  docs, which the shared module is part of.
- [scratch-directory-guard](../../effects-node/todo/scratch-directory-guard.md)
  — the same guard inside `effects-node`.
