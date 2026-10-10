## The parameter list, `rest` and `self` reads are written in both writers

**Priority:** P4
**Status:** open

### Problem

The source writer in [`serializer`](../module.f.mjs) and the body writer in
[`function_text`](../function_text/module.f.mjs) each render a function's
parameter list from the same facts, in the same words:

- `parameterList` and `lambda` both build `fixed` as
  `Array.from({ length }, (_, k) => binding(name(`${path}/arg${k}`)))`
  and `rest` as
  `a.nodes.some((n, j) => n[0] === 'rest' && a.scope[j] === i)` followed
  by `` `...${binding(name(`${path}/rest`))}` ``, character for character.
- `readsSelf` in `serializer` and the inline test in `function_text` ask
  the analysis the same question, `a.nodes.some((n, j) => n[0] === 'self'
  && a.scope[j] === i)`.

The two writers deliberately differ in what they emit
(`function_text`'s module doc: "separate from the source writer's FJS
round-trip contract"). The naming scheme — `${path}/arg${k}`,
`${path}/rest` — is the one thing they must agree on, since each resolves
names the other also writes, and it is the thing written twice.

### Proposal

- `analysis` answers "does function `i`'s own scope hold a node of kind
  `k`" once — the `rest` and `self` tests are both that question.
- One `parameters(a, path, i, length)` beside `names` returns the binding
  list both writers render, so the naming scheme has one spelling.

### Tasks

- [ ] Add the scope query to `analysis` and `parameters` to `names`, with
      proofs at 100%.
- [ ] Move `parameterList`, `readsSelf` and `lambda` onto them, output
      unchanged.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
