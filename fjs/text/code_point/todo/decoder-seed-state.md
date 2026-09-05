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

Generalize the seed instead of hardcoding it:

```js
export const decoder = init => (unitOp, eofOp) => { ... stateScan(op)(init) ... }
```

with `utf8`/`utf16` calling `decoder(null)(...)` and the JS tokenizer
becoming a one-line application once
[../../../js/todo/666-js-tokenizer-position-layer.md](../../../js/todo/666-js-tokenizer-position-layer.md)'s
step (1) re-extracts the `input == null ? eof : char` dispatch as a named
op. Whether the combinator then still belongs in `code_point` — or one
level down, next to `stateScan` in `types/list`, with `code_point` as its
first consumer — is an open question for the implementation; the DJS
tokenizer's four call sites suggest the lower home.

### Tasks

- [ ] Generalize `decoder`'s seed (or extract the seedful form beside
      `stateScan`); port `utf8`/`utf16`.
- [ ] Express `js/tokenizer`'s `tokenize` through it (after or together
      with 666's step 1); consider the `djs/tokenizer` call sites.
- [ ] `tsc`, `fjs t`.

### Related

- [../../../js/todo/666-js-tokenizer-position-layer.md](../../../js/todo/666-js-tokenizer-position-layer.md)
  — its extracted `tokenizeOp` is precisely the `(unitOp, eofOp)` pair this
  combinator consumes; this issue is that issue's natural landing site.
