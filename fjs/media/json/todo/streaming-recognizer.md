## streaming-recognizer. A payload-free, O(depth) JSON validity recognizer

**Priority:** P3
**Status:** open

### Problem

`fjs/media/json` can turn text into a value (`parse`), but it has no way to
answer the cheaper question *"is this a valid JSON document?"* without paying
to build the value. `parse` in
[`../parser/module.f.mjs`](../parser/module.f.mjs) folds the grammar's
mappings into a whole `ParseUnknown` value — O(n) memory in the document size —
and its string mappings build each string's text, so even a caller that
discards the value has paid O(token length) for a single huge string. The
[`../../../ebnf/ll1`](../../../ebnf/ll1/README.md) parser it runs on also takes
the whole input as one array, so nothing here streams.

The immediate driver is `fjs/media/type`
([detect-json](../../type/todo/detect-json.md)): its `detectStream` classifier
is deliberately O(1)-space over blobs larger than one `Vec`, and it wants to
fold JSON validity in alongside its UTF-8 and magic-byte factors. It cannot
adopt anything that is O(n) or O(token length). More broadly, a
validate-without-materialize primitive is generally useful (size checks,
guards, streaming ingestion) and belongs in `fjs/media/json`, not hand-rolled in
each consumer.

An earlier design here factored a withdrawn hand-written `Scan<S>` scanner
over its builders, per UTF-16 code unit; that reader was reverted in
[#1895](https://github.com/functionalscript/functionalscript/pull/1895) and
replaced by the grammar, so none of that design survives. What survives is the
requirement and the depth-cap contract below.

### Proposal

**A recognizer is a parse that discards its mapping.** Run JSON's own grammar,
[`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs), with no
value-building mapping, so the recognizer and `parse` share one description of
"valid JSON" by construction. That is
[recognizer-backend](../../../ebnf/todo/recognizer-backend.md)'s AST-less LL(1)
recognizer applied to one grammar; streaming input needs the one-symbol-at-a-time
parser of [043-stateful-parser](../../../ebnf/todo/043-stateful-parser.md).
Whether that is enough — in particular, whether a string rule read with no
mapping holds anything per character — is the question to answer before
writing code here.

**The depth cap is opt-in and chosen at init.** It bounds the stack for a
consumer that needs a DoS guard, and it is the one place the recognizer may
disagree with `parse`, which stays uncapped.

- **What it counts:** the greatest number of containers open **at once**. A
  document with no container has depth 0 — a cap of `0` accepts `1` and `"a"`
  and rejects `[]` — and `[]` has depth 1. A cap of `n` accepts a document with
  exactly `n` open containers and rejects one with `n + 1`.
- **What may be passed:** a finite non-negative integer. `-0` is `0`. Every
  other `number` — `-1`, `1.5`, `NaN`, `Infinity` — is refused, because each
  has a plausible reading another implementation would pick (rounding, rejecting
  everything, or silently uncapping).
- **How it refuses:** the capped entry point returns `null` for an invalid cap
  and is named `try…` for it, per [REVIEW.md](../../../../doc/REVIEW.md). A
  permanently rejecting state would be indistinguishable from invalid content,
  and a MIME detector fed one would report every valid JSON blob as
  `text/plain`.

**Correctness property.** With the cap disabled, the recognizer accepts exactly
the documents `parse` returns `ok` for. With a finite cap, agreement holds for
inputs within the limit; an over-cap document is rejected by design.

### Tasks

- [ ] Answer the question above: whether recognizer-backend's AST-less LL(1)
      recognizer over `fjs/ebnf/lib/json` is the recognizer, or what it lacks.
- [ ] The uncapped recognizer and the capped `try…` entry point, with the
      contract above.
- [ ] Proof (cap disabled): the recognizer agrees with `parse`'s `ok`/`error`
      across the existing parser corpus; large-single-token cases (a huge
      string, a long number) hold no payload buffer.
- [ ] Proof (invalid cap): `null` for each of `-1`, `1.5`, `NaN` and
      `Infinity`; a state for `-0`, behaving as a cap of `0`.
- [ ] Proof (cap enabled): both sides of the boundary — `n` open containers
      accepted, `n + 1` rejected — on arrays, on objects, and on an alternating
      mix; a cap of `0` accepts a bare scalar and rejects `[]`.
- [ ] `tsc`, `fjs test`.

### Related

- [recognizer-backend](../../../ebnf/todo/recognizer-backend.md) — the AST-less
  LL(1) recognizer this is an instance of.
- [043-stateful-parser](../../../ebnf/todo/043-stateful-parser.md) — the
  streaming input a size-independent consumer needs.
- [detect-json](../../type/todo/detect-json.md) — first consumer; needs
  O(depth), payload-free validity to keep `detectStream` size-independent.
- [`../parser/module.f.mjs`](../parser/module.f.mjs) — `parse`, whose `ok`/`error`
  the recognizer must agree with.
