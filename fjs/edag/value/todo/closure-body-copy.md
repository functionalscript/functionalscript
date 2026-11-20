## A closure copies its body every time it is made

**Priority:** P2
**Status:** open

### Problem

[`func`](../function/module.f.js) builds a function value from its
captures and its body, and copies the body's graph each time, so that two
functions made from one arrow share no node
([`../../values.md`](../../values.md)). The copy keeps what it has already
copied in a list searched from the start (`assoc`), so one copy takes a
number of steps that grows with the square of the body's size.

A function that makes a closure at each step, a callback written inline or
a loop written as a function calling itself, pays it at each step.
Interpreting `fjs/ci/module.f.js` with [`memo`](../../memo/README.md) at
`2ae0f18`, about 48 s: 760,195 bodies copied for 493 different functions,
`func` taking 21% of the time, and garbage collection, which the copies
feed, another 17%.

### What a fix has to settle

- **Who needs the copy.** Since `2ae0f18` `memo` keeps a call's values by
  node for the length of that call and no longer, so two calls of two
  functions that share a body do not meet there. Whether anything else
  reads a body's nodes as that function's own: the serializers, which find
  sharing by identity and would see one node under two functions, and
  [`amnesia`](../../amnesia/README.md).
- **Copy where it is needed.** If only writing a value out needs distinct
  bodies, the copy can be made there, once for each function written, and
  not where the function is made.
- **A cheaper copy.** Failing that, the copies kept in a
  [reference map](../../../types/ref_map/module.f.js) in place of the list
  make one copy `O(n log n)`.

### Tasks

- [ ] Find every reader that depends on two functions having distinct body
  nodes, with a proof case for each.
- [ ] Move the copy to those readers, or make it cheaper.
- [ ] Time `fjs/ci/module.f.js` and the whole compiler again.

### Related

- [Host values](../../todo/host-values.md#where-the-time-goes) — the
  profile this comes from, and the wider options.
- [Constructors take values](./constructors-take-values.md).
