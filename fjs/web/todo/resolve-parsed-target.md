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

Split the resolver in two, keeping the published signature:

```js
/** The routing decision over an already-parsed target. Private. */
const resolveTarget = root => target => { … }   // `served(root)`, then the body from `decoded` on

/** @type {Resolve} */
export const resolve = root => url => {
    const target = parseTarget(url)
    return target === null ? refuse(400)('malformed request URL') : resolveTarget(root)(target)
}
```

`respond` then parses once and calls `resolveTarget` with the target it
already holds. `resolve` keeps the `Resolve` contract exactly as
`../types.ts:24-31` publishes it — a URL string in, malformed-URL rejection
owned here — which matters because `parseTarget` is private, so an external
caller has no other way to reach the canonical parser. The wrapper is the
public API, not proof scaffolding.

What this buys is one walk per request instead of two, and one place where
the `null` target is interpreted per caller: `resolve` answers `400`,
`respond` falls back to the `Host` header before the host check. Those two
readings stay different on purpose — the host check must precede
interpreting the target — but each becomes local to the function that makes
it rather than an agreement spanning two call sites.

### Tasks

- [ ] Extract the private `resolveTarget`; keep `resolve` as the public
      URL-accepting wrapper; call `resolveTarget` from `respond` with the
      target it already parsed.
- [ ] `npx tsc`, `fjs t`; the request/refusal proof rows pass unchanged —
      `resolve`'s signature does not change, so its proofs need no edit.

### Related

- [missing-index-message.md](./missing-index-message.md) — notes that
  "`respond` already binds `parseTarget(url)`" as plumbing for better
  messages; a single-parse `resolve` gives that issue the parsed path for
  free.
