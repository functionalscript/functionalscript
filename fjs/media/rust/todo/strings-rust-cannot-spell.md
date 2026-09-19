## Strings a Rust literal cannot spell

**Priority:** P2
**Status:** open

### Problem

`stringLiteral` escapes five characters and passes every other one through
as it stands. Two classes of JavaScript string fall outside that, and each
is answered the wrong way. Observed at `186af0b` through `fjs compile
<input> <output>.rs`:

- **A control character throws.** `export default "\u0000";` — or any of
  U+0000 to U+001F but the three escaped ones, or U+007F — reaches the
  `throw ['control character in a Rust string literal', v]` in
  `stringLiteral`, and nothing above catches it: the CLI dies with an
  uncaught exception instead of a diagnostic. The intent is a refusal, but
  the shape is a crash, and it contradicts what `fjs/fsc/rust`'s
  `generateResult` promises — that the printer never throws and every gap
  is a `Result`, which is why `fjs/edag/rust`'s `expExpr` answers one.
  `i64Literal` throws the same way for a bigint outside `i64`.

- **A bidirectional control character writes a file Rust refuses.** The
  code points that change the visible direction of text — U+202A to U+202E
  and U+2066 to U+2069 — pass through unescaped, the compile reports
  success, and `rustc` refuses the literal under its default
  `text_direction_codepoint_in_literal` deny. U+FEFF and U+200B pass.
  Found in review, by running the generated file.

- **A lone surrogate writes a file Rust cannot read.** `export default
  "\ud800";` compiles with exit code 0. The code unit passes through
  `stringLiteral` untouched, and `writeUtf8File` encodes it, so the
  generated `string_any("…")` holds bytes that are not UTF-8 and `rustc`
  refuses the whole file as invalid UTF-8. A `&str` cannot hold a lone
  surrogate at all, so there is no escape to reach for: the value has no
  spelling in the API the printer targets.

None computes a wrong value, so none is a compatibility violation
under [the epic](../../../../todo/fjs-javascript-compatibility.md). All three are
the wrong kind of failure: a crash where a refusal is owed, and a success
where a spelling or a refusal is owed
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

The same values write correctly through the other outputs: `.data.js`,
`.js` and `.json` spell `"\u0000"` and `"\ud800"` as escapes and read back
as the same strings.

### Proposal

- Spell a control character rather than refuse it: Rust's `\u{…}` escape
  holds any scalar value, so `\u{0}` and `\u{7f}` are ordinary literals and
  the refusal has no reason left. The bidirectional controls take the same
  escape — `"a\u{202e}b"` builds where the raw code point does not — so
  the escaped set is U+0000 to U+001F, U+007F, U+202A to U+202E and U+2066
  to U+2069, each range named once in the writer.
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

- [ ] Escape control and bidirectional control characters with `\u{…}`;
      prove U+0000, U+001F, U+007F, U+202E and U+2069 round-trip through a
      generated module in `nanvm-harness`.
- [ ] Return a `Result` from `stringLiteral` and `i64Literal`; move the two
      throws to refusals `fjs/edag/rust` carries and `fjs/nanvm/rust`
      unwraps; prove `fjs compile` reports a lone surrogate and an
      out-of-range bigint as diagnostics.
- [ ] Run the check set: `tsc`, `fjs test`, `node --test`, `npm run gen`.

### Related

- [Compatibility epic](../../../../todo/fjs-javascript-compatibility.md) —
  the corpus that surfaced both inputs; "missing support is refused, not
  guessed".
- [`fjs/edag/rust`](../../../edag/rust/module.f.mjs) — the printer that
  calls `stringLiteral` and already answers its own gaps with a `Result`.
