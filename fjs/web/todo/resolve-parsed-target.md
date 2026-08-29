## Parse the request target once

**Priority:** P4
**Status:** open

### Problem

A request's target is decomposed twice per request, by two functions that
each consume half of the result. `respond` parses it for the authority:

```js
// ../module.f.mjs:567-568
const target = parseTarget(url)
const host = target === null || target.authority === null ? headers.host : target.authority
```

then calls `resolve(root)(url)` (`:571`), which parses the same string again
for the path:

```js
// ../module.f.mjs:263-266
export const resolve = root => url => {
    const base = served(root)
    const target = parseTarget(url)
    if (target === null) { return refuse(400)('malformed request URL') }
```

`parseTarget` (`:173-199`) is the single owner of "how a target decomposes",
but its contract now has two consumers that must agree on what `null` means
— `respond` reads it as "fall back to the `Host` header" (so the host check
still runs first), `resolve` as an immediate `400`. That agreement is the
deliberate ordering — a request for an unserved name is refused before its
target is interpreted — but it is currently an emergent property of two
call sites rather than a stated one, and the string is walked twice for it.

### Proposal

Parse once in `respond` and hand `resolve` the parsed target rather than the
raw string — `resolve(root)(target)` taking the
`Nullable<{ authority, path }>` (keeping the `null` → `400` answer inside
`resolve`, so the refusal text stays owned where it is), or taking the
`path` with `respond` owning the `null` case explicitly next to the host
fallback it already handles. Either way `parseTarget` gets one caller, the
double walk disappears, and the host-check-before-interpretation order
becomes visible in one function instead of spanning two.

`resolve` is exported API; per `DESIGN.md`, changing its signature for the
better API is the right call. Its proofs currently feed it raw strings and
would feed it targets (or keep a thin string-accepting wrapper for the
proof table, if the rows read better that way).

### Tasks

- [ ] Change `resolve` to consume a parsed target; parse once in `respond`.
- [ ] `npx tsc`, `fjs t`; the request/refusal proof rows pass unchanged.

### Related

- [missing-index-message.md](./missing-index-message.md) — notes that
  "`respond` already binds `parseTarget(url)`" as plumbing for better
  messages; a single-parse `resolve` gives that issue the parsed path for
  free.
