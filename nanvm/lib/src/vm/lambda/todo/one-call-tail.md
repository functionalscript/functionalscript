## One spelling of the member-call tail

**Priority:** P4
**Status:** open

### Problem

`Member::call` in [`member.rs`](../member.rs) is the ladder own property →
body → native method → `undefined.call`:

```rust
// Member::call
match self.own() {
    Some(callee) => callee.call(args),
    None => match self.body(runtime)? {
        Some(f) => f.call(args),
        None => match method(&self.receiver, &self.key) {
            Some(f) => f(self.receiver, Array::try_from(args)?),
            None => Any::undefined().call(args),
        },
    },
}
```

`Member::call_native` is the same match with the `body` layer removed. And in
[`mod.rs`](../mod.rs) the sequence
`m.resolve(runtime).and_then(|()| args()).and_then(|a| m.call(runtime, a))`
appears verbatim in `Region::call`, `PropertyLambda::end_call` and the live
arm of `OptionPropertyLambda::end_call`. The four-step algorithm
[member-functions](../../../../todo/member-functions.md) documents is written
twice; a change to argument ordering is made three times.

### Proposal

In `member.rs`, one private ladder that takes the body lookup deferred, so
the order stays what `call` documents — the own property is answered before
the runtime is asked, and a runtime whose `dot` throws never reaches an
object that shadows the name with its own function:

```rust
fn call_with(self, body: impl FnOnce(&Self) -> Result<Option<Any<A>>, Any<A>>, args: Any<A>) -> Result<Any<A>, Any<A>>
```

`call` passes `|m| m.body(runtime)`, `call_native` passes `|_| Ok(None)`;
`body` is only called in the `None` arm of `own()`, as today. In `mod.rs`,
`PropertyLambda::end_call` becomes
`Region::from(self.0).call(runtime, args).end()` — a `Result`-sourced region
is never `Skipped`, so `end` is exact — and `OptionPropertyLambda::end_call`
keeps only its `Skipped` arm special.

### Tasks

- [ ] `call_with`; `call` and `call_native` over it, with a test for an own
      function beside a throwing runtime `dot`.
- [ ] The two `end_call`s over `Region::call`.
