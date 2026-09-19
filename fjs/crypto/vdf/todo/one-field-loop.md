## one-field-loop. `squareLoop` and `modSqrtLoop` differ only by the operator

**Priority:** P5
**Status:** open

### Problem

```js
// fjs/crypto/vdf/module.f.mjs, sloth_vdf
const squareLoop = steps => value => iterate(steps)(reduce(value))(pow2)
const modSqrtLoop = steps => value => iterate(steps)(reduce(value))(root)
```

### Proposal

`const loop = op => steps => value => iterate(steps)(reduce(value))(op)`,
with the two as `loop(pow2)` and `loop(root)`, so the module's claim — that
`eval` and `verify` iterate a mutually inverse pair over one field
reduction — is visible in the code rather than only in the VDF's name.

### Tasks

- [ ] Rewrite; proofs unchanged; `tsc`, `fjs test`.
