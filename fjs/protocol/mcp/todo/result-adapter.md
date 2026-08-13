## Own the `Result` → `ToolsCallResult` adapter

**Priority:** P3
**Status:** open

### Problem

`fjs/mcp/evo/module.f.mjs:138-151` repeats the same dispatch in two tool
handlers, differing only in the ok-side rendering (`toJson` vs. identity):

```js
result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(toJson(result[1])))
...
result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(result[1]))
```

`fjs/protocol/mcp` already owns this vocabulary — it exports `okResult` and
derives `errorResult` from it (`module.f.mjs:177-187`), and
[response-constructors](../../json_rpc/todo/response-constructors.md) cites
that pair as the model of the owner exporting the whole family. The
`Result<T, string> → ToolsCallResult` adapter is the missing third member.

### Proposal

```js
/** @type {<T>(render: (value: T) => string) => (r: Result<T, string>) => ToolsCallResult} */
export const resultResult = render => ([tag, value]) =>
    tag === 'error' ? errorResult(value) : okResult(render(value))
```

Both handlers become `mapStep`-shaped one-liners
(`resultResult(toJson)` / `resultResult(identity)`), and every future
`Evo`-shaped tool gets it for free. Satisfies §6.3 ("factor out what two
branches share") and its destructuring rule in one move.

### Tasks

- [ ] Export the adapter next to `okResult`/`errorResult` with proof coverage
- [ ] Convert the `evo_revision` / `evo_add` handlers

### Related

- [map-step-combinator](../../../effects/todo/map-step-combinator.md) — the
  `step(e, x => pure(f(x)))` wrapper around these same sites
