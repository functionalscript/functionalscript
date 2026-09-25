## JSON parse errors report an offset, not line:column

**Priority:** P4
**Status:** open

### Problem

`parse` in [`../parser/module.f.mjs`](../parser/module.f.mjs) reports a
refusal as the index of the code unit it stopped at, inside the message
(`unexpected symbol at N`), and no position. `_parseJson` in
[`fjs/fsc/transpiler`](../../../fsc/transpiler/module.f.mjs) therefore builds a
`ParseError` with `metadata: null` and the file's `path`, and `fjs compile`
prints the file and the offset where a module error gets `path:line:column`:

```sh
$ fjs compile bad.json out.json     # bad.json: {"a": }
bad.json - error: unexpected symbol at 6
```

The other half of the original issue has shipped: a `ParseError` carries the
`path` of a failure with no token (`file not found`, `circular dependency`),
and `_errorLocation` in [`fjs/fsc/module.f.mjs`](../../../fsc/module.f.mjs)
prints it.

### Proposal

Give `fjs/media/json`'s parse errors a line and column, and carry them into
the `ParseError`'s `metadata`, so a `.json` input reports `bad.json:1:7` like a
module does.

### Tasks

- [x] A path-without-position `ParseError`, used by `file not found` and
      `circular dependency`: its `path` field in `fjs/fsc/parser/types.ts`.
- [ ] Positions in `fjs/media/json`'s parse errors, carried by `_parseJson`.
- [ ] Assert the exact `stderr`, next to the cases
      [`fjs/fsc/proof.f.mjs`](../../../fsc/proof.f.mjs) already pins.

### Related

- `_errorLocation` in [`fjs/fsc/module.f.mjs`](../../../fsc/module.f.mjs) —
  the formatting site.
- [json-writer-owner](../../../fsc/todo/json-writer-owner.md) — moves
  `_errorLocation` beside `ParseError`.
