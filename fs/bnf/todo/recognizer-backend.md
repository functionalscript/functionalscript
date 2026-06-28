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
streaming interface:

```ts
type Recognizer<S> = {
    readonly init:   S
    readonly step:   (s: S, symbol: number) => S   // δ — pure, foldable
    readonly finish: (s: S) => Verdict              // λ
}
```

`step` being a pure `δ` is what makes recognizers **streamable** (fold/scan over
an incremental input, including the effectful CAS chunk stream) and lets callers
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

### Tasks

- [ ] Define the `Recognizer<S>` interface (`init` / `step` / `finish`) as the
      shared streaming contract for all backends; keep it parametric in the
      symbol space (byte vs code-point runner) over the same `RuleSet`
- [ ] DFA backend: `RuleSet` (regular subset) → finite DFA, built as a sibling
      of `dispatchMap`, with a clear regularity criterion (self-/tail-recursion
      only) and a sensible fallback when a grammar exceeds it
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
- [cas-get-large-files](../../cas/mcp/todo/cas-get-large-files.md) — first
  concrete consumer (streaming MIME/UTF-8 recognizer)
- `fs/fsm`, `fs/types/byte_set`, `fs/types/range_map` — engines to reuse as the
  DFA backend rather than describe grammars against directly
