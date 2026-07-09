## parser-unexpected-token. Hoist the JSON parser's repeated error literals

**Priority:** P4
**Status:** open

### Problem

`fs/media/json/parser/module.f.ts` builds `{ status: 'error', message:
'unexpected token' }` inline at nine sites (lines 146, 151, 162, 170, 178,
185, 193, 202, 212), plus a stray `{ status: 'error', message: 'error' }`
at line 68 (the `pushKey` fallthrough). Example:

```ts
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}
```

The DJS parser had the identical repetition and already has a fix
designed: [196](../../djs/todo/196.md) introduces a module-scope
`unexpectedToken(metadata)` constructor, but explicitly scopes itself to
the DJS side. This is the JSON-side analog, not covered by
[196](../../djs/todo/196.md),
[66e](../../djs/todo/66e-parser-container-stack-bookkeeping.md), or
[157](../../djs/todo/157.md).

### Proposal

JSON errors carry no metadata, so the constructor degenerates to a shared
module-scope **value**:

```ts
const unexpectedToken: JsonState = { status: 'error', message: 'unexpected token' } as const
```

Replace the nine literals with `unexpectedToken`. For line 68, decide
whether the `pushKey` fallthrough is genuinely a distinct condition — if
it is reachable only via an unexpected token, reuse `unexpectedToken`
(dropping the uninformative `'error'` message); if it is unreachable by
construction, restructure so the branch disappears (per `AGENTS.md`'s
coverage rule) rather than keeping a dead literal.

Standalone cleanup — [196](../../djs/todo/196.md) declares itself
orthogonal to the larger shared-value-machine work in
[157](../../djs/todo/157.md), and the same holds here.

### Tasks

- [ ] Hoist `unexpectedToken`; replace the nine inline literals.
- [ ] Resolve the line-68 `'error'` fallthrough (reuse or restructure).
- [ ] Run `npx tsc` and `fjs t`; confirm parser proofs keep full branch
      coverage.

### Related

- [196](../../djs/todo/196.md) — the DJS-side twin of this cleanup.
