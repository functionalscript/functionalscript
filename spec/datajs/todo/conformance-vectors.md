## DataJS conformance vectors

**Priority:** P1 — it blocks stage 4, which is P1. Raised with the stages it
sits between; see
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md).
**Status:** open

### Problem

[`spec/datajs/README.md`](../README.md) states conformance in prose. Prose
cannot be executed, so nothing stops the reference implementation and the
specification from drifting apart — which is exactly what happened to the
`fjs/fsc` grammar that stage 2 deleted, unproven and unimported.

Two later stages need this corpus. Stage 4 (`fjs/media/datajs`) must prove its
parser and serializer implement *the spec* rather than each other, and stage 6
must prove the DataJS ⊂ FunctionalScript ⊂ JavaScript subset laws.

Stage 3 is **not** a consumer, though an earlier draft of this file said it was.
Stage 3 is JSON's tokenizer, and what it must prove — that its accepted set
stays JSON's, but for the one enumerated `n`-deletion defect its invariants
name — is a property of JSON, established by JSON's own
accepted-input proofs and by those two invariants
[self-contained-tokenizer](../../../fjs/media/json/todo/self-contained-tokenizer.md)
states, with its character sweeps as coverage rather than proof: that design is
explicit that no finite sweep is exhaustive. A DataJS corpus has nothing to say
about any of it.

**This corpus must therefore land before or together with stage 4**, which is
compatible with running stage 3 first: the sequence is 3, then 1b, then 4.
Landing stage 4 without it would mean writing stage 4's proofs twice.

### Proposal

A machine-readable corpus with three parts:

- **accept** — document text plus the graph it denotes, including the sharing.
  Cases: every leaf (`-0`, `NaN`, `±Infinity`, bigint, `undefined`), the
  `["__proto__"]` key, duplicate keys (last value, first position), array-index
  key ordering, one-line and readable spellings of the same value, empty
  containers, deep nesting, and shared nodes reached by several paths.
- **reject** — document text plus what is wrong with it. Cases: a missing or
  non-final `export default`, a missing `;`, `;;`, a trailing comma, a comment,
  an `import`, an identifier key, a bare or string `"__proto__"` key and its escaped spelling
  `"\u005f_proto__"` (the rule is on the decoded value), `1.5n`,
  `1e2n`, `01n`, `-NaN`, `-undefined`, a bare `-`, a forward or unbound
  reference, a rebound name, each excluded const name, single quotes, `\x` and
  `\u{…}` escapes, U+2028/U+2029/NBSP/FF/BOM outside a string.
- **serializer reject** — programmatic inputs a serializer must refuse rather
  than approximate: a function or symbol leaf, a non-plain built-in (`Date`,
  and at least one that is not — `Map`, `RegExp`, a boxed primitive), a
  sparse-array hole, a symbol-keyed, accessor or non-enumerable own property,
  an array carrying an own property beyond its elements and `length` (`a=[1];
  a.meta=2`), and a cycle. Each is a case where the obvious implementation
  emits a valid document denoting something else. The accessor case asserts
  **two** things: that the input was refused, and that the getter was never
  invoked.
- **graph equivalence** — an input graph and the documents that do and do not
  denote it, so a serializer cannot pass by emitting merely *valid* output:
  `[a,a]` with one shared `a` is not `export default [[],[]];`.
- **normalize** — an input document and the exact bytes normalized form must
  produce: const hoisting by reference identity, post-order `_0`, `_1`, …
  naming, `ToString(Number)` spelling with the `-0` exception,
  `QuoteJSONString` escaping, observable key order, one-line layout. Pin the
  number thresholds explicitly — `1e20`, `1e21`, `1e-6`, `1e-7`,
  `5e-324`, `1.7976931348623157e308` — since that is where a host's own
  formatter diverges, and pin `root=[p,p]` with `p=[c]` so the hoisting count
  is occurrences rather than paths. Include a normalized root that is a bare
  number and a bare bigint, so `export default 1;` cannot regress to
  `export default1;` — which JavaScript rejects, `default1` being one
  identifier.

The corpus is data, not code, so it can be read by an implementation in any
language. It is stored as **JSON, permanently** — not "JSON until DataJS can
read it", which an earlier draft said and which contradicts its own reason: the
corpus must be readable by the very implementation it tests, and a corpus that
only a working DataJS parser can read cannot be used to bring one up. The same
argument applies to every later reimplementation, so the constraint never
lapses.

#### The meta-encoding, since JSON cannot spell what the corpus asserts

That decision has a consequence an earlier draft left implicit, and review was
right that leaving it implicit forces stage 1b to invent a schema and lets
stages 4 and 6 read the same vector differently. Almost nothing in the accept
set is JSON-expressible: sharing, `undefined`, bigint, `NaN`, `±Infinity` and
`-0` are the *point* of DataJS, and the serializer-reject set is worse — a
cycle, a sparse hole, an accessor, a symbol key and a `Date` are not values any
document can carry. So the corpus does not store values. It stores a
**description** of them, and the description is the part this file has to fix:

- **A document is a node table plus a root.** Every node is a tagged object,
  and a reference is `{"ref": <index>}`. Sharing is then something a vector
  *states* rather than something a reader might reconstruct — `[a,a]` with one
  shared `a` is two `{"ref": 3}`s, and `[[],[]]` is two distinct nodes. Cycles
  fall out of the same mechanism, which is what the serializer-reject set
  needs, and no encoder has to detect them.
- **Leaves are tagged and lexical.** `{"num": "-0"}`, `{"num": "5e-324"}`,
  `{"big": "-12"}`, `{"str": "…"}`, `{"bool": true}`, `{"null": true}`,
  `{"undef": true}`, `{"nan": true}`, `{"inf": 1}`, `{"inf": -1}`. Numbers are
  carried as their **exact lexeme**, never as a JSON number: a JSON reader that
  parses `5e-324` and re-emits it has already involved a host formatter, which
  is precisely what the normalize set exists to pin.
- **Arrays are `{"arr": [node, …]}`**, elements in order, each element a node or
  a `ref`. `[a,a]` with one shared `a` is `{"arr": [{"ref": 3}, {"ref": 3}]}`
  and `[[],[]]` is two distinct nodes — the pair of vectors graph-equivalence
  exists to separate, and the encoding has to keep them apart before any
  consumer reads it. A **sparse hole occupies a position** rather than being
  absent, as `{"host": "hole"}`, since a missing element and a hole are
  different inputs and an encoding that drops one cannot state the difference.
- **Objects are ordered pairs, not JSON objects.** `{"obj": [[key, node], …]}`
  — because observable key order and the `"__proto__"` key are vectors here,
  and a JSON object can express neither. The pair form also sidesteps the
  `__proto__` hazard in any host that builds objects from literals.

  **Keys are unique and in observable order**, because these pairs describe the
  *graph*, not the document. A duplicate-key vector lives on the other side of
  the accept pair: the document text says `{"a":1,"b":2,"a":3}` and the graph
  it denotes is `[["a", 3], ["b", 2]]` — last value, first position, which is
  the rule the vector exists to pin. Letting `obj` carry all three source
  members would make the encoding a second parser, and one two consumers could
  disagree about; letting it carry duplicates without a collapse rule would be
  worse. The document half is a string, so it can say anything; the graph half
  is normalized by construction.
- **Host-only inputs are recipes, not data.** A `Date`, a function, a symbol
  key, an accessor, a non-enumerable property, a sparse hole and an array
  carrying an own property beyond its elements cannot be described as values at
  all, so each is a named recipe the consumer builds. The vocabulary is
  **closed, and closed means enumerated** — "and so on" was an open list
  wearing the word closed, which review caught. Four **leaf** recipes:

  | recipe | builds |
  | - | - |
  | `{"host": "fn"}` | a function value |
  | `{"host": "symbol"}` | a fresh unique symbol, as a *value* |
  | `{"host": "builtin", "kind": <kind>[, "ms": <integer>]}` | a non-plain built-in object: `date` (with `ms`), `map`, `regexp` or `boxedNumber` |
  | `{"host": "hole"}` | an array hole — legal **only** as an `arr` element |

  …and four **modifier** recipes, each taking the node it applies to, so the
  property cases say which object they are about — the gap review found in
  `getter`, which named no container:

  | recipe | builds |
  | - | - |
  | `{"host": "ownProp", "on": <node>, "key": <string>, "value": <node>}` | an enumerable own data property, which is how `a=[1]; a.meta=2` is said |
  | `{"host": "nonEnumerable", "on": <node>, "key": <string>, "value": <node>}` | the same, non-enumerable |
  | `{"host": "getter", "on": <node>, "key": <string>, "value": <node>}` | an accessor property that **records its own invocation** and then returns `value` |
  | `{"host": "symbolKey", "on": <node>, "value": <node>}` | a property under a fresh unique symbol |

  Modifiers **apply in the order the nodes appear**, so a node carrying several
  is unambiguous. A cycle needs no recipe: it is a `ref` to an ancestor.

  Two of these carry an obligation the recipe alone does not express, and both
  came from review:

  - **`getter` must be observable, not merely present.** The spec forbids
    reading a getter *because reading it is an effect*
    ([`README.md`](../README.md)), so a serializer that invokes the accessor
    while enumerating and rejects the object afterwards is wrong and would pass
    a vector that only checked the rejection. The recipe therefore records its
    invocation, and **the vector asserts it was never invoked** as well as that
    the input was refused. Rejecting for the right reason and rejecting after
    doing the forbidden thing are different outcomes.
  - **`builtin` covers a class, not `Date`.** The spec rejects "a `Date`, or
    any other non-plain object", and a corpus naming only `Date` is passed by
    an implementation that special-cases `Date` and serializes an empty `Map`
    or `RegExp` as `{}` — valid output denoting something else, which is the
    failure the serializer-reject set exists to catch. The `kind` list is
    closed like everything else here, and `map`, `regexp` and `boxedNumber`
    are in it precisely because they are *not* `Date`.

  The list being closed is what makes it useful — a vector needing a recipe not
  in it extends the schema and both consumers, deliberately, rather than each
  consumer improvising. Each implements the eight once, and the corpus stays
  data.

The test of this encoding is whether two independent consumers can disagree.
They cannot: identity is an index, a number is a lexeme, key order is array
order, and the host values are a closed vocabulary rather than a construction
the reader improvises.

Two properties worth proving directly rather than case by case: every
**accept** document parses in FunctionalScript to the same graph, and every
**accept** document is accepted by a JavaScript engine with the same result.
Those are the subset laws, and they can run over the whole accept set.

**They land at different times, and this corpus only owes the second.** The
FunctionalScript check cannot run when this corpus lands: today's front end has
no `NaN`, `Infinity` or `-Infinity`, and its statement separator is a newline
rather than `;` — both are stage 5's work
([parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)).
Running it earlier would fail on almost every accept vector, for reasons that
are not the corpus's fault. So the FunctionalScript subset law is **stage 6's
task**, over this corpus, and this file only requires the JavaScript one, which
needs nothing beyond an engine.

### Tasks

- [ ] Write the meta-encoding down as a schema before any vector, per the
      section above: node table, `ref` indices, the leaf tags, the `arr` form
      with holes occupying positions, the object pair form **with unique keys
      in observable order**, and the eight `host` recipes — four leaves, four
      modifiers, each modifier naming the node it applies to — with their
      application order, `builtin`'s closed `kind` list, and `getter`'s
      invocation record. It is the part two
      consumers can silently disagree about, so it lands first and gets its own
      round-trip proof — encode a graph, decode it, and assert the sharing
      survives.
- [ ] Choose the corpus's location. The encoding is settled above: JSON,
      permanently, per the bootstrapping constraint.
- [ ] Write the accept, reject and normalize sets covering the cases listed.
- [ ] Add the **JavaScript** whole-set subset-law check. The FunctionalScript
      one is stage 6's, once stage 5 has taught the front end `;` and the
      special numbers — see above.
- [ ] Point stages 4 and 6 at the corpus as their proof source. Not stage 3 —
      see above.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`spec/datajs/README.md`](../README.md) — the specification the corpus
  makes executable; its Conformance section links back here.
- [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  — the plan; this is the second half of its stage 1.
