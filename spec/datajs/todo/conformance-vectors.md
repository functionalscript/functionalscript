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

A machine-readable corpus with six parts:

- **accept** — document text plus the graph it denotes, including the sharing.
  Cases: every leaf (`-0`, `NaN`, `±Infinity`, bigint, `undefined`), the
  `["__proto__"]` key, `-0n` — an accepted input spelling denoting `0n`, since
  bigint has no negative zero — a `const` referenced exactly once and a
  `const` never referenced at all — the grammar imposes no reference count, and
  the
  normalizer's counting rule is one serializer's rather than a validity rule —
  a `const` bound to a **contextual keyword** (`async`, `as`, `from`, `get`,
  `of`, `set`), which the grammar permits and a reader borrowing JavaScript's
  reserved-word list would refuse,
  duplicate keys (last value, first position), array-index key
  ordering **with its boundaries** — a vector mixing real index keys with
  `"4294967295"` (outside the range, since an index is `0 ≤ n < 2^32 − 1`),
  `"01"` (non-canonical) and `"1.0"`, all of which are ordinary keys in
  first-occurrence order. `{"2":0,"1":0}` alone is passed by an implementation
  that treats every decimal-looking key as an index, which reorders the three
  above and corrupts observable key order; one-line and readable spellings of
  the same value; empty containers, deep nesting, and shared nodes reached by
  several paths.
- **reject** — document text plus what is wrong with it. Cases: a missing or
  non-final `export default`, a missing `;`, `;;`, a trailing comma, a comment,
  an `import`, an identifier key, a bare or string `"__proto__"` key and its
  escaped spelling `"\u005f_proto__"` (the rule is on the decoded value), a
  a number spelling JavaScript takes and DataJS does not — `0x10`, `+1`, `.5`,
  `1.`, `1_0`, `01` — and two identifier spellings it takes and DataJS does
  not: a **non-ASCII** one, `const é=1;export default é;`, and an **escaped**
  one, `const \u0061=1;export default \u0061;`. Both are valid JavaScript, so a
  reader borrowing the host's number or identifier grammar passes the whole-set
  JavaScript check and only this corpus can catch it. The escaped case is the
  one the ASCII rule alone does not reach: `\u0061` *denotes* `a`, which is a
  perfectly good `id`, so the vector is about the spelling and nothing else —
  which is also why **both** occurrences are escaped. Escaping only the
  declaration, as the review that found this proposed, leaves `export default
  a;` referring to a name DataJS never saw declared, and an implementation with
  no spelling check at all refuses it for the unbound reference — a second
  ground, and the rule below forbids exactly that; a
  computed key that is **not** the one permitted spelling — `{["x"]:1}` and
  `{["\u005f_proto__"]:1}`, since `["__proto__"]` is the only computed form
  the grammar admits — `1.5n`,
  `1e2n`, `01n`, `-NaN`, `-undefined`, a bare `-`, a forward or unbound
  reference, a rebound name, each excluded const name, and the five string
  spellings JavaScript takes and DataJS does not — single quotes,
  a **template literal**, a `\x` escape, a `\u{…}` escape and a **line
  continuation**, a backslash before a raw newline, which JavaScript reads as
  `"ab"` in `export default "a\<LF>b";`; U+2028/U+2029/NBSP/FF/BOM outside a
  string.
- **serializer reject** — programmatic inputs a serializer must refuse rather
  than approximate: a function or symbol leaf, a non-plain built-in (`Date`,
  and at least one that is not — **`Map` or a boxed number**, not `RegExp`;
  see below), a sparse-array hole, a symbol-keyed, accessor or non-enumerable
  own property,
  an array carrying an own property beyond its elements and `length` (`a=[1];
  a.meta=2`), and a cycle. Each is a case where the obvious implementation
  emits a valid document denoting something else. The accessor case asserts
  **two** things: that the input was refused, and that the getter was never
  invoked.

  **Every rejection vector must be refusable for exactly one reason.** Review
  found three vectors that a *cheaper* rule could refuse before the rule under
  test ran — a non-enumerable `getter`, a non-enumerable `symbolKey`, and a
  `RegExp` carrying an own non-enumerable `lastIndex` — and in each the vector
  passed while the implementation was wrong. A vector with a second ground for
  refusal tests whichever ground the implementation happens to reach first,
  which is not the one it was written for.

  **Derive the narrowing vectors from the spec's own narrowing sentences.**
  Everywhere DataJS is narrower than JavaScript, the whole-set subset law is
  blind — it asks only whether an *accept* vector is valid JavaScript, never
  whether something DataJS rejects would be accepted by the host — so a reject
  vector is the only instrument that sees it. Three consecutive review rounds
  each found one missing: the plain number spellings and the non-ASCII
  identifier together, then the *escaped* identifier spelling, then the string
  spellings. Every time the list had been written from memory instead of read
  off the spec — and the second round is the telling one, since the class had
  just been named and the list still went unchecked. So the fix is to name the
  source. The spec narrows in three places and each owes vectors:

  - **Strings** — the closing sentence of its §Strings: single quotes,
    template literals, `\x`, `\u{…}`, line continuations. Five, and the list
    above now has five.
  - **Numbers** — the closing sentence of its §Numbers: no hex, no leading
    `+`, no leading or trailing point, no separators, no leading zeros.
  - **Identifiers** — §Identifiers' ASCII-only rule, which excludes both a
    non-ASCII letter and the `\uXXXX` spelling of an ASCII one.

  Plus what DataJS simply lacks where JavaScript has it: comments, `import`,
  identifier keys, trailing commas, and the space characters above.

  **Bigints are not on this list.** JavaScript rejects `1.5n`, `1e2n` and `01n`
  too — measured, not assumed — so those vectors test the corpus's own grammar
  rather than a narrowing, and no reader can over-accept them by delegating.

  The rule has now caught one *before* it landed — the escaped-identifier
  vector above, whose proposed spelling left an unbound reference as a second
  ground. That is the first time it worked as a design constraint rather than
  as a post-mortem, which is the whole point of writing it down.

  The rule reaches the leaves too, which review found by applying it: an
  ordinary function has own non-enumerable `name` and `length`, and a
  non-arrow adds a non-configurable `prototype` — so a serializer that
  never learned to reject functions can refuse one through its
  non-enumerable-property check. An arrow function's `name` and `length` are
  configurable, so deleting them leaves a callable with **no own properties**
  at all, and refusing it requires recognizing a function. `symbol` needs no
  such care: it has none to begin with.
- **serializer accept** — programmatic inputs a serializer must **not** refuse,
  each with the **graph its output must denote**. Not the exact document:
  whitespace, layout, const names and the hoisting of singly-reached values are
  free choices ([`README.md`](../README.md)), so pinning bytes here would fail
  conforming serializers. Exact bytes are the `normalize` set's business alone.
  The spec is explicit that these are outside the data model rather than
  invalid, and that rejecting them is a
  defect rather than caution ([`README.md`](../README.md)): a `null`-prototype
  object or array, an `Array` subclass, a frozen or sealed object, a
  non-extensible object, and a non-writable property. `Object.freeze` produces
  the last two together, so a serializer that rejects unusual descriptors
  cannot serialize a frozen value — including the output of a reader that
  freezes what it returns, which the spec permits. What each vector asserts is
  that the output is **valid and denotes the input's data** — the host
  variation leaves no trace, and `graph equivalence` supplies the comparison.
- **graph equivalence** — an input graph and the documents that do and do not
  denote it, so a serializer cannot pass by emitting merely *valid* output:
  `[a,a]` with one shared `a` is not `export default [[],[]];`.
- **normalize** — an input document and the exact bytes normalized form must
  produce: const hoisting by reference identity, post-order `_0`, `_1`, …
  naming, `ToString(Number)` spelling with the `-0` exception,
  `QuoteJSONString` escaping — including a **lone surrogate**, which must come
  back as `\ud800` in lowercase hex rather than a replacement character —
  observable key order, one-line layout. Pin the `__proto__` key's exact bytes,
  `{["__proto__"]:1}`: a normalizer reusing an ordinary key writer emits
  `{"__proto__":1}`, which is not DataJS at all and which JavaScript reads as
  prototype replacement rather than an own property — a normalized form that
  denotes a different graph than its input. Pin that
  `-0n` normalizes to `0n` — the grammar accepts the spelling and normalized
  form must never emit it, which is the one place a bigint and a number differ
  on negative zero. Pin the
  number thresholds explicitly — `1e20`, `1e21`, `1e-6`, `1e-7`,
  `5e-324`, `1.7976931348623157e308` — since that is where a host's own
  formatter diverges, and pin `root=[p,p]` with `p=[c]` so the hoisting count
  is occurrences rather than paths. Include a normalized root that is a bare
  number and a bare bigint, so `export default 1;` cannot regress to
  `export default1;` — which JavaScript rejects, `default1` being one
  identifier. Include an **identifier-starting** root as well (`NaN`, or any of
  `true`, `false`, `null`, `undefined`, `Infinity`): a normalizer that
  dispatches on type can emit the space for digits and drop it for words,
  producing `export defaultNaN;`, and the two numeric roots cannot see that.

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
  `{"big": "-12"}`, `{"str": [<code unit>, …]}`, `{"bool": true}`,
  `{"null": true}`,
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

  **Every string in the corpus is an array of UTF-16 code units** — leaf
  values, object keys, and the `key` of a `host` recipe alike — never a decoded
  JSON string. DataJS strings are code-unit sequences, so a valid document can
  hold a **lone surrogate** (`"\uD800"`, which normalized form must re-escape),
  and a JSON decoder is not obliged to materialize one: an implementation whose
  string type admits only scalar values replaces or rejects it, and stages 4
  and 6 then reconstruct different graphs from the same vector. Code units are
  the string analogue of carrying numbers as lexemes — the corpus does not let
  the host decide what its own text means. Review found this.

  **Keys are unique and in observable order**, because these pairs describe the
  *graph*, not the document. A duplicate-key vector lives on the other side of
  the accept pair: the document text says `{"a":1,"b":2,"a":3}` and the graph
  it denotes is `[["a", 3], ["b", 2]]` — last value, first position, which is
  the rule the vector exists to pin. Letting `obj` carry all three source
  members would make the encoding a second parser, and one two consumers could
  disagree about; letting it carry duplicates without a collapse rule would be
  worse. The document half is a string, so it can say anything; the graph half
  is normalized by construction.
- **Host-only inputs are recipes, not data.** Some of these have no value to
  describe at all — a `Date`, a function, a symbol key, an accessor, a sparse
  hole. Others have perfectly ordinary data and a *host variation* the encoding
  has no place for: a frozen object, a `null`-prototype array, an array
  carrying an own property beyond its elements. Either way the encoding cannot
  state it, so each is a named recipe the consumer builds. The vocabulary is
  **closed, and closed means enumerated** — "and so on" was an open list
  wearing the word closed, which review caught. Four **leaf** recipes:

  | recipe | builds |
  | - | - |
  | `{"host": "fn"}` | a function value with **no own properties** — an arrow function with `name` and `length` deleted, per the one-reason rule below |
  | `{"host": "symbol"}` | a fresh unique symbol, as a *value* |
  | `{"host": "builtin", "kind": <kind>[, "ms": <integer>]}` | a non-plain built-in object: `date` (with `ms`), `map`, `regexp` or `boxedNumber` |
  | `{"host": "hole"}` | an array hole — legal **only** as an `arr` element |

  …and six **modifier** recipes, each taking the node it applies to, so the
  property cases say which object they are about — the gap review found in
  `getter`, which named no container. The first four can build inputs a
  serializer must **refuse**; the last two build inputs it must **accept**, the
  half review found missing — without them a serializer that rejects every
  unusual prototype or descriptor passes the corpus while being nonconforming.
  *Can*, not *must*: `ownProp` on an `obj` builds an ordinary own enumerable
  string-keyed property, which is exactly what a serializer has to accept, and
  only an extra property on an **array** is a rejection case. The recipe is a
  construction; the vector is the claim:

  | recipe | builds |
  | - | - |
  | `{"host": "ownProp", "on": <node>, "key": <string>, "value": <node>}` | an enumerable own data property, which is how `a=[1]; a.meta=2` is said |
  | `{"host": "nonEnumerable", "on": <node>, "key": <string>, "value": <node>}` | the same, non-enumerable |
  | `{"host": "getter", "on": <node>, "key": <string>, "value": <node>}` | an **enumerable** accessor property that **records its own invocation** and then returns `value` |
  | `{"host": "symbolKey", "on": <node>, "value": <node>}` | an **enumerable** own data property under a fresh unique symbol |
  | `{"host": "proto", "on": <node>, "to": "null" \| "arraySubclass"[, "inherited": [<key>, <node>]]}` | the same data under a `null` prototype, or as an `Array` subclass instance — `inherited` puts one **enumerable** member, key and value, on the subclass's prototype |
  | `{"host": "attrs", "on": <node>, "how": "frozen" \| "sealed" \| "nonExtensible" \| "nonWritable"[, "key": <string>]}` | the same data with those attributes; `key` is **required with `nonWritable` and forbidden otherwise**, and must name an **existing own data property** of the target |

  `nonWritable`'s `key` carries that constraint because the recipe is otherwise
  not a *modifier* at all: `Object.defineProperty` with an unknown key **adds**
  a non-enumerable `undefined` property, turning a serializer-**accept** vector
  into a serializer-reject one, while another consumer might refuse the recipe
  outright. Naming an existing own data property is what keeps the two
  consumers building the same graph — and keeps the vector about writability,
  which is outside the data model, rather than about a property that should
  not be there.

  **Every modifier's target must be an `obj` or `arr` node** — or a modifier
  over one, since a modifier denotes its target. Nothing else has properties to
  add or attributes to set, and `arraySubclass` narrows further to an `arr`.
  `hole` is the mirror constraint on the leaf side: legal only as an `arr`
  element. Stating both is what stops a vector like "freeze a number" from
  being writable at all.

  **A modifier node denotes its target, modified** — the same object `on`
  denotes, not a copy. Four consequences, and they are stated because review
  found two consumers could reasonably read this differently:

  - **Identity is the target's.** A `ref` to the modifier and a `ref` to its
    target yield the same object, so a vector cannot describe the target
    *before* the modification. That is deliberate: the node table is a heap,
    not a history.
  - **Only nodes reachable from `root` are built**, modifiers included. The
    table is data, not a program, so an unreachable row is inert and cannot
    reach into the graph by side effect.
  - **A modifier appears only as a table entry, never inline** in an `arr`, an
    `obj`, or another modifier's `on`, all of which take a `ref` to it. Without
    that restriction two inline modifiers on one target have no relative order,
    and `ownProp` then `attrs: frozen` succeeds where the reverse fails.
  - **Reachable modifiers apply in table order**, which the restriction above
    makes total, so a target carrying several is unambiguous.

  A cycle needs no recipe: it is a `ref` to an ancestor.

  Three of these carry an obligation the recipe alone does not express, and
  each came from review:

  - **`getter` must be observable, not merely present.** The spec forbids
    reading a getter *because reading it is an effect*
    ([`README.md`](../README.md)), so a serializer that invokes the accessor
    while enumerating and rejects the object afterwards is wrong and would pass
    a vector that only checked the rejection. The recipe therefore records its
    invocation, and **the vector asserts it was never invoked** as well as that
    the input was refused. *Enumerable* is load-bearing and easy to lose:
    `Object.defineProperty` defaults to non-enumerable, and a non-enumerable
    accessor is refused for *that* reason without the read path ever being
    reached — so an implementation that eagerly reads every enumerable getter
    would pass the invocation assertion. **`symbolKey` carries the same
    requirement for the same reason**: built with `Object.defineProperty`
    defaults it is non-enumerable, and a serializer refusing it for *that*
    never has to notice the enumerable symbol-keyed property it would
    otherwise drop silently. Two consumers would be testing two different
    rejection paths from one vector. Rejecting for the right reason and
    rejecting after doing the forbidden thing are different outcomes.
  - **`arraySubclass` with `inherited` is a serializer-accept vector with
    teeth.** A serializer that enumerates with `for...in` copies inherited
    enumerable properties into its result, which the spec forbids: the data is
    the object's **own** enumerable string-keyed properties. Putting one
    enumerable member on the subclass's prototype and asserting it is *absent*
    from the output is what catches that. The member carries its **key**, not
    just a value, and **the key must not collide with an own key of the
    target** — for an `arr` that rules out any index it holds, and `length`.
    A colliding key is shadowed by the own property during `for...in`, so the
    vector would pass against a serializer that copies inherited members: the
    one it exists to fail. This is the only vector in the set
    whose assertion is about a member that must **not** appear.

    An earlier draft did this with an arbitrary **custom** prototype, and
    review was right that the spec does not clearly permit one: it rejects
    "any other non-plain object" and exempts prototypes only by naming
    `null`-prototype objects, `null`-prototype arrays and `Array` subclasses.
    An implementation rejecting `Object.create({x: 1})` as non-plain would be
    reading the normative text correctly and failing the corpus. An `Array`
    subclass is **explicitly** permitted and its prototype can carry a member,
    so it exercises the same filtering with no spec question attached — and
    the corpus should not be where a spec question gets silently answered.
  - **`builtin` covers a class, not `Date`.** The spec rejects "a `Date`, or
    any other non-plain object", and a corpus naming only `Date` is passed by
    an implementation that special-cases `Date` and serializes an empty `Map`
    or `RegExp` as `{}` — valid output denoting something else, which is the
    failure the serializer-reject set exists to catch. The `kind` list is
    closed like everything else here, and `map`, `regexp` and `boxedNumber`
    are in it precisely because they are *not* `Date`.

    **The non-`Date` case must have no own properties**, or it can be refused
    for the wrong reason. Measured:

    ```text
    Map        no own properties
    Date       no own properties
    Number(1)  no own properties
    RegExp     lastIndex, own and non-enumerable
    ```

    A serializer refuses a `RegExp` the moment it sees a non-enumerable own
    property — a rule it needs anyway — without ever asking whether the object
    is plain, and then still writes an empty `Map` as `{}`. So `regexp` stays
    in the `kind` list but cannot be the case that discharges the requirement;
    `map` or `boxedNumber` must be. Review found this, and it is the same shape
    as the enumerable-`getter` finding: a vector refused by a cheaper rule
    never exercises the one under test.

  The list being closed is what makes it useful — a vector needing a recipe not
  in it extends the schema and both consumers, deliberately, rather than each
  consumer improvising. Each implements the ten once, and the corpus stays
  data. Nothing in the encoding marks a recipe as accept-side or reject-side;
  which set a vector lands in is the vector's claim, not the recipe's.

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
      in observable order**, strings as UTF-16 code-unit arrays everywhere a
      string appears, and the ten `host` recipes — four leaves, six
      modifiers, each modifier naming the node it applies to — with their
      application order, the rule that a modifier is a table entry and never
      inline, what a modifier node denotes, `builtin`'s and `proto`'s and
      `attrs`'s closed value lists (`proto`'s optional `inherited` key/value
      pair, whose key may not collide with an own key of the target), and
      `getter`'s **enumerable** accessor with its invocation record. It is the
      part two
      consumers can silently disagree about, so it lands first and gets its own
      round-trip proof — encode a graph, decode it, and assert the sharing
      survives.
- [ ] **Raise the plain-object boundary with the spec**, which this corpus
      cannot settle: `README.md` rejects "any other non-plain object" and
      exempts prototypes by naming three cases, so whether
      `Object.create({x: 1})` is permitted is unstated. The vectors avoid the
      question rather than answering it; the spec should answer it.
- [ ] Choose the corpus's location. The encoding is settled above: JSON,
      permanently, per the bootstrapping constraint.
- [ ] Write the accept, reject, **serializer accept**, serializer reject,
      **graph equivalence** and normalize sets covering the cases listed.
      Check each rejection vector for a **second ground of refusal** before
      committing it — three of the ones designed here had one, and a vector
      refused by the cheaper rule never exercises the rule it was written for. The
      serializer-accept set is the one an implementation passes by being too
      strict, so it is the one most easily left for later and least safe to.
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
