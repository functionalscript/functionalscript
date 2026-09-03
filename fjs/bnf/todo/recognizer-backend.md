## Recognizer backend (no AST) and BNF→DFA for regular grammars

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [Separate alphabet-specific BNF helpers](./unicode-rules.md)
- [ebnf-front-end](./ebnf-front-end.md)'s Problem 1 — which bounds the data
  `Rule` union carries. Both builders discriminate that union, so a bounded
  repeat added later is a second backend rewrite.
- [EOF as an ordinary input symbol](./eof-as-ordinary-symbol.md) — the
  `finish(state)` design below assumes the backend synthesizes EOF. That
  proposal has callers supply it and deletes the synthesis, which would take
  `finish` and its proofs with it.

### Problem

The FSM/DFA modules (`fjs/fsm`, `fjs/types/range_map`, `fjs/types/byte_set`) carry
working state-machine engines, but they lack a **declarative, combinable**
front end: a DFA is written as raw `[stateIn, ByteSet, stateOut]` rules, which
are awkward to describe, reuse, and combine. BNF is already our declarative
grammar form, so the engines should be *backends behind BNF*, not parallel
hand-written representations.

Separately, several callers need to **recognize** input without building an
AST — they only want "did it match, and what is the final state":

- `fjs/mcp/cas` `cas_get` metadata detection (magic-byte MIME + UTF-8 validity)
  over a streaming blob — shipped in `fjs/media/type` `detectStream` with the
  `A_magic`/`A_utf8` factors hand-rolled, ready to lower onto this backend;
- "is this valid JSON / valid identifier" checks that should not allocate a tree;
- the scanner/lexer tier of the layered parser
  ([layered-parser](./layered-parser.md)).

Today the only way to "run a grammar" is the LL(1) dispatch that produces an
AST, which is the wrong shape (and wrong cost) for these.

This TODO previously also assigned ownership of binary BNF authoring helpers to
the recognizer work. That responsibility now belongs to
[Separate alphabet-specific BNF helpers](./unicode-rules.md), which establishes
`fjs/ebnf/byte/module.f.mjs` alongside `fjs/ebnf/unicode/module.f.mjs`. Implement the
alphabet split first so the recognizer can consume those helpers instead of
creating a second byte-helper API or restoring alphabet-specific syntax in core
BNF.

The recognizer must also preserve the logical EOF contract that core BNF already
ships ([`fjs/bnf/README.md`](../README.md#logical-eof-in-parser-input)): `EOF = -1`,
synthesized once by the backend rather than appended by the caller. Incremental
chunk boundaries are not end-of-input; EOF is synthesized only when the complete
stream is explicitly finalized.

### Proposal

Treat **BNF as the single source, with a family of backends** that share one
streaming contract — and that contract **already exists** as the `Scan` family
in `fjs/types/function/operator` (drivers `fold` / `foldScan` / `stateScan` /
`scan` in `fjs/types/list`). No new interface to invent:

```ts
type Fold<I, O>         = (input: I) => (acc: O) => O               // δ: (symbol)(state) => state
type StateScan<I, S, O> = (input: I, prior: S) => readonly[O, S]    // Mealy step: emits output + next state
type Scan<I, O>         = (input: I) => readonly[O, Scan<I, O>]     // state-hidden form; stateScanToScan unifies
```

- A **recognizer** uses `Fold<Symbol, State>` for its per-physical-symbol `δ`,
  plus an explicit finalization operation that provides exactly one logical EOF
  transition opportunity while preserving acceptance already established at the
  physical end of input. Driven by `foldScan` (stream of states) / `fold` (state
  after physical input) — exactly what `fjs/fsm`'s `run = foldScan(runOp)`
  already does.
- A **transducer** is `StateScan<Symbol, State, Out>` (the Mealy step that emits
  output), driven by `stateScan(op)(init): List<Out>`.

`δ` being a pure step is what makes both **streamable** (fold/scan over an
incremental input, including the effectful CAS chunk stream) and lets callers
**short-circuit** once the state reaches an absorbing sink.

#### Logical EOF finalization

Written against today's contract, in which the backend synthesizes EOF. If
[eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) lands first, callers
supply EOF and this whole section goes with the synthesis it deletes.

The ordinary streaming step consumes physical symbols only. It must never inject
EOF merely because one array/chunk ended. State is carried unchanged across chunk
boundaries until the caller knows the complete input stream has ended.

At true end-of-stream, use one explicit finalization operation. Conceptually:

```text
state = fold(physicalSymbols, init)
verdict = finish(state)
```

Logical EOF is available exactly once at finalization, but existing whole-input
grammars must not be forced to add an explicit `eof` terminal. A grammar that is
already accepting after the complete physical stream remains accepted; a grammar
that requires `eof` may instead become accepting after consuming the synthesized
EOF.

If the backend exposes an internal terminal transition `δTerminal` and an
accepting-state classifier `λ`, the observable semantics are equivalent to:

```text
beforeEOF = λ(state)
afterEOF  = λ(δTerminal(EOF, state))
finish(state) = beforeEOF || afterEOF
```

The EOF transition is therefore not allowed to erase acceptance that was already
established at the physical end. For example, if an ordinary grammar reaches an
accepting state after its last physical symbol and the EOF transition would move
that state to a rejecting sink, `finish` still returns true. Conversely, a
grammar whose final rule explicitly requires `eof` can return false before EOF
and true after the one synthesized transition.

A backend may encode the same behavior by compiling an optional final EOF path
rather than literally evaluating both states, but the semantics must be
identical. The exact internal representation may differ by backend; the contract
is about the accepted language and one-time EOF availability.

The finalization semantics are fixed:

- physical folds/chunks never contain or synthesize EOF;
- chunk boundaries do not invoke finalization;
- finalization provides exactly one logical EOF transition opportunity;
- acceptance at the physical end is preserved even if the EOF transition would
  reject;
- a grammar that explicitly requires EOF may accept through the synthesized EOF
  transition;
- rejection means neither the pre-EOF nor post-EOF state is accepting;
- empty input is handled by the same rule from the initial state;
- callers do not append `-1` and do not manufacture EOF metadata;
- repeated chunking of the same physical stream must produce the same finalized
  verdict as processing it as one chunk.

This finalization rule applies to the DFA recognizer and the AST-less LL(1)
recognizer. It preserves the existing "recognized and consumed the complete
physical input" contract while also making the EOF terminal available to grammars
that use it explicitly.

**Written against the synthesis contract, which
[eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) replaces.** If EOF becomes
a symbol the caller supplies as the last one, most of the list above stops being
a rule and becomes a consequence: there is no synthesized transition to provide,
no "callers do not append" to enforce, and no separate finalization step to keep
chunk-invariant — EOF is simply the last symbol of the last chunk. What survives
is the requirement itself, that chunking must not change the verdict.

**One rule above does not become a consequence, though, and it is the one to
carry over.** "Acceptance at the physical end is preserved even if the EOF
transition would reject" is machinery, not bookkeeping: a `Fold<Symbol, State>`
consumes every symbol it is given, so for a grammar that never mentions `eof`,
folding the final EOF drives an accepting state into the rejecting sink and the
input is refused. The parser backends have no equivalent problem — an unconsumed
trailing symbol is just an unconsumed symbol — so this is the recognizer's own,
and it needs either an acceptance check taken before the last symbol or an EOF
self-loop compiled in for grammars that do not name `eof`. Revisit this section
when that issue lands rather than implementing both.

#### Build from the data representation, not the functional one

BNF has two representations and the automata builders consume the **second**:

```
functional grammar (fjs/bnf)  ──toData──▶  data RuleSet (fjs/bnf/data)  ──build──▶  automata
   (composable authoring)                 (serializable IR)
```

The data IR is exactly the substrate for automaton construction:
`Rule = Variant | Sequence | TerminalRange` — alternation, concatenation, and
terminal ranges, with name references for recursion. `dispatchMap` / `parser`
are already *one* family built from `RuleSet`; the recognizer and DFA backends
are **new builders over the same `RuleSet`**, siblings of `dispatchMap` — not a
separate front end. So: author `magic | utf8` functionally, `toData` it, compile.

Module layout follows from this: the data module should hold only the
serializable IR (`RuleSet` alone — under
[ebnf-migration](../../todo/ebnf-migration.md) `toData` retires with the
classical front end, and `fjs/ebnf/data/` holds the IR and the EBNF
lowering), and each parser/automaton builder lives in its own sibling
module — the LL(1) dispatch/matcher, then **`fjs/ebnf/recognizer` and
`fjs/ebnf/dfa`** for the new backends, at those paths directly rather than
under `fjs/bnf` (see the first task). The IR stays free of any one parser's
machinery.

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
`fjs/bnf/data`: the dispatch builder throws `can not merge …` when a grammar is
not LL(1) (a first/first conflict). Every builder follows it, each with its own
constraint (LL(1) conflict-free, regular, …).

This is the FunctionalScript meta-programming strategy — **no new language**,
or equivalently: an **embedded DSL**. Grammars are ordinary FS values; the
builders are ordinary functions; `const g = dfaParser(grammar)` *is* the compile
step, just eager evaluation, with no bespoke compiler pass or new syntax. The
contrast is an **external** DSL — React/JSX, TypeScript's type syntax — which
needs its own parser/transpiler; FunctionalScript builds the DSL *inside* the
host language instead. The same move recurs across the codebase:

- `fjs/media/html` — markup as nested element values (`['a', { href }, 'Example']`),
  not JSX; serialized by an emitter function;
- `fjs/rtti` — a type is a schema *value* from which `ts/` derives the
  TypeScript type, `validate/` a validator, and `parse/` a deserializer (the
  cas/mcp tool args already use one rtti struct for both `inputSchema` and
  `validate`);
- `fjs/bnf` — a grammar value from which the builders derive automata.

`rtti`:types :: `bnf`:grammars :: `html`:markup — define a value, derive
artifacts from it by function, fail eagerly at load if ill-formed.

Two backends, distinguished by grammar class — this distinction is load-bearing:

1. **DFA backend — regular subset.** The genuinely new builder: analyze the
   `RuleSet` graph and, for grammars with no center-embedding (only
   self-/tail-recursion, i.e. `repeat`-style), compile to a finite DFA (reuse /
   generalize `fjs/fsm` subset construction). `S` is a genuine finite state;
   union/product of grammars falls out of subset construction. This is the
   **scanner/lexer tier**: magic-bytes, UTF-8, token scanners.

2. **Recognizer over LL(1) BNF — context-free.** Largely *subtraction* from the
   existing matcher: `fjs/bnf/data` already walks the dispatch and returns
   `MatchResult = [AstRule, boolean, Remainder]`; the recognizer is the same
   walk without accumulating the `AstRule`, returning accept/reject + final
   configuration. `S` is a parser configuration (stack), **not** finite. This is
   the tier above the scanner (PL/structure recognition).

**BNF core is symbol-agnostic; alphabet-specific authoring lives in adapters.**
Both BNF levels — functional and the serializable data IR — are neutral about
whether a symbol originated as a byte, Unicode code point, token symbol, or some
future intermediate alphabet. The concrete `Symbol` representation may change,
but generic `Rule` / `TerminalRange` semantics do not assign Unicode or byte
meaning to it.

After the alphabet split, text constructors such as `str` / `set` / `range` live
in `fjs/ebnf/unicode/module.f.mjs`, while byte / hex literals, byte sequences, and
byte-range helpers live in `fjs/ebnf/byte/module.f.mjs`. They are authoring adapters
that lower to ordinary generic BNF rules before automaton construction. The
recognizer/DFA backends consume the resulting `RuleSet`; they do not define a
second family of binary helpers.

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

- [x] Move the parsers out of `fjs/bnf/data` into their own modules
      (`fjs/bnf/ll1` for the current dispatch/matcher, `fjs/bnf/descent` for the
      recursive descent matcher), leaving `fjs/bnf/data` as the pure serializable
      IR; new backends land as sibling modules — **`fjs/ebnf/recognizer` and
      `fjs/ebnf/dfa`**, at those paths directly. Both execute grammars, so
      they belong in `fjs/ebnf/`
      ([ebnf-migration](../../todo/ebnf-migration.md)); on that plan this
      issue waits for `fjs/ebnf/data/`'s IR — Problem 1 settling the `Rule` union it
      discriminates — and creating them under `fjs/bnf/` would only leave
      them to be deleted with it
- [ ] Use the existing `Scan` family as the streaming contract (no new type):
      `Fold<I, S>` for the physical-symbol recognizer step and
      `StateScan<I, S, O>` for a transducer; drivers `foldScan` / `stateScan` /
      `scan`. Keep it parametric in the symbol space over the same generic
      `RuleSet`. (`fjs/fsm`'s `run = foldScan(runOp)` is precedent.)
- [ ] Add explicit end-of-stream finalization for DFA and AST-less LL(1)
      recognizers: ordinary/chunk folds consume only physical symbols; `finish`
      preserves an accepting pre-EOF state and also evaluates the one synthesized
      EOF transition so grammars that explicitly require `eof` can accept.
- [ ] Prove both finalization acceptance paths: an existing whole-input grammar
      without `eof` remains accepted at physical end, and a grammar that requires
      `eof` becomes accepted only after the synthesized transition. Also prove a
      grammar rejecting both states remains rejected.
- [ ] Prove finalization on empty/non-empty inputs and chunking independence:
      splitting the same physical input into different chunk boundaries must not
      change the finalized verdict or create additional EOF transition
      opportunities.
- [ ] Tokenizer stage needs maximal munch (emit at the longest accepting
      prefix, then restart) — a mechanism over plain recognition
- [ ] DFA backend: `RuleSet` (regular subset) → finite DFA, built as a sibling
      of `dispatchMap`, with a clear regularity criterion (self-/tail-recursion
      only); **throw at build/module-load time** when the grammar is not regular
      (no DFA exists) — do not fall back to another engine
- [ ] AST-less LL(1) recognizer: derive from the existing `fjs/bnf/data` matcher
      by dropping `AstRule` accumulation; return accept/reject + final config
- [ ] Consume binary terminal helpers from `fjs/ebnf/byte/module.f.mjs` after the
      alphabet split for byte/hex literals, byte sequences, and byte ranges used
      by grammars such as magic-byte and UTF-8 recognizers; do **not** create a
      recognizer-local or second binary-helper family.
- [ ] Union/product (grammar combination) for the DFA backend via subset
      construction; document the analogous state-pairing for the LL recognizer
- [ ] First consumer: the `cas_get` magic-byte + UTF-8 detector consumes the
      DFA backend (length and `finish` stay outside the recognizer)

### Related

- [`fjs/bnf/README.md`](../README.md#logical-eof-in-parser-input) — the logical
  EOF semantics every recognizer backend must preserve.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — owns Unicode and
  byte authoring helpers; this recognizer work consumes the generic rules they
  produce.
- [layered-parser](./layered-parser.md) — same "one BNF engine, multiple layers"
  instinct; the DFA backend is the scanner tier
- [parser-structure](./parser-structure.md) — the AST-producing backend
- `fjs/rtti` — the type-level sibling of this strategy: types as schema
  values, many artifacts (TS type, validator, parser) derived by function
- `fjs/media/html` — the markup-level sibling: an embedded DSL of nested element
  values, not an external syntax (JSX)
- [new-pl.md](../../../todo/new-pl.md) — `Function.getAst` / `fromAst` (functions
  as serializable IR); `toData` is the grammar-specific case, and the serialized
  forms become content-addressable via `Object.id`
- `fjs/media/type` `detectStream` — first concrete consumer (streaming MIME/UTF-8
  recognizer), shipped with hand-rolled `A_magic`/`A_utf8` factors that this
  backend should later replace
- `fjs/fsm`, `fjs/types/byte_set`, `fjs/types/range_map` — engines to reuse as the
  DFA backend rather than describe grammars against directly
- `fjs/types/function/operator` (`Fold` / `StateScan` / `Scan`) and `fjs/types/list`
  (`fold` / `foldScan` / `stateScan` / `scan`) — the existing streaming contract
  and drivers; recognizers and transducers are instances, not new types
