## Unify streaming state-machine interfaces

**Priority:** P3
**Status:** wip

### Problem

Several modules expose the same lifecycle under different names and calling
conventions: an initial state, an operation that consumes input, and an operation
that finishes the state. A driver has to know each module's spelling instead of
accepting one shared interface.

[`StateFold`](../types.ts) names `init` / `update(state, input)` / `end(state)`,
but the concrete APIs use `append`, `push`, `feed`, `finish`, separate initializers,
and different argument orders. [`Accumulator`](../../../list/types.ts) packages
the lifecycle too, with input-first arguments and `null` for an early abort.

Some machines also emit output during consumption or flush output at EOF. A
value-only fold cannot express that without collecting output that could have
streamed. The [flow proposal](../../../../../todo/flow.md) already describes a
`Transducer` with emission, early completion, and a final result, but it has not
been implemented as a shared operator contract.

### Proposal

Use one `init` / `update(state, input)` / `end(state)` protocol for all these
machines. Reuse the `Transducer`, `Step`, and `Terminal` contract in the flow
proposal, keeping its definition in one place. Make the operator protocol usable
without requiring a dataflow graph or engine. Value-only folds are the case
with no emitted items and their result in the terminal summary; emitting stages
retain both their output stream and their final summary.

Reconcile `StateFold`, `StateScan`, and `Accumulator` with that protocol as part
of the API change. Keep useful simple forms as derived conveniences or adapters
with one shared lifecycle underneath. Domain-specific construction still supplies
parameters such as a monoid, a storage value, or a hash algorithm; the resulting
machine exposes the common lifecycle. Hash sizes and other domain operations
remain available alongside it.

This is the operator migration that [flow](../../../../../todo/flow.md) can
consume; it does not require implementing its graph, optimizer, or backends.
The [stateful parser](../../../../ebnf/todo/043-stateful-parser.md) remains a separate implementation task. Its proposal uses the same operator contract; the machine-family stack does not change parser semantics.

### Interfaces before this migration stack

| Machine | Current lifecycle | What completion does |
| --- | --- | --- |
| [Monoid fold](../../../../common/monoid/module.f.mjs) | Empty run stack, `step`, `collect`; absorbing fold through `Accumulator` | Combines pending runs, preserving the balanced grouping and element order. |
| [SHA-1/SHA-2](../../../../crypto/sha2/types.ts) | `Hash.init`, `append`, `end` | Pads the tail and returns the digest or the hash's result type. |
| [Adler-32](../../../../zlib/adler32/module.f.mjs) | `init`, `append`, `end` | Encodes the running checksum. |
| [MIME detection](../../../../media/type/module.f.mjs) | `detectInit`, `push`, `finish` | Returns length, MIME type, and text/binary classification. |
| [SUL encoding](../../../../sul/module.f.mjs) | `emptyEncodeState`, `push`, `end` | Pads until the root identity is produced. |
| [Patricia trie](../../../patricia_trie/module.f.mjs) | `emptyState`, `push`, `end` | Drains the right-spine candidates into a root and final storage. |
| [Git inflater](../../../../git/inflater/module.f.mjs) | `start`, `feed`, `finish` | Returns accumulated output or a truncation/trailing-byte refusal. |
| [Bounded bit-vector builder](../../../bit_vec/module.f.mjs) | `Accumulator` inside `unpackListToVec`, driven by `tryFold` | Checks length while consuming, then combines and packs the runs. |
| [zlib inflater](../../../../zlib/inflate/module.f.mjs) | `init`, emitting `append`, `end` | Reports closure and the trailing-byte count. |
| [Unicode decoders](../../../../text/code_point/module.f.mjs) | `decoder(byteOp, eofOp)`, starting from `null` | Emits during updates and flushes an incomplete UTF-8/UTF-16 sequence at EOF. |

The shared interface does not imply that every machine is a monoid: associativity
and regrouping remain properties of the particular operation. State, emitted
items, and terminal results are distinct, including when any contains `null`.

### Behavior to preserve

- Completion is explicit. EOF can flush output or finalize a result even when
  the input is empty; an empty input chunk is not EOF.
- Early completion stops the driver from pulling more input. A MIME verdict
  being settled does not complete its length count, and zlib's internal `done`
  phase does not complete its trailing-byte count. Both must still consume the
  remaining input.
- Preserve lazy short-circuiting for absorbing folds and overflowing bit-vector
  builders. Keep malformed, truncated, and trailing-data outcomes distinct;
  use the protocol's terminal result for domain failures without adding another
  generic error channel.
- A driver that stops inside a chunk must preserve the caller's unconsumed
  suffix. Keep `git/inflater.feedWithin`'s bounded consumption contract explicit;
  the common interface must not silently discard the rest of that chunk.
- Preserve incremental output. Wrapping the low-level inflater or a Unicode
  decoder must not accumulate the whole output merely to fit the interface.

### Tasks

The stack follows the [review request](https://github.com/functionalscript/functionalscript/pull/3460#pullrequestreview-5719913841): the common protocol and drivers first, then one machine family per pull request. Each step includes its own callers, proofs, scoped coverage, and documentation.

- [x] Establish the shared protocol, construction adapters, and pure/effectful drivers.
- [x] Migrate monoid accumulation, including absorbing folds and their callers.
- [x] Migrate bounded bit-vector construction and preserve overflow stopping.
- [x] Migrate SHA-1/SHA-2 and every direct hash caller.
- [x] Migrate CAS admission and digest consumers to the shared effectful driver.
- [x] Migrate Adler-32 and its checksum callers.
- [ ] Migrate emitting zlib inflation and adapt its direct Git consumer.
- [ ] Migrate the Git inflater lifecycle and packstore callers.
- [ ] Migrate Unicode decoding with streaming emission and EOF flush.
- [ ] Migrate MIME detection and preserve whole-input length counting.
- [ ] Migrate Patricia construction and its SUL hash-level caller.
- [ ] Migrate full SUL encoding and finish the common API documentation.

### Related

- [`StateFold` and `StateScan`](../types.ts) — existing operator shapes.
- [Flow](../../../../../todo/flow.md) — the proposed emitting lifecycle.
- [Stateful parser](../../../../ebnf/todo/043-stateful-parser.md) — a planned
  consumer of the same lifecycle.
- [Shared digest fold](../../../../cas/todo/shared-digest-fold.md) — deduplicates
  CAS hash drivers; use the common hash lifecycle when it lands.
