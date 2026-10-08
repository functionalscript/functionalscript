# Optional chaining

**Priority:** P2
**Status:** wip — implementation complete; linked language-design approval pending

```js
export default (a) => [a?.b, a?.["b"], a?.(1), a?.b.c(2)];
```

## Problem and proposal

JavaScript's optional chaining is refused by the compiler, and the repository
writes it: about twenty `module.f.mjs` modules use it, most as the guarded call
`f?.(…)`, some as the guarded read `a?.b`, a few as `a?.[k]`
([`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md)
counts it among what holds two leaves). Admit it as ECMAScript reads it:

- `a?.b` and `a?.[k]` — a property access whose key is what `a.b` and `a[k]`
  take today, a name or a constant; a key computed at run time waits on the
  same step `a[i]` waits on ([property access](../README.md#property-access));
- `a?.(…)` — a call;
- the steps after one — `.c`, `[k]`, `(…)`, `?.c`, `?.(…)` — read as
  JavaScript reads a chain: when the value before `?.` is `null` or
  `undefined` the whole chain is `undefined` and nothing after the `?.` is
  evaluated; otherwise the step is the ordinary one, a receiver kept for a
  call as `a.b(c)` keeps it.

Parentheses end a chain, as in JavaScript: `(a?.b).c` reads `c` of
`undefined` and throws under a nullish `a`, where `a?.b.c` is `undefined`.

The graph already spells all of this. The EDAG has the `?.` and `?.()` nodes
and the `|?.()` and `|!()` steps, with the proof that every spelling has one
shape and the host engine agrees
([`fjs/edag/README.md`, Chains](../../fjs/edag/README.md#chains)); the Rust
writer prints them and `nanvm-lib`'s lambda runs them. What is missing is in
front of the graph and behind it: the grammar, the syntax reader, the fold
that resolves names and judges keys, the lowering, and the FunctionalScript
writer that spells a graph back as text.

## Benefits and drawbacks

**Benefits.** The construct is JavaScript's, harmless, and in use
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)):
refusing it costs a `x === undefined ? undefined : x.y` at every site, which
evaluates `x` twice unless a `const` is spent on it. The graph cost is paid:
no new node, and the two writers that print a graph for an engine already
spell it. The language's own rules carry over unchanged — a key is judged as
`a.b`'s is, a prohibited prototype name refused as a read and allowed as a
call, `length` the exception; a call keeps its receiver as `a.b(c)` does.

**Drawbacks.** Parentheses become observable in one place. Today a group is
no node of its own and nothing downstream can tell one was written; with
`?.`, a group ends the short-circuit region, so `(a?.b).c` and `a?.b.c` are
two graphs. The syntax reader carries that bit while it folds a value's
steps, and the AST adopts the EDAG's own chain shapes for the optional case —
`['?.', base, key, step?]`, `['?.()', callee, args, step?]`, and a `.` node
carrying a `|?.()` step — so the AST holds nothing a group left behind. A
plain chain is unchanged: `a.b(c)` is still the call of an access until the
lowering makes it the method call, and a group around it is still nothing.


`?.` directly before a decimal digit stays the tokenizer's open question
([`optional-chain-before-digit.md`](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md)):
it is read as `?.` today, and `a?.5:1` is refused either way until `.5` is a
number.

## Authorization and approval

The language designer, `sergey-shandar`, asked in the session that produced
this proposal: "Let's implement optional chaining. Including `?.`, `?.()`".
That is the implementation authorization. The proposer is the implementation
agent, so the approval DESIGN.md §12 requires is the designer's own, distinct
from the proposer; a linked, explicit approval is still to be recorded here
before this lands, as [binary literals](./2470-binary-literals.md) records
its own.

## Tasks

- [x] The grammar's `access` takes `?.name`, `?.[key]` and `?.(args)`; the
      syntax reader folds a chain's steps into the EDAG's chain shapes and
      closes a region at a group; the fold resolves the names a chain holds
      and judges its keys; proofs in `fjs/compiler/parser`.
- [x] The lowering carries the chain nodes to the EDAG, the FunctionalScript
      writer spells them back, parentheses where a region closed; proofs in
      `fjs/compiler/edag`, `fjs/compiler/serializer` and `fjs/compiler`.
- [x] A Rust harness fixture runs a chain end to end,
      `nanvm-harness/fixtures/optional.mjs`.
- [x] The specification describes the feature
      ([optional chaining](../README.md#optional-chaining)); the roadmap's
      entry and the survey's rows are reread.
- [ ] Obtain and link explicit language-design approval from `sergey-shandar`.

## Related

- [`fjs/edag/README.md`, Chains](../../fjs/edag/README.md#chains) — the
  nodes, the steps, and why a group is a boundary.
- [`fjs/compiler/todo/compile-modules-to-edag.md`](../../fjs/compiler/todo/compile-modules-to-edag.md)
  — the lowering's open item for chain boundaries.
- [`optional-chain-before-digit.md`](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md)
  — the token before a digit.
- [`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md) —
  the leaves the feature holds.
