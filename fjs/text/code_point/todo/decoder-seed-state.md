## decoder-seed-state. `decoder` owns the EOF-scan skeleton; let the JS tokenizer use it

**Priority:** P4
**Status:** open

### Problem

`decoder` (`fjs/text/code_point/module.f.mjs:41-50`) is the named form of a
three-step pipeline: append a `null` EOF sentinel, run a `stateScan` whose
op forks on `input === null`, flatten the produced lists.

`fjs/js/tokenizer/module.f.mjs:702-722` re-spells exactly that pipeline —
down to the `flat([input, [null]])` literal and its cast —
in `tokenizeWithPositionOp` + `tokenize`, because `decoder` hardcodes its
seed state to `null` and the tokenizer's seed is
`{ state: { kind: 'initial' }, metadata: ... }`. The
`flat(stateScan(op)(seed)(flat([input, [null]])))` shape recurs in
`fjs/djs/tokenizer/module.f.mjs` as well (four `stateScan` call sites);
the sentinel trick and its type cast are re-derived wherever a scan needs
an end-of-input step.

### Proposal

Extract the seedful combinator one level down, next to `stateScan` in
`types/list` — roughly

```js
export const scanToEof = init => (unitOp, eofOp) => { ... stateScan(op)(init) ... }
```

— and express `decoder` through it as `scanToEof(null)`, **keeping
`decoder`'s public signature unchanged**: `decoder(byteOp, eofOp)` is an
exported API with external reach, and its in-repository consumers
(`utf8`/`utf16`) updating cleanly would hide a signature break from every
test. The JS tokenizer's `tokenize` becomes a one-line `scanToEof`
application once
[../../../js/todo/666-js-tokenizer-position-layer.md](../../../js/todo/666-js-tokenizer-position-layer.md)'s
step (1) re-extracts the `input == null ? eof : char` dispatch as a named
op; the DJS tokenizer's four call sites are further consumers of the lower
home. If the implementation instead decides the curried
`decoder(init)(unitOp, eofOp)` is the better API, that is a **breaking
change** to a public export and must be declared as such (`Changelog:`
with `**BREAKING CHANGES:**`), not slipped through as an internal
refactor.

### Tasks

- [ ] Add the seedful combinator beside `stateScan`; re-express `decoder`
      over it, signature unchanged.
- [ ] Express `js/tokenizer`'s `tokenize` through it (after or together
      with 666's step 1); consider the `djs/tokenizer` call sites.
- [ ] `tsc`, `fjs t`.

### Related

- [../../../js/todo/666-js-tokenizer-position-layer.md](../../../js/todo/666-js-tokenizer-position-layer.md)
  — its extracted `tokenizeOp` is precisely the `(unitOp, eofOp)` pair this
  combinator consumes; this issue is that issue's natural landing site.
