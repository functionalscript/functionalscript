## Recognizer backend (no AST) and BNF→DFA for regular grammars

**Priority:** P3
**Status:** open

### Problem

The FSM/DFA modules (`fs/fsm`, `fs/types/range_map`, `fs/types/byte_set`) carry
working state-machine engines, but they lack a **declarative, combinable**
front end: a DFA is written as raw `[stateIn, ByteSet, stateOut]` rules, which
are awkward to describe, reuse, and combine. BNF is already our declarative
grammar form, so the engines should be *backends behind BNF*, not parallel
hand-written representations.

Separately, several callers need to **recognize** input without building an
AST — they only want "did it match, and what is the final state":

- `fs/cas/mcp` `cas_get` metadata detection (magic-byte MIME + UTF-8 validity)
  over a streaming blob — see
  [cas-get-large-files](../../cas/mcp/todo/cas-get-large-files.md);
- "is this valid JSON / valid identifier" checks that should not allocate a tree;
- the scanner/lexer tier of the layered parser
  ([layered-parser](./layered-parser.md)).

Today the only way to "run a grammar" is the LL(1) dispatch that produces an
AST, which is the wrong shape (and wrong cost) for these.

### Proposal

Treat **BNF as the single source, with a family of backends** that share one
streaming contract — and that contract **already exists** as the `Scan` family
in `fs/types/function/operator` (drivers `fold` / `foldScan` / `stateScan` /
`scan` in `fs/types/list`). No new interface to invent:

```ts
type Fold<I, O>         = (input: I) => (acc: O) => O               // δ: (symbol)(state) => state
type StateScan<I, S, O> = (input: I, prior: S) => readonly[O, S]    // Mealy step: emits output + next state
type Scan<I, O>         = (input: I) => readonly[O, Scan<I, O>]     // state-hidden form; stateScanToScan unifies
```

- A **recognizer** is the output-less case: `Fold<Symbol, State>` for `δ`, plus
  a separate `λ: (State) => Verdict` on the final state. Driven by `foldScan`
  (stream of states) / `fold` (final state) — exactly what `fs/fsm`'s
  `run = foldScan(runOp)` already does.
- A **transducer** is `StateScan<Symbol, State, Out>` (the Mealy step that emits
  output), driven by `stateScan(op)(init): List<Out>`.

`δ` being a pure step is what makes both **streamable** (fold/scan over an
incremental input, including the effectful CAS chunk stream) and lets callers
**short-circuit** once the state reaches an absorbing sink.

#### Build from the data representation, not the functional one

BNF has two representations and the automata builders consume the **second**:

```
functional grammar (fs/bnf)  ──toData──▶  data RuleSet (fs/bnf/data)  ──build──▶  automata
   (composable authoring)                 (serializable IR)
```

The data IR is exactly the substrate for automaton construction:
`Rule = Variant | Sequence | TerminalRange` — alternation, concatenation, and
terminal ranges, with name references for recursion. `dispatchMap` / `parser`
are already *one* family built from `RuleSet`; the recognizer and DFA backends
are **new builders over the same `RuleSet`**, siblings of `dispatchMap` — not a
separate front end. So: author `magic | utf8` functionally, `toData` it, compile.

Module layout follows from this: `fs/bnf/data` should hold only the
serializable IR (`RuleSet` + `toData`), and each parser/automaton builder lives
in its own sibling module — `fs/bnf/ll1` for the current LL(1) dispatch/matcher,
then `fs/bnf/recognizer` and `fs/bnf/dfa` for the new backends. The IR stays
free of any one parser's machinery.

`toData` is itself a special case of a more general mechanism. The functional
grammar embeds *functions* (lazy rules `() => DataRule`; `rtti` schemas are
thunks `() => Info` the same way), and the planned `Function.getAst` /
`fromAst` ([new-pl.md](../../../todo/new-pl.md)) returns any function's IR as
serializable data (JSON) and reconstructs it. So the whole eDSL — including its
function-valued parts — becomes plain data, and via `Object.id` that AST is the
value's canonical identity: **content-addressable**. That closes the loop back
to the CAS this work started from — a serialized grammar/automaton/type is
hashable and storable in it.

#### Compatibility is a build-time check (throw, don't fall back)

Each builder targets a specific automaton class, and the type system **cannot**
express "this grammar is regular / LL(1)". So a builder must **throw** when its
input grammar is not in its class — e.g. `dfaParser` on a non-regular grammar:
there is no DFA for it, and silently falling back to another engine would hide
an authoring error and defeat the reason the caller chose a finite-state
streaming automaton.

A runtime throw is acceptable because it happens **eagerly, at module load**:
grammars are built into top-level consts —

```ts
const myGrammar = dfaParser(bnfGrammar)   // evaluated at import; throws on load
```

— so an incompatible grammar fails fast on import/in CI and cannot ship. It is a
runtime check that behaves like a static one. This is already the pattern in
`fs/bnf/data`: the dispatch builder throws `can not merge …` when a grammar is
not LL(1) (a first/first conflict). Every builder follows it, each with its own
constraint (LL(1) conflict-free, regular, …).

This is the FunctionalScript meta-programming strategy — **no new language**,
or equivalently: an **embedded DSL**. Grammars are ordinary FS values; the
builders are ordinary functions; `const g = dfaParser(grammar)` *is* the compile
step, just eager evaluation, with no bespoke compiler pass or new syntax. The
contrast is an **external** DSL — React/JSX, TypeScript's type syntax — which
needs its own parser/transpiler; FunctionalScript builds the DSL *inside* the
host language instead. The same move recurs across the codebase:

- `fs/html` — markup as nested element values (`['a', { href }, 'Example']`),
  not JSX; serialized by an emitter function;
- `fs/types/rtti` — a type is a schema *value* from which `ts/` derives the
  TypeScript type, `validate/` a validator, and `parse/` a deserializer (the
  cas/mcp tool args already use one rtti struct for both `inputSchema` and
  `validate`);
- `fs/bnf` — a grammar value from which the builders derive automata.

`rtti`:types :: `bnf`:grammars :: `html`:markup — define a value, derive
artifacts from it by function, fail eagerly at load if ill-formed.

Two backends, distinguished by grammar class — this distinction is load-bearing:

1. **DFA backend — regular subset.** The genuinely new builder: analyze the
   `RuleSet` graph and, for grammars with no center-embedding (only
   self-/tail-recursion, i.e. `repeat`-style), compile to a finite DFA (reuse /
   generalize `fs/fsm` subset construction). `S` is a genuine finite state;
   union/product of grammars falls out of subset construction. This is the
   **scanner/lexer tier**: magic-bytes, UTF-8, token scanners.

2. **Recognizer over LL(1) BNF — context-free.** Largely *subtraction* from the
   existing matcher: `fs/bnf/data` already walks the dispatch and returns
   `MatchResult = [AstRule, boolean, Remainder]`; the recognizer is the same
   walk without accumulating the `AstRule`, returning accept/reject + final
   configuration. `S` is a parser configuration (stack), **not** finite. This is
   the tier above the scanner (PL/structure recognition).

**BNF is symbol-agnostic; the alphabet is the runner's choice.** Both BNF
levels — functional and the serializable data IR — are neutral about what a
symbol *is*: a `Rule` over ranges/sequence/variant does not know whether symbol
`0x41` is the code point `A` or the byte `0x41`. `TerminalRange`'s 24 bits are
just capacity (enough for Unicode `0x10FFFF`, and bytes trivially), not a
code-point commitment, and `step` is symbol-numeric. So a **byte runner** for
UTF-8/magic and a **code-point runner** for the PL/Markdown tier are just two
consumers feeding different symbol streams to the *same* `RuleSet`.

There is no code-point coupling in BNF itself. The string-literal constructors
(`str` / `set` / `range`, via `stringToCodePointList`) are just **text-authoring
helpers** sitting *above* the agnostic core; a parallel family of **binary
helpers** — byte / hex literals, byte sequences, byte-range sets — would author
byte grammars the same way, all bottoming out in the agnostic `rangeEncode` /
`oneEncode` primitives. (`fs/mime`'s `fromSentinel` hex-signature notation,
`0x1_89_50_4e_47…n`, is a precedent for compact byte-sequence literals — just
targeting `Vec` today rather than `RuleSet` terminals. The matcher's
`CodePoint[]` typing is likewise nominal — structurally numbers.)

The grand goal — recognize programming languages, Markdown, etc. — is the
**layered** composition of the two:

```
bytes/code-points ──DFA (regular)──▶ tokens ──CF recognizer/parser──▶ structure
```

Reality check: a DFA alone cannot recognize a programming language, and
Markdown is not even context-free. The DFA backend is the scanner tier only;
do not oversell it past that.

#### Two ways to combine automata

Bigger automata are built from BNF pieces in two complementary ways:

- **Product (parallel)** — run several recognizers over the *same* input and
  collect all verdicts (e.g. `magic × utf8` in the CAS detector). Falls out of
  subset construction / state-pairing.
- **Cascade (series)** — each stage is a **transducer** whose output stream is
  the next stage's input (`bytes → code-points → tokens → AST`). A transducer is
  just `StateScan<I, S, O>` (the Mealy-shaped step that emits output); a
  recognizer is the output-less `Fold<I, S>`. `StateScan`'s state need not be
  finite — its power is the power of `S`: finite → DFA (the scanner tier),
  a stack → pushdown machine (the context-free / AST tier, exactly the LL(1)
  recognizer's stack configuration), `bigint` → counting (the CAS `length`). So
  transducers are not limited to finite state; the DFA backend is the
  finite-state restriction. See [layered-parser](./layered-parser.md). Both stay
  streaming via `scan` / `stateScan` / `foldScan`, so the whole pipeline is
  incremental.

### Tasks

- [ ] Move the parsers out of `fs/bnf/data` into their own modules (e.g.
      `fs/bnf/ll1` for the current dispatch/matcher), leaving `fs/bnf/data` as
      the pure serializable IR; new backends land as sibling modules
      (`fs/bnf/recognizer`, `fs/bnf/dfa`)
- [ ] Use the existing `Scan` family as the streaming contract (no new type):
      `Fold<I, S>` for a recognizer + a separate `λ: (S) => Verdict`,
      `StateScan<I, S, O>` for a transducer; drivers `foldScan` / `stateScan` /
      `scan`. Keep it parametric in the symbol space (byte vs code-point runner)
      over the same `RuleSet`. (`fs/fsm`'s `run = foldScan(runOp)` is precedent.)
- [ ] Tokenizer stage needs maximal munch (emit at the longest accepting
      prefix, then restart) — a mechanism over plain recognition
- [ ] DFA backend: `RuleSet` (regular subset) → finite DFA, built as a sibling
      of `dispatchMap`, with a clear regularity criterion (self-/tail-recursion
      only); **throw at build/module-load time** when the grammar is not regular
      (no DFA exists) — do not fall back to another engine
- [ ] AST-less LL(1) recognizer: derive from the existing `fs/bnf/data` matcher
      by dropping `AstRule` accumulation; return accept/reject + final config
- [ ] Add binary terminal helpers (byte / hex literals, byte sequences,
      byte-range sets) as a sibling to the text `str` / `set` / `range` helpers,
      for authoring byte grammars like magic-bytes / UTF-8
- [ ] Union/product (grammar combination) for the DFA backend via subset
      construction; document the analogous state-pairing for the LL recognizer
- [ ] First consumer: the `cas_get` magic-byte + UTF-8 detector consumes the
      DFA backend (length and `finish` stay outside the recognizer)

### Related

- [layered-parser](./layered-parser.md) — same "one BNF engine, multiple layers"
  instinct; the DFA backend is the scanner tier
- [parser-structure](./parser-structure.md) — the AST-producing backend
- `fs/types/rtti` — the type-level sibling of this strategy: types as schema
  values, many artifacts (TS type, validator, parser) derived by function
- `fs/html` — the markup-level sibling: an embedded DSL of nested element
  values, not an external syntax (JSX)
- [new-pl.md](../../../todo/new-pl.md) — `Function.getAst` / `fromAst` (functions
  as serializable IR); `toData` is the grammar-specific case, and the serialized
  forms become content-addressable via `Object.id`
- [cas-get-large-files](../../cas/mcp/todo/cas-get-large-files.md) — first
  concrete consumer (streaming MIME/UTF-8 recognizer)
- `fs/fsm`, `fs/types/byte_set`, `fs/types/range_map` — engines to reuse as the
  DFA backend rather than describe grammars against directly
- `fs/types/function/operator` (`Fold` / `StateScan` / `Scan`) and `fs/types/list`
  (`fold` / `foldScan` / `stateScan` / `scan`) — the existing streaming contract
  and drivers; recognizers and transducers are instances, not new types
