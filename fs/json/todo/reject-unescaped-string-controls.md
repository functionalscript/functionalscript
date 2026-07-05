## reject-unescaped-string-controls. All parsers accept only JSON string literals

**Priority:** P2
**Status:** done

### Problem

Two layers to this issue — a conformance bug and a design decision that
determines the shape of the fix.

**The bug.** [RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7)
requires every character U+0000–U+001F inside a JSON string to be escaped; a
literal control byte in a string is a syntax error. `fs/json`'s `parse`
accepts them: the shared `fs/js` string state machine (`parseStringStateOp`,
`fs/js/tokenizer/module.f.ts`) special-cases only `"` (close), `\` (escape),
and LF/CR (*"unterminated string literal"*), and its default arm appends any
other code point — control characters included — verbatim. So
`parse('{"a":"⟨TAB⟩"}')` succeeds where `JSON.parse` throws *"Bad control
character in string literal"*.

The check must happen during scanning, not on the finished token: the escape
handler decodes `\t` into an actual HT code point in `value`, so an *escaped*
`\t` and a *literal* TAB are indistinguishable in the emitted token. The
distinction only exists at the moment the raw byte is consumed.

**The design decision.** FunctionalScript is a subset of JS, and a subset may
restrict spellings. JSON string syntax can denote **every** JS string value —
each UTF-16 code unit, including lone surrogates, is reachable via `\uXXXX` —
so restricting all our languages (JSON ⊂ DJS ⊂ FS) to JSON string literals
loses no expressiveness, only alternative spellings. What it buys:

- one string grammar across the whole language lattice — no per-language
  string variants in the tokenizer;
- no parser differentials at the string level: "is it valid JSON?" is
  trivially answerable, and `fs/json` agrees with every strict RFC 8259
  parser by construction;
- fewer spellings per value — a step toward canonical byte forms for
  content addressing and hashing.

The shared scanner is already almost there: it supports only double-quoted
strings and only the JSON escapes (`\"` `\\` `\/` `\b` `\f` `\n` `\r` `\t`
`\uXXXX`); everything else (`\v`, `\x`, `\0`, …) is already an *"unescaped
character"* error. The **sole** remaining divergence from JSON is the default
arm admitting raw controls.

### Proposal

Reject literal control characters during string scanning in the shared
`fs/js` tokenizer, for **all** consumers: in `parseStringStateOp`, map a
consumed code point in U+0000–U+001F (other than LF/CR, which already end the
string) to an `error` token (*"unescaped control character in string"*).

No per-language flag, mode, or wrapper-level re-validation is needed: since
string literals are JSON strings in every language we parse, the strictness
belongs to the single shared grammar. This supersedes the earlier design
(tag the token with a `rawControl` flag, reject only in the `fs/json`
wrapper), which existed to preserve full-JS string tokenization that we no
longer aim to accept by default.

Full ECMAScript string syntax (single quotes, `\v`/`\xHH`/`\0`, literal
controls, line continuations) is deferred to a future language feature:
[js-string-literals](../../../todo/lang/2460-js-string-literals.md).

### Tasks

- [ ] In `parseStringStateOp` (`fs/js/tokenizer/module.f.ts`), emit an
      `error` token for a literal U+0000–U+001F (except LF/CR) inside a
      string.
- [ ] Proof cases across `fs/js`, `fs/json`, and `fs/djs` tokenizers:
      literal TAB / VT / FF / NUL in a string → `error`; the corresponding
      valid escapes (TAB `\t`, FF `\f`, VT `\u000b`, NUL `\u0000` — JSON has
      no `\v`/`\0` short forms) → still accepted.
- [ ] `npx tsc` clean; `fjs t` green.

### Related

- `fs/js/tokenizer/module.f.ts` — `parseStringStateOp`, whose default arm
  admits raw controls; the single enforcement point.
- [todo/lang/2460-js-string-literals.md](../../../todo/lang/2460-js-string-literals.md)
  — deferred feature restoring full JS string spellings.
- [fs/json/todo/streaming-recognizer.md](./streaming-recognizer.md) — the
  payload-free validator inherits this strictness for free once it lives in
  the shared scanner.
- [fs/mime/todo/detect-json.md](../../mime/todo/detect-json.md) — consumer
  that would otherwise mislabel a raw-control blob as `application/json`.
- PR #1215 — implements the earlier per-layer `rawControl` design; superseded
  by this issue if accepted.
