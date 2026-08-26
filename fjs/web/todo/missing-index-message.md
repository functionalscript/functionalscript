## missing-index-message. A directory with no index reads as a bad URL

**Priority:** P3
**Status:** open

### Problem

`fjs web` answers `/` with `not found` when the served root has no
`index.html`, which describes the file the server looked for and not the
request the client made. The URL was right, the root was right, and the one
thing missing is a file the operator generates — but the sentence names none of
that, so the first reading is that the address is wrong.

It is reachable from a clean checkout. `index.html` is a build artifact and is
gitignored, so `fjs web` in a fresh tree answers `not found` at `/` until
`npm run index-html` has run. Nothing in the response points at that.

The same sentence covers every other refusal:

| request | today |
|---|---|
| `/` with no `index.html` in the root | `404 not found` |
| `/fjs/` — a directory that exists, with no index | `404 not found` |
| `/no-such-dir/` | `404 not found` |
| `/fjs/web/nope.md` | `404 not found` |
| `/.git/` | `404 not found` |

Byte-identical, all five. That is not an oversight for the last one: refusing a
dot-prefixed path as *absent* is what keeps its existence undisclosed, per
`resolve`'s note and "Deliberately absent" in [`../README.md`](../README.md).
So the fix is not "say more when a file is missing" — it is to say more about
**what was asked for** without saying more about what is on disk.

### Proposal

Give a directory-form request its own sentence, decided by the shape of the
URL rather than by the file system. A path ending in `/` — including the bare
`/` — is one the server answered by appending `index.html`, and saying so
discloses nothing: the client sent that path and already knows its shape.

```
no index.html in /fjs/
```

Two constraints on the wording:

- **Name the URL path, not the resolved path.** `fileResponse` already
  prefers `errorSummary` to `errorMessage` so a client is not handed the
  server's filesystem layout; a message reading `no index.html in
  /home/…/fjs/` would give back exactly that.
- **Do not distinguish an existing directory from a missing one.** Telling
  `/fjs/` apart from `/no-such-dir/` requires a second `stat` and turns the
  response into a directory-existence oracle — which, under the DNS-rebinding
  reading in `servedHosts`, is the enumeration the uniform `404` currently
  denies. Both should keep answering the same sentence.

The obstacle is that the distinction is gone by the time it is needed.
`resolve` computes `isDirectory` and then returns `Result<string, Refusal>` —
a path and nothing else — so `respond` cannot tell an appended `index.html`
from a requested one, and `fileResponse` sees only a `stat` failure. Options:

1. Widen what `resolve` returns, so the routing fact travels with the path.
   Keeps every routing decision in the one pure function that owns them, at
   the cost of a change to `Resolve` and its proofs.
2. Re-derive it in `respond` from the URL. No type change, but it puts a
   second copy of "what counts as a directory request" outside `resolve`,
   which is the split the module header exists to state.
3. Key off the resolved path ending in `index.html`. Cheapest and wrong: it
   cannot tell `/index.html` — a request naming the file — from `/`.

(1) is the one that matches how the module is factored.

Whether a literal `/index.html` should get the new sentence too is open. The
message would be true, and treating it as a directory request would not be.

### Tasks

- [ ] Decide how the directory-form fact reaches `respond` — (1) above unless
      something argues otherwise.
- [ ] Answer a directory-form `404` with a sentence naming `index.html` and
      the URL path, leaving every other `404` as it is.
- [ ] Prove that `/fjs/` and `/no-such-dir/` still answer identically, so the
      oracle is not reintroduced by a later change.
- [ ] Update the response table in `module.f.mjs` and the prose in
      [`../README.md`](../README.md).

### Related

- [`fjs/web`](../README.md) — "Deliberately absent", where the missing
  directory listing and the `/docs` vs `/docs/` split are settled.
- [`fjs/website`](../../website/) — writes the `index.html` whose absence this
  is about.
