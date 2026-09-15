## An error without a position names the compiled file, not the failing one

**Priority:** P4
**Status:** open

### Problem

`compile` in [`fjs/fsc/module.f.mjs`](../../fsc/module.f.mjs) prints
`<path>:<line>:<column> - error: <message>` when the error carries a token's
metadata, and the name of the file being compiled when it does not:

```js
const errorLocation = inputFileName => ({ metadata }) => metadata === null
    ? inputFileName
    : `${metadata.path}:${metadata.line}:${metadata.column}`
```

That replaced a literal `undefined:undefined:undefined`, so the line is no
longer a trap for anything reading it as `path:line:column`. What it still
does is name the **wrong file** whenever the failure is not in the file named
on the command line:

```sh
$ fjs compile main.f.js out.js      # main.f.js imports ./missing.f.js
main.f.js - error: file not found   # which import? the line does not say
```

Three errors reach this branch, and none of them can point at a token:

- `file not found` and `circular dependency`
  ([`transpiler/module.f.mjs`](../../fsc/transpiler/module.f.mjs)) know the path that
  failed, but `TokenMetadata` has no shape for "this file, position unknown".
- a `.json` input's parse error comes from
  [`fjs/media/json/parser`](../../media/json/parser), which reports the index
  of the code unit it failed at in its message and no `TokenMetadata` — so a
  malformed JSON document is reported as
  `a.json - error: unexpected symbol at 1`, with the file right and the
  position an offset rather than a line and column.

### Proposal

Two independent halves, either useful alone.

- Let a `ParseError` carry a path without a position — a `TokenMetadata` whose
  line and column are absent rather than invented — and give the transpiler's
  two errors the path that actually failed.
- Give `fjs/media/json`'s tokenizer and parser real positions, so a `.json`
  input reports `a.json:3:12` like a module does. The JSON tokenizer already
  walks the text; the parser discards where it was.

### Tasks

- [ ] A path-without-position `ParseError`, used by `file not found` and
      `circular dependency`.
- [ ] Positions in `fjs/media/json`'s parse errors.
- [ ] Assert the exact `stderr` for both, next to the cases
      [`fjs/fsc/proof.f.mjs`](../../fsc/proof.f.mjs) already pins.

### Related

- `fjs/fsc/module.f.mjs` — the formatting site.
- Split out of the `compile` exit-code issue, which fixed the exit status of
  this same branch and left the cosmetic half open.
