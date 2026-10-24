## `github-worker.mjs` carries the token exchange's decisions

**Priority:** P3
**Status:** open

### Problem

[github-login-pure-half](./github-login-pure-half.md) moves the login page's
logic out of `github-runtime.mjs` into [`github/module.f.mjs`](../github/module.f.mjs).
The other host of the same flow, [`github-worker.mjs`](../github-worker.mjs),
has the same shape and is not in that issue. Its `callback` and
`handleGithubRequest` hold, where no proof reaches them:

```js
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
const secure = url.protocol === 'https:' || (url.protocol === 'http:' && loopback)
return secure && url.pathname === '/prs/' && url.search === '' && url.hash === '' && url.username === '' && url.password === '' ? url : null
…
const config = url.pathname === '/auth/github/config'
const exchange = url.pathname === '/auth/github/token'
const redirectUri = `${url.origin}/prs/`
if (code.length === 0 || code.length > 1_024 || !validVerifier(verifier)) { … }
if (errorTag === 'ok') { return signInFailure(providerErrorReason(providerError.error), response.status >= 500 ? 502 : 400) }
```

The two route paths and `/prs/` are also written in `github-runtime.mjs`, so
the worker and the page agree on them by coincidence. The loopback list is
[`fjs/web`](../../web/module.f.mjs)'s `servedHosts` again.

### Proposal

Move the pure half into `github/module.f.mjs`, beside `allowedCallbackOrigin`
and `validVerifier`: the route and callback paths as constants both hosts
import; `validCallback(url)` over a parsed URL record; `configDiagnostics(env)`
for the 503 body; `validExchange({ code, verifier })` for the size limits;
`providerOutcome(status, body)` for the 3xx/5xx/400 mapping and the scope
check. The worker keeps `Request`, `Response`, `JSON.parse`, `fetch` and the
cache headers. Whether the loopback list is one export shared with `web` is
a separate question; the two serve different purposes.

### Tasks

- [ ] The constants and predicates, with proof.
- [ ] `github-worker.mjs` and `github-runtime.mjs` import the paths.

### Related

- [github-login-pure-half](./github-login-pure-half.md) — the page host; this
  is its sibling for the worker.
- [admitted-fetch](./admitted-fetch.md) — the worker's `fetch` guard, which
  stays in the host.
