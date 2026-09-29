## function-text. The FunctionalScript evaluator renders its own function text

**Priority:** P3
**Status:** open

### Problem

`nanvm-lib` answers a function's text with the FunctionalScript writer's
rendering of its EDAG (`tryFunctionText` in `fjs/compiler/serializer`):
`() => undefined` is `()=>undefined`. `amnesia` makes a host function for a
`=>` node, so `String(f)` there is the host's source for that closure, not
the node's text. The two sides of the operator corpus disagree on every
case that shows a function's text, so those cases carry a `host` marker
(`fjs/nanvm/types.ts`) and run in Rust only.

### Proposal

`amnesia` answers a function's text with the same writer, through a
`toString` on the value it makes for a `=>` node. Then the corpus drops the
`host` marker and both sides run every function-text case.

### Tasks

- [ ] `amnesia`'s functions answer `tryFunctionText` of their node.
- [ ] Drop the corpus's `host` marker and its filter in `fjs/nanvm/proof.f.mjs`.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md): Stage 3, step 6.
