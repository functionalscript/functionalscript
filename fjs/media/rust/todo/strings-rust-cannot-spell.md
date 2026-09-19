## Strings a Rust literal cannot spell

**Priority:** P2
**Status:** open

### Problem

`stringLiteral` escapes what Rust and JavaScript spell alike and passes
every other code point through as it stands. A control character and a
bidirectional control are spelled by their `\u{…}` escape since the first
task below; what remains is answered the wrong way. Observed at `186af0b`
through `fjs compile <input> <output>.rs`:

- **A lone surrogate writes a file Rust cannot read.** `export default
  "\ud800";` compiles with exit code 0. The code unit passes through
  `stringLiteral` untouched, and `writeUtf8File` encodes it, so the
  generated `string_any("…")` holds bytes that are not UTF-8 and `rustc`
  refuses the whole file as invalid UTF-8. A `&str` cannot hold a lone
  surrogate at all, so there is no escape to reach for: the value has no
  spelling in the API the printer targets.

- **A bigint outside `i64` throws.** `i64Literal` answers it with a
  `throw ['bigint out of i64 range', v]` that nothing above catches, so
  the CLI dies with an uncaught exception instead of a diagnostic. The
  intent is a refusal, but the shape is a crash, and it contradicts what
  `fjs/fsc/rust`'s `generateResult` promises — that the printer never
  throws and every gap is a `Result`, which is why `fjs/edag/rust`'s
  `expExpr` answers one. `stringLiteral` threw the same way for a control
  character before the escape retired the refusal.

Neither computes a wrong value, so neither is a compatibility violation
under [the epic](../../../../todo/fjs-javascript-compatibility.md). Both are
the wrong kind of failure: a success where a refusal is owed, and a crash
where a refusal is owed
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

The same values write correctly through the other outputs: `.data.js`,
`.js` and `.json` spell `"\ud800"` as an escape and read it back as the
same string.

### Proposal

- Refuse a lone surrogate as a `Result`, from `stringLiteral` itself, and
  thread that `Result` through `primitiveExpr`, `keyExpr` and `indexExpr` in
  `fjs/edag/rust`, so `fjs compile` prints it as it prints every other
  refusal — `no Rust spelling for this module: …`. `i64Literal`'s range
  refusal becomes a `Result` the same way. A UTF-16 spelling through a
  `nanvm-lib` constructor that takes code units would lift the refusal
  later; it is not this issue's.
- The other importer, `fjs/nanvm/rust`'s `assertion`, spells a test case's
  *name* and interpolates the literal straight into `check` and
  `check_throws`. Those names are the repository's own operator corpus, so
  a name the writer cannot spell is a defect in the corpus, not an input to
  refuse: that generator unwraps the `Result` where it calls, the throw
  being the ordinary FunctionalScript contract failure that `fjs/fsc/rust`'s
  `generate` already documents for the same reason. It never sees a value
  the compiler's inputs supply.

### Tasks

- [x] Escape control and bidirectional control characters with `\u{…}`;
      prove U+0000, U+001F, U+007F, U+202E and U+2069 round-trip through a
      generated module in `nanvm-harness`.
- [ ] Return a `Result` from `stringLiteral` and `i64Literal`; move the
      surrogate and the range refusal to `Result`s `fjs/edag/rust` carries and `fjs/nanvm/rust`
      unwraps; prove `fjs compile` reports a lone surrogate and an
      out-of-range bigint as diagnostics.
- [ ] Run the check set: `tsc`, `fjs test`, `node --test`, `npm run gen`.

### Related

- [Compatibility epic](../../../../todo/fjs-javascript-compatibility.md) —
  the corpus that surfaced both inputs; "missing support is refused, not
  guessed".
- [`fjs/edag/rust`](../../../edag/rust/module.f.mjs) — the printer that
  calls `stringLiteral` and already answers its own gaps with a `Result`.
