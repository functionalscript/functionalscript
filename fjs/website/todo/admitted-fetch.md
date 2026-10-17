## Three hosts spell the same guarded `fetch`

**Priority:** P3
**Status:** open

### Problem

[`github-runtime.mjs`](../github-runtime.mjs), [`prs-runtime.mjs`](../prs-runtime.mjs)
and [`github-worker.mjs`](../github-worker.mjs) each build the same request:
`host.fetch ?? globalThis.fetch`, with `credentials: 'omit'`, `cache:
'no-store'`, a `redirect` policy and `signal: AbortSignal.timeout(15_000)`;
then `await response.json()`, then `read(value)` from an rtti
`parse(schema)`, and a throw or a refusal on `tag === 'error'`. The two page
runtimes also share the `host.now ?? Date.now` seam and a `started = new
WeakMap()` that binds a root once.

```js
// github-runtime.mjs, request
const response = await fetchRequest(url, { ...options, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) })
const [tag, value] = read(await response.json())
if (tag === 'error') { throw new Error('GitHub login response was invalid.') }
// github-worker.mjs
response = await fetchRequest('https://github.com/login/oauth/access_token', { /* … */ credentials: 'omit', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15_000) })
```

The defaults are the security-relevant part — no credentials, no cache, a
timeout — and they are stated three times, so they can drift per host, and
three proofs cover the same boundary.

### Proposal

One thin host module, `fetch-runtime.mjs`, beside
[`copy-runtime.mjs`](../copy-runtime.mjs), which already plays the
shared-browser-boundary role:

```ts
admittedFetch: (fetchRequest: typeof fetch) =>
    (url: string, init: RequestInit, read: Reader) => Promise<Result<Value, FetchRefusal>>
```

with the fixed defaults, the JSON step and the rtti admission in one place,
answering a tagged refusal — transport, status, not JSON, not the schema —
that the caller maps to its own message; and `once(root, start)` for the
`WeakMap` memo. The three hosts import it; the worker passes `redirect:
'manual'` as its one override.

### Tasks

- [ ] `fetch-runtime.mjs` with `admittedFetch` and `once`, and its proof.
- [ ] The three hosts import it; their private `request`s and memos go.

### Related

- [github-login-pure-half](./github-login-pure-half.md) — the other half of
  `github-runtime.mjs` that does not belong in a host.
