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

Split the resolver in two, keeping the published signature. The private half
takes the target **including its `null`**, so the malformed-URL refusal is
stated once and no caller can reach the body with nothing to read:

```js
/**
 * The routing decision over an already-parsed target; `null` is the
 * malformed-URL refusal, since a target that did not parse names no path.
 */
const resolveParsed = root => {
    const base = served(root)
    return target => {
        if (target === null) { return refuse(400)('malformed request URL') }
        const decoded = percentDecode(target.path)
        …                                        // the rest of today's body
    }
}

/** @type {Resolve} */
export const resolve = root => {
    const r = resolveParsed(root)
    return url => r(parseTarget(url))
}
```

`served(root)` moves into the `root` scope for the same reason the partial
application does: it depends on `root` alone, so leaving it in the target
callback recomputes it for every request. Today it sits inside `resolve`'s
per-URL body (`../module.f.mjs:264`), where `root` and `url` arrive together
and there is no outer scope to hoist to; splitting the function creates one,
and the rule then applies (`fjs/AGENTS.md`, "Hoist call-invariant
computations").

`resolveParsed(root)` is likewise bound in the `root` scope, not inside the
per-URL callback: a per-call `resolveParsed(root)(…)` would rebuild the same
closure on every request (`fjs/AGENTS.md`, "Place curried partial
applications at their dependency's scope"). `respond` does the same — it is `root => { const r =
resolveParsed(root); return ({ method, url, headers }) => … }` — and then
calls `r(target)` with the target it already holds. `null` included, which
is the case that matters:
a malformed target whose `Host` header names a served host and whose method
is `GET` reaches the resolver with `target === null` today and is answered
`400` by `resolve`'s own guard. Routing that through `resolveParsed` keeps
that answer; handing a bare `resolveTarget` a `null` would instead read
`target.path` off nothing.

`resolve` keeps the `Resolve` contract exactly as `../types.ts:24-31`
publishes it — a URL string in, malformed-URL rejection owned here — which
matters because `parseTarget` is private, so an external caller has no other
way to reach the canonical parser. The wrapper is the public API, not proof
scaffolding.

What this buys is one walk per request instead of two, with the `null` target
answered in one place instead of two: `resolveParsed` owns the `400`, and
`respond` keeps `null` only for the `Host`-header fallback that must precede
the host check. That ordering stays exactly as it is — the host check runs
before the target is interpreted — but it stops being an agreement spanning
two parses of the same string.

### Tasks

- [ ] Extract the private `resolveParsed`, taking a nullable target and
      owning the `400`; keep `resolve` as the public URL-accepting wrapper;
      call `resolveParsed` from `respond` with the target it already parsed.
      Bind `resolveParsed(root)` once in each `root` scope rather than inside
      the per-request callback.
- [ ] Keep a proof row for the malformed-target-with-served-`Host` request,
      which is the path that reaches the resolver with `null`.
- [ ] `tsc`, `fjs t`; the request/refusal proof rows pass unchanged —
      `resolve`'s signature does not change, so its proofs need no edit.

### Related

- [missing-index-message.md](./missing-index-message.md) — notes that
  "`respond` already binds `parseTarget(url)`" as plumbing for better
  messages; a single-parse `resolve` gives that issue the parsed path for
  free.
