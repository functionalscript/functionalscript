## A value output's refusal should name the output

**Priority:** P2
**Status:** open

### Problem

`fjs compile` reports a refused output against the output file and a refused
program against the input — "the module itself is sound" is what the output
form says. One refusal breaks that rule:

```sh
fjs compile input.f.js out.data.js   # input.f.js - error: a function has no value
fjs compile input.f.js out.js        # export default (...$a)=>$a;
```

The same module compiles, so the input is sound and only `.data.js` — and
`.json` with it — cannot hold what it denotes. It should read
`out.data.js - error: …`, as the JSON refusals do.

Nothing distinguished the two while the value outputs were the only ones
there was; the FunctionalScript output
([`../serializer`](../serializer/module.f.mjs)) is what makes the module's
soundness visible.

### Proposal

The evaluator has one error channel: `values` returns `Result<…, string>`,
[`../transpiler`](../transpiler/module.f.mjs) turns any of its failures into a
`ParseError` carrying the module's path, and `compile` names the input for it.
A read of `null` belongs there — it is the program's failure, in whichever
module it is written. A function's missing value does not: it is a question
the output asked.

So the evaluator should say which of the two it is, and the answer should
survive to `compile`. That widens `transpile`'s error type, which
[`interpret-edag.md`](./interpret-edag.md) holds fixed, so the two issues are
neighbours: decide the channel once.

### Tasks

- [ ] The evaluator distinguishes "this module has no value" from "this module
      fails", and `transpile` carries the distinction.
- [ ] `compile` names the output file for the first, the input for the second,
      with a proof for each of `.data.js` and `.json`.
- [ ] `interpret-edag.md`'s contract paragraph follows whatever the channel
      becomes.

### Related

- [`interpret-edag.md`](./interpret-edag.md) — the value-producing contract
  this changes the error half of.
- [`../serializer`](../serializer/module.f.mjs) — the output that made the
  input's soundness visible.
