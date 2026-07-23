## inplace-writer-split. The backspace in-place writer is not an SGR concern

**Priority:** P5
**Status:** open

### Problem

`fjs/text/sgr/module.f.ts` bundles two unrelated concerns. Alongside the ANSI
CSI/SGR machinery (`csi`, `sgr`, `reset`/`bold`/`fgRed`/`fgGreen`,
`csiWrite`) it carries a backspace-based *in-place text rewriter*
(`:52-78`):

```ts
const replace = (old: string) => (text: string) => {
    const len = old.length
    const suffixLength = max(0, len - text.length)
    return backspace.repeat(len) + text + " ".repeat(suffixLength) + backspace.repeat(suffixLength)
}
export type Stdout = { readonly write: (s: string) => void }
export type WriteText = (text: string) => WriteText
export const createConsoleText = (stdout: Stdout): WriteText => { … }
```

`replace`/`createConsoleText`/`WriteText`/`Stdout` use only `backspace` (a C0
control), never an SGR/CSI escape — it is a generic "overwrite the previously
printed text" progress writer. It is also `export`ed with no non-proof
consumer (only `fjs/text/sgr/proof.f.ts:17` calls `createConsoleText`), which
the AGENTS.md export rule ("only `export` when at least one external consumer
exists") discourages.

### Proposal

When a real consumer appears, move the in-place rewriter to its own module
(e.g. `fjs/text/console/module.f.ts`), leaving `sgr` focused on
escape-sequence construction. Until then, at minimum stop exporting
`createConsoleText`/`WriteText`/`Stdout` — or, if the writer has no planned
consumer at all, delete it with its proof (speculative code per AGENTS.md).

### Tasks

- [ ] Decide: relocate, un-export, or delete.
- [ ] `npx tsc`, `fjs t`.

### Related

- [csi-edsl.md](./csi-edsl.md) — declarative eDSL for composing SGR
  sequences; entirely on the escape-code side, does not touch the rewriter.
