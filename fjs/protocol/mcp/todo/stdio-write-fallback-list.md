## stdio-write-fallback-list. Fold the stdio response fallback cascade over a candidate list

**Priority:** P4
**Status:** open

### Problem

`handleLine` (`fjs/protocol/mcp/stdio/module.f.mjs`) hand-nests the same
*"write a response; if it didn't fit, try the next smaller one"* structure
three levels deep:

```js
: resultStep(
    writeResponse(resp),
    r2 => r2[0] === 'error'
        ? resultStep(
            writeResponse(internalErrorResponse(resp.id)),
            r3 => r3[0] === 'error'
                ? resultStep(
                    writeResponse(internalErrorResponse(null)),
                    () => pureOk(undefined),
                )
                : pureOk(undefined)
        )
        : pureOk(undefined))
```

The fallback chain is exactly the ordered list
`[resp, internalErrorResponse(resp.id), internalErrorResponse(null)]`,
tried in turn until one encodes (the last is constant-shaped and always
fits). Per `AGENTS.md`: *"When two code branches share most of their
structure, refactor so the shared part appears once and only the difference
lives in the conditional"* — here three branches share it, and the nesting
hides the simple invariant.

### Proposal

Fold over the candidate list, stopping at the first response that writes
without `error`:

```ts
const writeFirst = ([first, ...rest]: readonly [Response, ...(readonly Response[])]): Effect<Write, void, IoChannel> =>
    rest.length === 0
        ? resultStep(writeResponse(first), () => pureOk(undefined))
        : resultStep(writeResponse(first), ([t]) =>
            t === 'error' ? writeFirst(rest as readonly [Response, ...(readonly Response[])]) : pureOk(undefined))
```

(Settle the non-empty-tuple typing during implementation — a plain
`readonly Response[]` with a documented non-empty precondition is fine if
the tuple type fights the spread; avoid `as` if the simpler type suffices.)

Call site:

```ts
: step(handler(value), resp => resp === null
    ? pureOk(undefined)
    : writeFirst([resp, internalErrorResponse(resp.id), internalErrorResponse(null)]))
```

The three-level nest collapses to a single list plus one recursion, and the
*"the terminal candidate always encodes"* invariant becomes structural:
it is the last element of the list. Keep the existing comment explaining
why the caller-controlled `id` needs the `id: null` terminal fallback —
attach it to the list literal.

### Tasks

- [ ] Extract `writeFirst`; replace the nested cascade in `handleLine`.
- [ ] Move the fallback-rationale comment onto the candidate list.
- [ ] Run `tsc` and `fjs t`; confirm the stdio proof still covers the
      oversized-response and oversized-id paths.

### Related

- `fjs/protocol/mcp/stdio/module.f.mjs` — `internalErrorResponse`, `writeResponse`
  (the `maxLength`-bounded encoder whose `error` result drives the
  fallback).
