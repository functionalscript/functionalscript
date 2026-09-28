## Strip SGR sequences without a regular expression

**Priority:** P4
**Status:** open

### Problem

`csiWrite` in [`../module.f.mjs`](../module.f.mjs) strips ANSI SGR sequences
from text bound for a stream that is not a TTY, and its helper `str` does it
with a regular expression:

```js
// fjs/text/sgr/module.f.mjs, str
isTTY ? s : s.replace(/\x1b\[[0-9;]*m/g, '')
```

[`fjs/AGENTS.md`](../../../AGENTS.md#no-regular-expressions) rules regular
expressions out of `.f.mjs` code: a lexical check is an ordinary typed
function, so the characters it accepts are explicit and provable.
[csi-edsl](./csi-edsl.md) names stripping "without a regex" as one benefit of
a styled-block eDSL, but the rule does not wait on that design.

### Proposal

Replace the regex with a scanner over the string's code points that drops each
`ESC [` followed by a run of decimal digits and `;` and a closing `m`, and keeps
everything else — including an `ESC` that does not begin such a sequence, which
the regex keeps too. The digit class comes from
[`fjs/text/ascii`](../../ascii/module.f.mjs).

### Tasks

- [ ] A regex-free stripper behind `str`, with the same output on every input.
- [ ] Proofs: a styled string, adjacent sequences, a sequence with `;`
      parameters, an `ESC` not followed by `[`, and an unterminated `ESC [1`.
- [ ] `tsc`, `fjs test`.

### Related

- [csi-edsl](./csi-edsl.md) — the eDSL whose serializer would decide whether to
  emit codes at all; independent of this change.
- [inplace-writer-split](./inplace-writer-split.md) — the other half of the
  module; its `createConsoleText` also calls `stdout.write` directly, an effect
  performed inside a `.f.mjs` module.
