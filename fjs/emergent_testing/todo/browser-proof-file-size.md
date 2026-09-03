## Shrink `browser/proof.mjs` to the DOM adapter's own proofs

**Priority:** P3
**Status:** open

### Problem

`browser/proof.mjs` is 741 lines — the largest impure proof file in the
repository by a wide margin (the next is `effects/node/memory/proof.mjs` at 78)
and **90% of all impure proof code**: 741 of 819 lines across two files. It
exists because a DOM adapter can only be proven against a DOM stand-in. But
most of what it proves is not the adapter.

Measured at the head of functionalscript#1841, by whether a proof touches the
stand-in (`page()`, `startBrowserTests`, `renderBrowserReport`, or a node from
one):

| | proofs |
| --- | --- |
| need the DOM stand-in | 20 |
| do not — they drive `runBrowserProofs` and read its report | **23** |
| total | 43 |

The 23 are about the *interpreter* and the shared walk: naming, throw
inversion, normalized failures, the yields, the runner's own rejection routes,
and a family of hostile-value cases. They are in this file because
`runBrowserProofs` is a host function, not because they need a document.

### Why it is worth doing

The size of this file is the standing measurement of how thick the page's glue
is — see
[the README](../README.md#why-the-browser-runner-is-fmjs-with-a-thin-host).
A proof that reads a report rather than a document is proving `.f.mjs` logic
through a host entry point, which is the same debt the runner itself already
paid: it costs an impure file, a DOM stand-in the proof does not use, and a
reader who cannot tell which half of the runner a failure is about.

### What is *not* owed

- **`browser/module.mjs` itself.** That debt is paid and its record is retired:
  13 of its 14 definitions touch a host object, and the fourteenth is a partial
  application of the one above it. The measure and the result are in the README.
- **A line-count target.** The retired record aimed at "a plausible 50–80 lines"
  for `browser/module.mjs`; its own baseline of "298 today" was already 485
  before it was retired, because the *glue* grew — a testing seam, a pending
  row, a start event. Count host touches per definition, not lines.

### Tasks

- [ ] For each of the 23, decide whether it can be proven against
      `browser/module.f.mjs`'s `runProofs` under `effects/mock` rather than
      through `runBrowserProofs`. Some cannot: `crossRealmPromiseSilentlyPasses`
      and its neighbours build values with `node:vm`, which is a host capability
      and belongs in an impure file whatever it proves.
- [ ] Move the ones that can, and re-measure. The number to watch is the
      proportion that need the stand-in, not the line count.
- [ ] Leave the ones that cannot with a line saying which host capability keeps
      them there, so the next reader does not re-derive it.

### Related

- [Why the browser runner is `.f.mjs` with a thin host](../README.md#why-the-browser-runner-is-fmjs-with-a-thin-host)
  — the boundary this applies to proofs, and the measure it uses.
