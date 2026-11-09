## `cards.mjs` keeps its own content-type table

**Priority:** P5
**Status:** open

### Problem

The screenshot server in [`cards.mjs`](../cards.mjs) answers the
`content-type` a file name implies from a private `types` table of six
extensions, with `application/octet-stream` as the default.
[`fjs/media/type`](../../media/type/module.f.mjs)'s `detectPath` answers
the same question for the whole site, and [`fjs/web`](../../web/module.f.mjs)'s
`fileResponse` already serves the same tree through it. The second table
is a subset: it has no `wasm`, `json` or `jpg`, which a card page may
reference, and it adds the charset by hand.

### Proposal

`cards.mjs` imports `detectPath` and writes `'content-type':
detectPath(file)`; `types` and the `extname` import go.

### Tasks

- [ ] `detectPath` in `cards.mjs`.
