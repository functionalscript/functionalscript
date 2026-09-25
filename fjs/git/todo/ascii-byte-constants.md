## Git readers take byte constants from `text/ascii`

**Priority:** P5
**Status:** open

### Problem

The Git readers each declare the ASCII bytes they look for as bare hex
literals, one file at a time:

- [`fjs/git/ident`](../ident/module.f.mjs) — `sp`, `lf`, `lt`, `gt`;
- [`fjs/git/header`](../header/module.f.mjs) — `lf`, `sp`;
- [`fjs/git/commit`](../commit/module.f.mjs) and
  [`fjs/git/tag`](../tag/module.f.mjs) — `lf`;
- [`fjs/git/tree`](../tree/module.f.mjs) — `sp`, `nul`, `slash`, `dot`;
- [`fjs/git/refname`](../refname/module.f.mjs) — `dot`, `slash`, `at`,
  `brace`, `del`;
- [`fjs/git/refstore`](../refstore/module.f.mjs) — `slash`.

Outside `fjs/git`, [`fjs/effects/common`](../../effects/common/module.f.mjs)
declares `lf = 0x0a` for `readLine` the same way.

[`fjs/text/ascii`](../../text/ascii/module.f.mjs) already exports these as
`lf`, `space`, `solidus`, `fullStop`, `lessThanSign`, `greaterThanSign`,
`commercialAt` and `leftCurlyBracket`, derived from the characters themselves.
`fjs/git/ident` imports its digit helpers from that module and still spells
its own `lf`. A hex literal is a value written down instead of the call that
explains it, which
[`fjs/AGENTS.md` §3.2](../../AGENTS.md#write-the-call-not-the-value-it-computes)
asks against, and each copy is one more place for a typo that no reader can
see.

### Proposal

Import each constant from `text/ascii`, under a local name where the Git
spelling reads better at the use site. `nul` and `del` have no export there
yet; add them if the move leaves them wanted in more than one place, and keep
them local otherwise.

### Tasks

- [ ] Replace the local constants in the modules above with `text/ascii`
      imports.
- [ ] `fjs/effects/common`'s `lf` goes with them.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/text/ascii`](../../text/ascii/module.f.mjs) — the constants' owner.
