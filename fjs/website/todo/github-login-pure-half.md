## `github-runtime.mjs` carries the OAuth logic its pure sibling exists for

**Priority:** P3
**Status:** open

### Problem

A host `.mjs` is a thin boundary and the logic is FunctionalScript
([AGENTS.md §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
The PR page keeps that split: [`prs-runtime.mjs`](../prs-runtime.mjs) is DOM
and `fetch`, [`prs/load/module.f.js`](../prs/load/module.f.js) is the
decisions and the messages. The login page does not.
[`github/module.f.mjs`](../github/module.f.mjs) holds the schemas,
`validPending`, `validVerifier` and `exchangeFailureMessage`, and
[`github-runtime.mjs`](../github-runtime.mjs) holds the rest of the login
inside its `start` closure, where no proof reaches it:

- whether the URL is a callback, and the parameters to scrub from it —
  `code`, `state`, `error`, `error_description`, `error_uri`;
- the authorize URL, `https://github.com/login/oauth/authorize` with
  `client_id`, `redirect_uri`, `prompt`, `state`, `code_challenge` and
  `code_challenge_method: 'S256'`;
- the pending record `{ state, verifier, createdAt }`, whose schema is in the
  pure module;
- the check that the registered redirect is this site's `/prs/`;
- a base64url, hand-written over `btoa` and three `split`/`join`s, which
  `github-runtime.proof.mjs` writes a second time to check the first — while
  [`fjs/basen`](../../basen/module.f.mjs) has `baseN` and a Base64 module one
  alphabet away;
- all of the login's messages.

### Proposal

Move the pure half into `github/module.f.mjs`: `callbackParams`,
`isCallback(params)`, `authorizeUrl(config, state, challenge)`,
`pending(state, verifier, now)`, `redirectMatches(config, origin)` and the
messages as one `const`. Add `fjs/basen/base64url` — `baseN(6n, urlAlphabet)`,
unpadded — and use it for `state`, `verifier` and `challenge`, so one codec
serves both the host and its proof. The host keeps the DOM, `crypto`,
`sessionStorage`, `history` and `location`.

### Tasks

- [ ] `fjs/basen/base64url` with its proof.
- [ ] The pure functions and messages in `github/module.f.mjs`, with proof.
- [ ] `github-runtime.mjs` imports them; its proof drops the second base64url.

### Related

- [admitted-fetch](./admitted-fetch.md) — the shared boundary the host's
  other half becomes.
- [`fjs/basen/base64`](../../basen/base64/module.f.mjs) — the alphabet
  base64url is one step from.
