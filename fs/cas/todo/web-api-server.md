## web-api-server. Web API (HTTP) server as a third CAS transport

**Priority:** P4
**Status:** blocked
**Blocked by:** [command-architecture](./command-architecture.md)

### Problem

CAS is reachable only through the CLI and the stdio MCP server. Both are
per-user, per-process front ends: browsers and remote clients cannot reach
a store at all, and every stdio MCP instance carries its own process state —
the Evo proposal ([evo](./evo.md)) already runs into this and floats an
HTTP(S) server as the way to share one cache across many clients.

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
  non-local (also flagged in [evo](./evo.md)) and needs its own design
  before the server is reachable beyond localhost;
- request/response validation should derive from the same command
  declarations that drive the CLI and MCP adapters;
- large blobs favour HTTP: streaming request/response bodies avoid the MCP
  128 KiB inline-content cap, so `add`/`get` of arbitrary-size content is a
  natural fit for this transport.

### Tasks

- [ ] Wait for the CAS command architecture design
      ([command-architecture](./command-architecture.md)).
- [ ] Design authentication and the exposed command subset.
- [ ] Implement the HTTP adapter over the shared command layer, with proof
      coverage against the virtual effects runner.

### Related

- [command-architecture](./command-architecture.md) — prerequisite design.
- [evo](./evo.md) — already floats an HTTP(S) server and its auth question.
- `fs/effects/node/todo/requestlistener-stateful.md` — HTTP listener
  effects groundwork.
