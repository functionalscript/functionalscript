## web-api-server. Web API (HTTP) server as a third CAS transport

**Priority:** P4
**Status:** blocked
**Blocked by:** [command-architecture](./command-architecture.md)

### Problem

CAS is reachable only through the CLI and the stdio MCP server. Both are
per-user, per-process front ends: browsers and remote clients cannot reach
a store at all, and every stdio MCP instance carries its own process state —
the Evo API ([`fjs/cas/evo`](../evo/)) already runs into this — its cache is
per-process, so every STDIO MCP server instance builds its own — and its
README floats an HTTP(S) server as the way to share one cache across many
clients.

There is also no way for a *human* to look at a store: every existing front
end targets a program (shell scripts, MCP agents). Inspecting what a store
contains — the hash list, a blob's type and size, a revision's parents —
currently requires driving the CLI or MCP by hand.

Adding an HTTP front end today would mean a third hand-wired copy of the
command logic — exactly the duplication
[command-architecture](./command-architecture.md) is being designed to
eliminate. This issue is therefore blocked on that design.

### Proposal

Once the command architecture exists, expose a subset of the CAS command
set over HTTP(S):

- the exposed subset and its restrictions come from the architecture's
  exposure matrix (e.g. no client-named local paths, same as MCP);
- authentication/authorization is a hard prerequisite for anything
  non-local (also flagged in [`fjs/cas/evo`](../evo/)) and needs its own
  design before the server is reachable beyond localhost;
- request/response validation should derive from the same command
  declarations that drive the CLI and MCP adapters;
- large blobs favour HTTP *in principle*: the protocol streams
  request/response bodies, so `add`/`get` of arbitrary-size content is a
  natural fit for this transport where MCP is capped at 128 KiB of inline
  content. But the current HTTP effects do not stream:
  `IncomingMessage.body` / `ServerResponse.body`
  (`fjs/effects/node/module.f.ts`) are single `Vec`s, and the Node runner
  buffers the whole request (`collect(req)` → `listToVec`) — past the
  128 KiB `Vec` limit it throws. The CAS store side already streams
  (`Cas.read`/`Cas.write` deal in chunk lists), so lifting the cap needs
  **streaming request/response body effects** as a prerequisite; until that
  design exists, an HTTP adapter inherits the same inline cap as MCP.

**Human-readable HTML pages.** The same server should also serve HTML, so a
human can browse a CAS in an ordinary browser — one server, two
representations of the same commands, selected by content negotiation
(`Accept: text/html` vs `application/json`) or by parallel routes. Browsing
should cover at least:

- the hash list (`list`) as a page of links;
- a blob page (`get`): metadata (size, detected media type) plus a rendered
  view of the content — images inline, text as text, JSON syntax-highlighted
  ([fjs/media/json-html](../../media/html/todo/665-json-html.md) is the
  building block for that), binaries as a download link;
- recognized dialects rendered with their structure: a
  `vnd.fjs.revision` blob (`fjs/media/revision/`) should show its `subject`,
  `snapshot`, and `parents` as clickable links, so a human can walk the
  revision DAG hash by hash.

The HTML view is read-only browsing; whether any mutating command gets an
HTML form is an exposure-matrix decision for
[command-architecture](./command-architecture.md).

### Tasks

- [ ] Wait for the CAS command architecture design
      ([command-architecture](./command-architecture.md)).
- [ ] Design streaming HTTP request/response body effects in
      `fjs/effects/node` (today `IncomingMessage`/`ServerResponse` carry a
      single `Vec` body, buffered whole by the runner) — prerequisite for
      arbitrary-size `add`/`get`; without it the adapter keeps the 128 KiB
      inline cap.
- [ ] Design authentication and the exposed command subset.
- [ ] Design the HTML browsing surface: routes / content negotiation, the
      list and blob pages, dialect-aware rendering (revision DAG links).
- [ ] Implement the HTTP adapter over the shared command layer, with proof
      coverage against the virtual effects runner.
- [ ] Implement the HTML pages on the same adapter (JSON and HTML are two
      renderings of the same command results, not two code paths).

### Related

- [command-architecture](./command-architecture.md) — prerequisite design.
- [`fjs/cas/evo`](../evo/) — already floats an HTTP(S) server and its auth
  question.
- [fjs/media/json-html](../../media/html/todo/665-json-html.md) — JSON →
  syntax-highlighted HTML rendering for the blob page.
- `fjs/media/revision/` — dialect whose blobs the browser should render as a
  navigable DAG.
- `fjs/effects/node/todo/requestlistener-stateful.md` — HTTP listener
  effects groundwork.
- `fjs/effects/node/module.f.ts` (`IncomingMessage`/`ServerResponse`) — the
  whole-body `Vec` HTTP effects that need a streaming redesign before this
  transport can carry blobs past 128 KiB.
