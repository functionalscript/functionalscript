## One GitHub REST client for the Actions scripts

**Priority:** P3
**Status:** open

### Problem

Two scripts run in GitHub Actions and talk to the REST API with the
workflow's token: `reviewPersonalNotes` in
[`ci/personal-notes/github.mjs`](../ci/personal-notes/github.mjs) and
`commentPreview` in
[`website/github-preview-comment.mjs`](../website/github-preview-comment.mjs).
Each opens with the same client, written out:

```js
// both, but for the message
if (!token) { throw new Error('The Actions token is required to …') }
const event = JSON.parse(await readFile(eventPath, 'utf8'))
const repository = event.repository?.full_name
// … a test that the event is a pull request
const base = `https://api.github.com/repos/${repository}`
const headers = /** @type {const} */ ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
})
```

and each then pages a list by `?per_page=100&page=${page}` until a page
comes back short, and throws `(HTTP ${status})` on a response that is not
`ok`. `reviewPersonalNotes` names those two steps `call` and `all`;
`commentPreview` has them inline in its loop.

Three things follow.

- **The API's vocabulary has four spellings.** The media type and the
  version header are written in these two scripts and again in the two
  browser hosts, [`github-runtime.mjs`](../website/github-runtime.mjs) and
  [`prs-runtime.mjs`](../website/prs-runtime.mjs). A move to a newer API
  version is four edits in two directories, and nothing fails where one is
  missed.
- **Neither script admits what it reads.** The event file and every
  response are `any`: `event.pull_request?.user?.login`, `review.user?.login`,
  `comment.body.startsWith(marker)` on a value cast to a type by a
  comment. The browser hosts read the same API through `parse(schema)`
  from [`rtti/parse`](../rtti/parse/module.f.js), and refuse what no shape
  admits.
- **`commentPreview` decides in the host.** Which comment is the
  preview's — the bot's, starting with the marker — and whether that
  makes the request a `POST` or a `PATCH`, and to which path, is business
  logic in a `.mjs`
  ([AGENTS.md §3](../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
  `reviewPersonalNotes` already keeps its decision,
  `onlyPersonalNotes`, in
  [`personal-notes/module.f.js`](../ci/personal-notes/module.f.js); the
  preview comment has no pure half.

### Proposal

- **The vocabulary in FunctionalScript**, in a module both sides import —
  [`website/github`](../website/github/module.f.js) holds the login's
  already, or a `fjs/github` beside it if `ci` should not import from
  `website`: `apiHeaders(token)`, which answers the record with or without
  `Authorization`, the `per_page` and the "a short page is the last" rule
  as a function of a page's length, and the schemas of the event and of
  each response the scripts read.
- **One thin client**, a `.mjs` beside it:
  `actionsClient({ token, eventPath }, request)`, which answers the
  admitted event and two functions, `call(path, schema, method?, body?)`
  and `all(path, schema)`. It is `reviewPersonalNotes`' `call` and `all`
  with a reader in place of `any`.
- **The preview comment's decision in FunctionalScript**:
  `previewRequest(comments, url)`, which answers the method, the path and
  the body. `commentPreview` is then the client, one `all` and one `call`.

### Drawbacks

- `commentPreview` stops paging at the first page that holds the comment;
  `all` reads every page first. A pull request with hundreds of comments
  pays a few more requests. An `all` that takes a `found` test would keep
  the early stop at the price of the simpler signature.
- The browser hosts' guarded fetch is
  [its own issue](../website/todo/admitted-fetch.md), and a different
  boundary: no credentials, a timeout, a redirect policy. The two should
  share the vocabulary and not the client. An Actions script has a token
  and no page to protect.

### Tasks

- [ ] `apiHeaders` and the paging rule in FunctionalScript; the four
      sites import them.
- [ ] Schemas for the pull-request event and the responses read;
      `actionsClient` and its proof.
- [ ] `previewRequest` with its proof; `commentPreview` and
      `reviewPersonalNotes` through the client.

### Related

- [Every website host spells the same guarded `fetch`](../website/todo/admitted-fetch.md)
  — the browser side of the same API.
