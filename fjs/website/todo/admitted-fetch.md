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
other provider text reaches the page; `github-worker.mjs` reads GitHub's
answer through `providerErrorSchema` before it looks at the status at all,
since GitHub answers an OAuth error as JSON under HTTP 200 as readily as
under 400 — `github-worker.proof.mjs` pins both — and only then a token
through `providerTokenSchema`. A shared boundary that hid the headers would
stop pagination after the first page; one that dropped a rejected body would
turn every refused exchange into the generic message; one that chose the
reader by the status would admit an error answered as 200 as a token and
refuse it on shape.

### Proposal

One thin host module, `fetch-runtime.mjs`, beside
[`copy-runtime.mjs`](../copy-runtime.mjs), which already plays the
shared-browser-boundary role:

```ts
admittedFetch: (fetchRequest: typeof fetch) =>
    (url: string, init: RequestInit, read: Reader) =>
        Promise<Result<{ status: number, headers: Headers, value: Admitted }, FetchRefusal>>
```

with the fixed defaults, the JSON step and the rtti admission in one place,
and the status not a branch: whatever the status, a JSON body is read by
the one `read` the caller gave, and the admitted value is answered with the
status and the headers, which the caller reads as it needs — `Link` and the
rate-limit headers on the PR page, the status against the shape on the
login page and in the worker. The refusal is for what no caller can read:
transport, which says whether the request timed out, since the PR page
words a timeout apart from a lost connection through `transportFailure`; a
body that is not JSON; a body no shape admits — and every refusal that had
a response carries its status and headers, since the PR page decides
`onUnauthorized` on a 401 and its retry note on a 403 or 429 from the
status and the rate-limit headers alone, over a body its success readers do
not admit. A redirect is whichever of those the `redirect` policy makes
it: under the page hosts' `'error'` the fetch rejects and no `Response`
exists, so it is a transport refusal like any other network error, with
nothing to attach; under the worker's `'manual'` it is a response with a
3xx status, which the worker refuses on the status as it does now. A
caller that accepts more than one shape gives one
`read` over their `or`: the login's `tokenSchema` or `exchangeFailureSchema`,
the worker's `providerTokenSchema` or `providerErrorSchema`, so the error
GitHub answers under 200 is admitted as what it is, and "fixed errors keep
provider bodies out of the page" stays true at the one boundary rather than
in each host's `try`. And `once(start)`: the bind-once rule
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
