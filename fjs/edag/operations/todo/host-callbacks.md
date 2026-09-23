## Host built-ins that call a closure are the executor's to implement

**Priority:** P2
**Status:** open

### Problem

A function value is a closure record — the captured frame, the body graph
and `length` — and a call of one is the executor's `call`, never a
JavaScript call ([`../module.f.mjs`](../module.f.mjs)). The language admits
method calls on built-ins that take a callback — `map`, `filter`, `reduce`,
`find`, `findIndex`, `some`, `every`, `flatMap` on an array, `replace` and
`replaceAll` on a string, among the names `fjs/js/prototype` does not
prohibit — and the operations table hands such a call to the host with its
arguments as they are. The host cannot call a record, so `[1].map(f)` is the
host's `TypeError` today: a refusal, pinned as `throw.hostCallback` in
[`../../amnesia/proof.f.mjs`](../../amnesia/proof.f.mjs), and not a wrong
value, but not the language's answer either.

A string method handed a closure where it expects a string — `replace`'s
second argument, `join`'s separator — coerces the record to
`"[object Object]"` where JavaScript coerces a function to its source text.
Neither is a value the language fixes: a function's string form is engine
specific ([`../../../nanvm/proof.f.mjs`](../../../nanvm/proof.f.mjs)'s
`functionToString`), so that difference is outside the guarantees.

### Proposal

The callback-taking built-ins are the executor's, as they are NaNVM's: one
table of the admitted methods and the argument positions they call, in
`fjs/js/prototype` beside the name tables, and an implementation over
`call` in the operations table, so that `[1, 2].map(f)` invokes `f` per
element through the executor. Until then the host's `TypeError` stands as
the refusal.

### Tasks

- [ ] The callback positions of every admitted built-in method, as data in
  `fjs/js/prototype`, shared with NaNVM's implementation of the same methods.
- [ ] The operations table runs those methods itself when an argument in a
  callback position is a closure.
- [ ] `throw.hostCallback` becomes a value case.
