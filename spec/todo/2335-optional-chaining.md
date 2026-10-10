# Optional chaining

**Priority:** P2
**Status:** open — required linked language-design approval is not recorded

The compiler already accepts optional chaining: the grammar, syntax reader,
name/key checks, EDAG lowering and FunctionalScript writer were merged in
[#2660](https://github.com/functionalscript/functionalscript/pull/2660),
[commit `5774062e6`](https://github.com/functionalscript/functionalscript/commit/5774062e61f7d4f4bb9b9047a5efa53ca7e6281a).
That change also added the current rules to the
[language specification](../README.md#optional-chaining), with proofs in
[`parser`](../../fjs/compiler/parser/proof.f.mjs) (`optional`),
[`edag`](../../fjs/compiler/edag/proof.f.mjs) (`chains`) and
[`serializer`](../../fjs/compiler/serializer/proof.f.mjs) (`chains`).
This record remains open because the required approval evidence is missing.
Compiler support does not establish language-design approval; the proposal
below preserves the original motivation and design.

```js
export default (a) => [a?.b, a?.["b"], a?.(1), a?.b.c(2)];
```

## Problem and proposal

When this proposal was written, the compiler refused JavaScript's optional
chaining, although about twenty `module.f.mjs` modules used it, most as the
guarded call
`f?.(…)`, some as the guarded read `a?.b`, a few as `a?.[k]`
([`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md)
counted it among what held two leaves). The implemented feature follows ECMAScript:

- `a?.b` and `a?.[k]` — a property access whose key is what `a.b` and `a[k]`
  take, a name, a constant or the conversion `a?.[Number(i)]`
  ([property access](../README.md#property-access));
- `a?.(…)` — a call;
- the steps after one — `.c`, `[k]`, `(…)`, `?.c`, `?.(…)` — read as
  JavaScript reads a chain: when the value before `?.` is `null` or
  `undefined` the whole chain is `undefined` and nothing after the `?.` is
  evaluated; otherwise the step is the ordinary one, a receiver kept for a
  call as `a.b(c)` keeps it.

Parentheses end a chain, as in JavaScript: `(a?.b).c` reads `c` of
`undefined` and throws under a nullish `a`, where `a?.b.c` is `undefined`.

The graph already spelled all of this. The EDAG had the `?.` and `?.()` nodes
and the `|?.()` and `|!()` steps, with the proof that every spelling has one
shape and the host engine agrees
([`fjs/edag/README.md`, Chains](../../fjs/edag/README.md#chains)); the Rust
writer printed them and `nanvm-lib`'s lambda ran them. What was missing was in
front of the graph and behind it: the grammar, the syntax reader, the fold
that resolves names and judges keys, the lowering, and the FunctionalScript
writer that spells a graph back as text. Those pieces are now implemented,
as the proofs and completed tasks record.

## Benefits and drawbacks

**Benefits.** The construct is JavaScript's, harmless, and in use
([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)):
refusing it costs a `x === undefined ? undefined : x.y` at every site, which
evaluates `x` twice unless a `const` is spent on it. The graph cost is paid:
no new node, and the two writers that print a graph for an engine already
spell it. The language's own rules carry over unchanged — a key is judged as
`a.b`'s is, a prohibited prototype name refused as a read and allowed as a
call, `length` the exception; a call keeps its receiver as `a.b(c)` does.

**Drawbacks.** Parentheses become observable in one place. Before optional
chaining, a group was no node of its own and nothing downstream could tell one
was written; with
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
That records implementation authorization. The proposer is the implementation
agent. [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires formal, explicit approval from another language designer before
implementation, with a link to that approval. The
[implementation discussion](https://github.com/functionalscript/functionalscript/pull/2660#discussion_r4214191999)
recorded the missing approval, and the
[approving review](https://github.com/functionalscript/functionalscript/pull/2660#pullrequestreview-5451767338)
explicitly excluded language-design approval. #2660 merged with the approval
task still unchecked. This chronology is not claimed compliant with the rule;
neither the implementation request nor the merge supplies the missing record.

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
- [x] The compiler pages' shared examples offer an optional chain,
      `fjs/compiler/examples/module.f.js`, and the EDAG page draws a chain
      as the one node it is, its region on the edges, `fjs/compiler/edag/demo.f.mjs`.
- [x] The specification describes the feature
      ([optional chaining](../README.md#optional-chaining)); the roadmap's
      entry and the survey's rows are reread.
- [ ] Locate and link explicit pre-implementation language-design approval from
      `sergey-shandar`; if no such record exists, obtain and record the
      designer's resolution of this approval-process gap for the merged feature.

## Related

- [`fjs/edag/README.md`, Chains](../../fjs/edag/README.md#chains) — the
  nodes, the steps, and why a group is a boundary.
- [`fjs/compiler/todo/compile-modules-to-edag.md`](../../fjs/compiler/todo/compile-modules-to-edag.md)
  — the implemented lowering and chain-boundary rules within the staged rollout.
- [`optional-chain-before-digit.md`](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md)
  — the token before a digit.
- [`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md) —
  historical leaf blockers and current migration progress.
