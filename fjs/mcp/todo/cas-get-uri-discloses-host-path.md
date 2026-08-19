## `cas_get`'s `uri` is an absolute host path

**Priority:** P3
**Status:** open — a design decision, not a patch to apply

### Problem

Every `cas_get` result carries the blob's absolute path on the server's
filesystem. `../cas/module.f.mjs:222` computes it unconditionally

```js
const uri = c.url(key)
```

and it is in the metadata object on both paths (`:231`, `:271`) and in the
oversized-blob error text (`:257`). `FileCas.url` (`../../cas/module.f.mjs:303`)
is `join(path, toPath(hash))`, `path` is `NodeProgramOptions.home` — `fjs mcp`'s
handler is `({ home }) => exitStep(casMcpServer(home))` (`../../module.f.mjs:49`)
and the Node runner fills it from `os.homedir()`. Verified by execution against
`2e9ad76f`:

```
uri = /Users/<username>/.cas/g0/00/00000000000000000000000000000000000938nkrj2nwvvw
```

So the field is not a URI in the `scheme:` sense at all — it is a host path, and
it names the account the server runs under. Every client that calls `cas_get`
once learns the server's home directory, its username, and the store layout,
whether or not it can reach that path.

This is deliberate, which is why it wants a decision rather than a fix.
`README.md`'s store-location section states it outright — "the `uri` field
returned by `cas_get` contains the full absolute path to the blob file" — and
[cas-get-mcp-resource-response.md](./cas-get-mcp-resource-response.md) chose the
name so the tool view and the future `resources/read` view share a vocabulary.
The intent is a *resource* URI; the current value is a placeholder standing in
for one.

Three things sharpen it:

- **The README already describes the behaviour we would want, and it is not the
  behaviour.** It says `uri` "is present only when the server was started with a
  `toUrl` resolver … it is omitted in memory-backed contexts such as tests". No
  such resolver exists; `url` is a required member of `FileCas` and the field is
  unconditional, in tests too (`../cas/proof.f.mjs:119` asserts it present). A
  reader of the docs believes this is opt-in when it is not.
- **It sits against this module's own stated boundary.** README's design
  invariant is that the server never opens a client-named local path — every
  path it touches is self-derived. That invariant is about what the server
  *accepts*; nothing yet says anything about what it *emits*, and a store path
  handed to the client is the same information travelling the other way.
- **It leaks past a downstream server's own hygiene.** `fjs-dev/finance` runs an
  MCP server over this registry and has just finished removing host paths from
  its own tool error text, with a real-process test proving neither its
  responses nor its stored run records carry one. `cas_get`'s envelope
  reintroduces the path underneath that work, and the test currently has to
  parse its own field *out of* the envelope so it does not redden on the `uri` —
  a leak handled in a test's parsing, which is the weakest place to handle one.

Exposure today is latent rather than live: the only transport is stdio
(`../../protocol/mcp/stdio/`), so the client is a local process that could read
`os.homedir()` for itself. [remote-url.md](./remote-url.md) is the point at which
it stops being latent, and it should be settled before that lands rather than as
part of it.

### Proposal

Pick one; each is a different answer to "what is `uri` *for*".

1. **Opaque, transport-independent identifier.** `uri` becomes something like
   `cas:<cBase32-hash>` — derived from what the client already sent, so it
   discloses nothing, and it is a well-formed URI, which the current value is
   not. A `resources/read` handler resolves it to a local path server-side.
   *Cost:* a client that today reads the field and opens the file directly
   loses that shortcut and must go through the server. The tool description
   ("To download a blob, prefer the uri field returned in the result") and the
   oversized-blob error text both promise that shortcut and would change.
2. **Store-relative path.** `uri` becomes `<AB>/<CD>/<rest>` — the sharded
   suffix without the root. Keeps the shape and its usefulness to anyone who
   knows the root; discloses only the layout, not the account.
   *Cost:* a half-measure. It is still not a URI, and a client that does not
   know the root cannot use it, so the shortcut is preserved only for clients
   for whom the disclosure was harmless anyway.
3. **Resolver-supplied, absent by default.** Make it what the README already
   claims: the server is constructed with an optional `toUrl` resolver and omits
   `uri` when there is none. An HTTP server supplies one that produces a real
   URL under its own domain — exactly [remote-url.md](./remote-url.md)'s
   "URL translation function instead of returning a URL from `FileCas`" — and a
   local stdio server may supply an absolute-path resolver deliberately.
   *Cost:* the largest change, and it makes `uri` optional in a shape
   [cas-get-mcp-resource-response.md](./cas-get-mcp-resource-response.md) is
   trying to make resource-like. It is also the only option that keeps the
   absolute path available to the local case that wants it while removing it
   from the default.

Option 3 subsumes option 1 as its default-resolver choice, and is the one
[remote-url.md](./remote-url.md) already points at from the other direction.
Whatever is chosen, `README.md`'s two statements about `uri` have to end up
agreeing with the code — today they contradict each other.

### Tasks

- [ ] Decide between the three (maintainer call — public protocol surface).
- [ ] Implement, including the tool-description string and the oversized-blob
      error text, both of which name `uri` as a download route.
- [ ] Reconcile `README.md`'s "only when started with a `toUrl` resolver" and
      "contains the full absolute path" with whatever ships.
- [ ] State the emit-side boundary next to the existing design invariant, so the
      next field to carry a server path is a decision rather than an accident.

### Related

- [remote-url.md](./remote-url.md) — the URL-translation function; this issue is
  the reason to settle it before a remote transport, not with it.
- [cas-get-mcp-resource-response.md](./cas-get-mcp-resource-response.md) — chose
  the `uri` name and its intended relation to `resources/read`.
- `../README.md` — the store-location section and the design invariant.
- `../cas/module.f.mjs:222,231,257,271` — the four sites that carry the value.
