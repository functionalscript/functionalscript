## The random programs' generators in FunctionalScript

**Priority:** P3
**Status:** open

### Problem

[`module.mjs`](../module.mjs) is 1,033 lines of plain JavaScript and does
three unrelated things.

1. **A generator of numbers.** `rng` is Mulberry32 behind a closure that
   mutates its seed, with `pick` and `below` over it.
2. **Generators of programs.** `floatExpr`, `boolExpr`, `intExpr`,
   `typedInputs`, `floatConstants`, `typedProgram`, `anyForm`,
   `programExpr`, `untypedProgram`, `closureProgram` and `spreadProgram`
   — some nine hundred lines — build a program's text, its signatures,
   its inputs and its twin. They read no file and touch no WebAssembly;
   the only impurity is that calling `rnd()` advances it.
3. **The comparison.** `compareOne` and `compare` take a program through
   `sourceOf`, `lower`, `lifetime` and the test library's `run`. `run`
   instantiates WebAssembly, and `linkedL1` reads a file: this part is
   the host's.

Only the third needs a `.mjs`
([AGENTS.md §3](../../../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
The second is the bulk of the file and is business logic: which
expressions the slices lower, with what weights, to what depth.

Two smaller things ride along.

**A refusal is classified by its prose.** `expectedRefusal` decides
whether a refusal is one the generators are known to provoke by taking
the checker's sentence apart:

```js
const rest = reason.slice(colon + 1).trimStart()
if (!rest.startsWith('the body is ')) { return false }
const body = rest.slice('the body is '.length)
const cut = body.indexOf(', not ')
...
return got.startsWith('int(') || got.startsWith('i(') || got.startsWith('u(')
```

A rewording of that diagnostic in
[`fjs/ir/check`](../../../check/module.f.js) turns every such program
from `refused` into `wrong`, or — worse — a different refusal that
happens to share the words is counted as expected. This is the text
matching that
[AGENTS.md §6](../../../../../AGENTS.md#6-external-tools) warns against,
applied to our own output.

**A twin is made two ways.** Fifteen sites build the twin from the
program's own body with `new Function`, which only a host can do. The
others write the body a second time by hand, as form 8 of `anyForm` does:
the loop is seven lines of text for the lowering and the same loop as a
closure beside it, and the two agree because they were kept in step.

### Proposal

- **`fjs/types/random` (or `fjs/ir/from_fast/random/rng`)** holds
  Mulberry32 as a pure step, `(seed: number) => readonly [float, seed]`,
  with `pick` and `below` over it. It has a use outside this directory
  the day a second seeded proof is written.
- **`module.f.js` holds the generators**, each a function from a seed to
  a program and the seed after it. The grammar tables (`programAtoms`,
  `anySamples`, `literalSamples`, the operator lists) become data that
  the generators fold over rather than branches of `if (r < 0.3)`.
- **`module.mjs` keeps `compareOne`, `compare` and `linkedL1`**: under a
  hundred lines.
- **The checker's refusal carries what it is.** Where `check` and `lower`
  answer `Result<_, string>`, the range refusal gets a kind that
  `expectedRefusal` reads, or the generators stop writing bodies whose
  range is past the signature and the exception goes. The second is
  simpler if the first reads as API growth for one test.
- **A generator answers the recipe of a twin, not the twin.** The body's
  text and the names it closes over are data; `module.mjs` makes the
  closure with `new Function`, in one place rather than fifteen. The
  hand-written twins can take the same road, since each is the text
  evaluated over the L0 view's functions, which leaves one spelling of
  each body. If an independent spelling is the point of those, the module
  comment should say so and they stay.

### Drawbacks

- Threading a seed through every generator, the recursive ones included, is
  noisier than calling `rnd()`. A small state combinator (`bind` over
  `seed => [value, seed]`) keeps it readable; without one this is not an
  improvement.
- The sequence of programs for a given seed changes unless the order of
  draws is preserved exactly, so the seeds that
  [`proof.mjs`](../proof.mjs) pins need re-recording.
- Inputs hold host values, functions that throw among them (`callees`
  of form 17). A generator in FunctionalScript picks them by index from
  a table that the `.mjs` owns.

### Related

- [the slices](../../../todo/slices.md), "Seeded random comparison"
- [host proofs for effects only](../../../../../todo/host-proofs-for-effects-only.md)
