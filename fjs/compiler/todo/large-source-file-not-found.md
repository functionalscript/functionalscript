## A source over 128 KiB is reported as `file not found`

**Priority:** P3
**Status:** open

### Problem

`fjs compile` refuses a source file of more than `maxLengthBytes` bytes
(2^17, the largest `Vec` in [`fjs/types/bit_vec`](../../types/bit_vec/module.f.mjs))
and says the file does not exist:

```sh
$ fjs compile size131073.f.js out.json
size131073.f.js - error: file not found
```

Two things combine. The Node host's `readFile` in
[`fjs/effects/node/module.mjs`](../../effects/node/module.mjs) throws for a
file larger than `maxLengthBytes` rather than load it. And `notFound` in
[`../transpiler/module.f.mjs`](../transpiler/module.f.mjs), which
`readSource` wraps around that read for every module, `.json` input and JSON
import, turns every read failure into `file not found`, so the host's own
message, which names the size, is lost.

It is a refusal, not a different value, so no program is answered wrongly —
but the message sends the reader looking for a file that is there, and a
module of that size is a real one: a generated data module passes 128 KiB
easily.

### Proposal

- Read sources through `readWholeBytes` in
  [`fjs/effects/node`](../../effects/node/module.f.mjs), which reads a whole
  file in chunks without the single-`Vec` cap, and decode the bytes with the
  same checked UTF-8 decoder `readSource` uses now.
- Keep `notFound` for a missing file only, and carry any other read failure's
  message through to `compile`, so the error says what went wrong.

### Tasks

- [ ] `readSource` reads through `readWholeBytes` and still refuses bytes that
      are not correct UTF-8.
- [ ] A read failure other than a missing file keeps the host's message.
- [ ] A proof in [`../proof.f.mjs`](../proof.f.mjs) compiles a module larger
      than `maxLengthBytes`.

### Related

- [`fjs/effects/node/virtual/todo/no-name-length-limit.md`](../../effects/node/virtual/todo/no-name-length-limit.md)
  — the same `maxLengthBytes` bound met by the virtual file system.
