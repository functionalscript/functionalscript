## Support asynchronous Node effects natively

**Priority:** P3
**Status:** wip
**Blocked by:** [Implement the native effect runner](./nanvm-effects-node.md)

### Problem

Some effects in [`fjs/effects/node/`](../fjs/effects/node/) need asynchronous
execution to preserve their observable contracts. The minimal synchronous
runner does not supply that execution support.

This is the asynchronous part of the [native Node-effects task](./nanvm-effects-node-operations.md),
within its native scope. The referenced directory defines the evolving effect
set; do not duplicate its enumeration here.

### Which effects are asynchronous

A criterion rather than a list, so that an effect added to the directory later
can be placed without this file: **an operation is asynchronous when the
program has to be re-entered before it can answer** — another effect chain of
the same program must run while the operation is outstanding, or the
operation's answer is defined by another chain's life.

Only one thing in the directory re-enters the program: a server. `createServer`
takes a `RequestListener`, and every request `listen` admits calls that
listener — a new effect chain, run while the program's own chain is parked
(`answerRequest` in [`module.mjs`](../fjs/effects/node/module.mjs)). The
members today:

- `listen` answers on the bind outcome, not on the call, and from then on
  requests arrive on their own, each one a chain.
- `readRequestBytes` pulls bytes a client has not necessarily sent yet; while a
  request's chain waits for them, other requests and the program go on.
- A response body is pulled at the socket's pace (`pumpBody`): a chain parked
  on the client's `drain` or on its `close`.
- `forever` never answers. The chain that reaches it is parked for the rest of
  the run, and the run goes on for as long as a server has a connection to
  accept or a request to answer. The virtual runner cannot answer it for the
  same reason — it has no chain to run meanwhile — and answers `notImplemented`
  ([`virtual/module.f.mjs`](../fjs/effects/node/virtual/module.f.mjs)).

Everything else waits for the outside world and nothing is lost by blocking on
it — **until a server listens**. A program that listens and then `fetch`es its
own server from its main chain, which is the shape of a cross-runner proof,
deadlocks if the `fetch` blocks the thread that would answer the request. The
same holds for `exec` of a client and for `read` on a server that also reads
its standard input. So asynchrony is a property of the *run*, entered at
`listen`, and not of an operation; that is why this TODO is about execution
support and not about handlers.

Synchronous within this scope, each with its reason, because each one looks
asynchronous in `module.mjs`:

- `all`. The Node runner uses `Promise.all`; the virtual runner folds the
  effects in order, every proof against it holds, so order is the contract.
  Where concurrency was once observable — two pulls of one request-body cell —
  the Node runner serializes on purpose (`requestBodyReader`'s queue) so that
  it meets the virtual runner's refusal. Natively `all` runs its effects in
  order through the same loop, as the owner stated on
  [#2573](https://github.com/functionalscript/functionalscript/pull/2573#issuecomment-6019687973).
- `test`. `TestContext` is a host framework's; natively there is none, and the
  Node runner's own strategy for a framework that cannot nest (`inlineTest`)
  runs the body at once and reads `expectFailure` as "a throw is the pass".
  That is the native `test`.
- `await`. It exists to await a host `Promise`; no native value is one, so the
  answer is `[p]`, exactly the Node runner's answer for a non-promise.
- `inflate`. `inflateSync` already.

### Proposal

**One VM thread, chains, and one completion queue.** This is the shape Node
itself has — one JavaScript thread and a thread pool that moves bytes — and it
follows from one fact about the VM: its values are not `Send` (`Naive` holds
`Rc`), so nothing VM-typed may cross a thread. Host threads carry bytes,
numbers and host errors; marshalling into VM values happens on the VM thread.

- A **chain** is one effect run by the minimal loop of
  [the runner TODO](./nanvm-effects-node.md): the same `typeof_`, `dot`, `call`
  steps over the same `Pure`/`Do` representation. The **main chain** is the
  program's effect; `listen` admits requests, and each becomes a chain
  `listener(request)` that ends when its response is delivered and its
  `release` has run. A request chain is a sibling of the main chain, never run
  inside the operation that admitted it, so a long run of requests does not
  grow the stack any more than a long effect sequence does.
- The minimal loop stays what it is: one ordinary synchronous loop. The
  asynchronous runner is a **second loop with one more exit**: an operation
  answers at once, or **parks** — the chain is set aside under a key and a host
  thread is told what to wait for. The step itself — classify an effect as a
  `Pure` or read a `Do`'s three properties — is shared with the minimal loop;
  how it is factored is the implementer's room.
- Host threads: an accept loop per listening server; one thread per
  connection, which parses request heads, hands body chunks over as they are
  pulled, writes response bytes as the pump hands them, and reports `drain`
  and `close`; one thread per outstanding wait on another party — `fetch`,
  `exec`, `read`. Each posts its completion, keyed, to **one queue**.
- The **scheduler** runs the chain whose completion arrived, by calling that
  chain's continuation with the complete FJS result, as the minimal loop does.
  When no chain is runnable it blocks on the queue, which is the only place the
  VM thread blocks. The run ends when the main chain answers its `Pure`: that
  answer is `run`'s result, so the crate's public API stays the one function
  the runner TODO gives it. A server still listening when the main chain
  answers is the embedder's to close, as it is the host's under `runEffect`.
- Filesystem and console operations block inline on the VM thread, on every
  host. Their waits are the machine's own, bounded, and not another party's;
  Node draws the same line visibly (`inflateSync`, and a filesystem call that
  does hang holds a pool thread for the life of the process). The alternative
  — every operation on a host thread, the whole thread-pool model — buys
  nothing a proof can observe and costs a thread hop per file read.
- `forever` parks the main chain with no completion to wait for. When
  **nothing can ever complete** — no server listening, no request in flight,
  the main chain parked in `forever` — the run cannot produce a result. Node
  reports this at the top level, outside the runner, as exit code 13
  (`Detected unsettled top-level await`, measured with Node 22.22.0). The
  native runner refuses it ([DESIGN.md §10](../doc/DESIGN.md#10-refuse-what-you-cannot-handle))
  as an outcome distinct from a result and from a throw; a `forever` answered
  with a plausible value is the wrong answer that section forbids.
- **Handles.** `Server` and `RequestBody` are `Nominal`s over `unknown`, so
  what is inside is the runner's. Natively each is the runner's own key into
  its table — unique per `createServer` call, so two servers with one listener
  stay two servers and `listen` on a listening one is `ERR_SERVER_ALREADY_LISTEN`,
  as the virtual runner's `{ listener }` handle arranges — in whatever form the
  [operations task](./nanvm-effects-node-operations.md) picks for `Handle`.
- **HTTP/1.1 over `std::net`, by hand, with no external crate.** Request line
  and headers; `Content-Length` and chunked request bodies; keep-alive, with
  the requests of one connection answered in order; the runner's own answers
  where the listener structurally cannot give one — `CONNECT` is `501`, a
  listener that threw is `500` before the head and a destroyed socket after
  it. Node's `http` has no TLS and no HTTP/2, so neither does this.
- **The gates are FJS and stay FJS.** `responseGate`, `runnerResponse`,
  `requestBody`, `carriesNoBody`, `emptyHostMessage` and their kin live in
  [`module.f.mjs`](../fjs/effects/node/module.f.mjs) so that a refusal a
  program is proven against under the virtual runner is the refusal it meets
  under Node. The native runner calls the same functions, AOT-compiled, through
  the VM rather than restating them in Rust: a restatement is a third copy that
  drifts. This depends on `fjs compile` covering that module's closure
  ([#2583](https://github.com/functionalscript/functionalscript/pull/2583)
  lists what stops it today); until it does, a Rust restatement is a stated
  deviation, not a design.

**Alternatives not taken.** VM values made `Send` so that a thread may run a
chain: changes the VM for the runner's sake. An asynchronous runtime and HTTP
crates: the workspace has no dependency, the VM values would still confine
every chain to one thread, and the parsing those crates do is a few hundred
lines of `std`. Non-blocking sockets polled on the VM thread: `std` has no
`poll`, so this is the dependency again, for what threads do without one.

**Verification against the Node runner** is the same FJS fixture program run
under both runners, with the harness comparing the answers — the pipeline
[#2581](https://github.com/functionalscript/functionalscript/pull/2581) builds
in miniature. A fixture takes its port from `args`, since a program that binds
port `0` cannot learn which port it got. The fixtures this needs: a server that
answers a `fetch` from its own main chain; a body pulled twice, refused with
`requestBodyOffsetMessage`; a listener that throws, answered `500`; a body
shorter than its declared length, destroyed; two `createServer` calls with one
listener; and `forever` with nothing listening, the unsettled outcome. The
virtual runner is the third witness for every fixture but the last.

**Decisions this leaves to the owner**, each with the answer proposed above:
the filesystem blocking inline rather than on a host thread; `forever` with
nothing outstanding refused as a third outcome rather than reported some other
way, and the type that outcome takes in `run`'s signature; the gates called
through the VM rather than restated; `fetch` of an `https:` URL refused with an
`ioError` until a TLS decision is made, rather than a TLS dependency now.

### Tasks

- [x] Define the execution support (this proposal).
- [ ] The scheduler: chains, park and resume, the completion queue, and
      `forever`; proven with a test boundary whose operation parks and
      completes from a host thread, including that the main chain's `Pure`
      ends the run and that a main chain parked forever with nothing
      outstanding is the unsettled outcome.
- [ ] Waits on another party through the queue: `fetch` (`http:` only),
      `exec`, `read`.
- [ ] `createServer` and `listen`: the accept loop, request heads, one chain
      per request, the bind outcome answered to `listen`, `EADDRINUSE`, the
      empty-host refusal, `CONNECT`.
- [ ] `readRequestBytes`: body streaming, the offset check and the recorded
      stream failure, `connection: close` for a body the listener did not
      finish.
- [ ] Response delivery: the gates, the head, the pump at the socket's pace,
      the count against the declared length, destroy on a mismatch and on a
      failed cell, `release` once on every exit, `500` or destroy for a
      listener that threw.
- [ ] The cross-runner fixtures above, run under Node and natively; then
      delete this file.

### Related

- [Implement the native effect runner](./nanvm-effects-node.md) — the minimal
  loop a chain runs by; unchanged by this work.
- [Implement the Node effects natively](./nanvm-effects-node-operations.md) —
  the parity task this is the asynchronous half of.
- [`fjs/effects/node/module.mjs`](../fjs/effects/node/module.mjs) — the Node
  runner whose contracts are preserved; each handler's comment states its own.
- [`fjs/effects/node/virtual/module.f.mjs`](../fjs/effects/node/virtual/module.f.mjs)
  — the synchronous witness: in-order `all`, and why `forever` is absent.
- [`fjs/web/module.f.mjs`](../fjs/web/module.f.mjs) — the program shape this
  serves: create, listen, announce, `forever`.
- [request-body-timeouts](../fjs/effects/node/todo/request-body-timeouts.md),
  [request-body-lifetime](../fjs/effects/node/todo/request-body-lifetime.md),
  [streaming-http-bodies](../fjs/effects/node/todo/streaming-http-bodies.md) —
  server contracts still moving, which the native server inherits as they
  settle.
- [MVP roadmap](../nanvm-lib/todo/mvp-roadmap.md#effects-the-nanvm-effects-node-runner-crate-decided)
  — where the synchronous loop's no-scheduler statement is scoped to that loop.
