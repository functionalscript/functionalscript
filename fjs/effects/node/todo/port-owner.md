## port-owner. Two `maxPort`s and two `isPort`s, where `emptyHost` already has one owner

**Priority:** P4
**Status:** open

### Problem

`fjs/effects/node/module.f.mjs` owns the empty-host refusal — `emptyHost`,
`emptyHostCode`, `emptyHostMessage`, `emptyHostError` — so "every runner
refuses it, and a program proven against the virtual one binds where the
Node one binds". The port, the other argument of the same `listen`, got
none of that:

```js
// fjs/effects/node/virtual/module.f.mjs
const isPort = port => Number.isInteger(port) && port >= 0 && port <= maxPort
const maxPort = 0xffff
// … and, in listen, the Node message restated by hand:
code: 'ERR_SOCKET_BAD_PORT',
message: `options.port should be >= 0 and < 65536. Received type number (${port}).`,
// fjs/web/module.f.mjs
const maxPort = 0xffff
const isPort = s => isDigits(s) && Number(s) <= maxPort
// … and in main: if (!Number.isInteger(port) || port < 1 || port > maxPort)
```

### Proposal

`maxPort`, `isPort: (port: number) => boolean` and a `badPortCode` /
`badPortMessage` pair beside `emptyHost*`; the virtual runner builds its
refusal from them as it does for the host; `fjs/web` imports `maxPort`
and keeps its two own rules, documented where they are. They are
different domains and stay so: the authority grammar's `isPort` accepts a
digits-shaped string in `0`..`maxPort`, so `:0` is a valid authority and
must remain one; `main` refuses a numeric `0` on the command line as a
binding policy — Node reads it as any free port, and the program cannot
announce which one it got — not as a fact about URLs.

### Tasks

- [ ] The exports with proofs; the virtual runner and `fjs/web` over them.
- [ ] `tsc`, `fjs test`.

### Related

- [`virtual/todo/address-model.md`](../virtual/todo/address-model.md) — the
  host half; on hold and unaffected.
- [`../../web/todo/parse-authority.md`](../../../web/todo/parse-authority.md) —
  would inherit the shared `isPort`.
