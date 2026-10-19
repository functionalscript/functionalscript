## Every website host spells the same guarded `fetch`

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
timeout — and they are stated once per host, so they can drift per host, and
each host's proof covers the same boundary.

What differs per host is what it reads off the response besides the body:
`prs-runtime.mjs` reads `Link` to decide whether a next page exists, and
`retry-after`, `x-ratelimit-remaining` and `x-ratelimit-reset` to word a
refusal; `github-runtime.mjs` reads the body of a rejected
`/auth/github/token` exchange through `exchangeFailureSchema`, so that its
fixed `reason` becomes the message `exchangeFailureMessage` words, and no
other provider text reaches the page; the worker reads only the status. A
shared boundary that hid the headers would stop pagination after the first
page, and one that dropped a rejected body would turn every refused exchange
into the generic message.

### Proposal

One thin host module, `fetch-runtime.mjs`, beside
[`copy-runtime.mjs`](../copy-runtime.mjs), which already plays the
shared-browser-boundary role:

```ts
admittedFetch: (fetchRequest: typeof fetch) =>
    (url: string, init: RequestInit, read: Reader, readRejected?: Reader) =>
        Promise<Result<Admitted, FetchRefusal>>
```

with the fixed defaults, the JSON step and the rtti admission in one place.
On success it answers the admitted value together with the response's
headers; on failure a tagged refusal — transport, status, not JSON, not the
schema — carrying the status and the same headers, which the caller maps to
its own message or its retry note. A status refusal also carries what
`readRejected` admitted of the body, where the caller gave one and the body
admitted, and nothing of the body otherwise: that is the login host's
exchange failure, read through the same admission as a success and never as
raw provider text, so "fixed errors keep provider bodies out of the page"
stays true at the one boundary rather than in one host's `try`. And
`once(start)`: the bind-once rule
over a `WeakMap` of roots, one memo per initializer, so that the PR page,
which runs `startGitHubLogin(root)` and then `startPrs(root, …)` on the same
element, binds both. The hosts import it; the worker passes `redirect:
'manual'` as its one override.

### Tasks

- [ ] `fetch-runtime.mjs` with `admittedFetch` and `once`, and its proof.
- [ ] The hosts import it; their private `request`s and memos go.

### Related

- [github-login-pure-half](./github-login-pure-half.md) — the other half of
  `github-runtime.mjs` that does not belong in a host.
