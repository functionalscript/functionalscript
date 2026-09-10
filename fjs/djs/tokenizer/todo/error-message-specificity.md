## error-message-specificity. The tokenizer reports three messages and stops at the first

**Priority:** P4
**Status:** open

### Problem

The tokenizer before the grammar-based ones reported ~10 distinct messages
depending on what went wrong — `'invalid number'`, `'unexpected
character'`, `'" are missing'`, `'unescaped character'`, `'invalid hex
value'`, `'*/ expected'`, `'invalid token'` — each at the exact position
of the failing character, and it kept tokenizing afterward, so the parser
still saw whatever valid tokens came later.

`fjs/djs/tokenizer/module.f.mjs` reads the one-token grammar
[`fjs/ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) through the LL(1)
backend, resumed once per token, and reports three messages, each
anchored where the module doc says: `invalid number` for a number cut
short or directly followed by a word or a number; `*/ expected` for a
block comment the input ends inside; and `invalid token` for everything
else the grammar refuses — an unterminated string, a bad escape, a
character no token begins with — spanning from where the token began to
the end of input. The backend reports a refusal as the index it stopped
at and nothing else, so the fold above it cannot tell an unterminated
string from a bad escape, and the first error is the whole output.

Position accuracy holds — the tokenizer's proof pins every anchor and
span — and no consumer reads the messages: `fjs/djs/parser` freezes on
the first error and reports it as `unexpected token`. This is tracked so
the DX regression is not silently forgotten, not because something is
broken today.

### Proposal

Two separable improvements, either could land independently:

1. **Per-failure-type messages.** The grammar already spells one refusal
   as an accepting branch — a block comment's `unterminated: ''` — so that
   the fold can name it, and a string's failure modes can be spelled the
   same way: a branch for the closing quote, one for a newline or the end
   of input inside the string, one for a bad escape, each a rule the
   backend's one symbol of lookahead selects, so the grammar stays LL(1).
   The fold then reads the branch and reports `'" are missing'` or
   `'invalid escape'` at the character. A number cut short is already
   its own message; `invalid token` would be left for a character no token
   begins with. The alternative — the backend reporting which rule it was
   in when it stopped — is a change to `fjs/ebnf/ll1`'s `MatchResult`
   that every reader of a failure index would carry; the branches cost
   nothing outside this grammar.
2. **Continue tokenizing after an error.** The token layer already resumes
   the parser once per token, so continuing is resuming at the next
   plausible boundary — the character after the refused token's first,
   or after the closing quote a string rule found — and emitting an error
   token before going on. What is missing is the boundary choice and a
   token stream that may hold more than one error, which
   `fjs/djs/parser`'s `splitEof` today reads as the one error token that
   ends the stream. Needs its own design pass; not sketched here.

Start with (1) if this becomes worth doing — it is a grammar change and a
fold change, both local. (2) is likely not worth it unless a real use case
(e.g. an editor/LSP wanting multiple diagnostics per file) shows up.

### Tasks

- [ ] Decide if this is worth doing at all — re-check whether any consumer
      (editor tooling, error-reporting UX) actually needs it before
      investing here.
- [ ] If yes: spell the string's failure modes as accepting branches of
      `fjs/ebnf/lib/js`'s `string` rule, as the block comment's
      `unterminated` is, and name each in `tokenizeJs`'s fold.
- [ ] Separately evaluate whether continuation-after-error is actually
      needed, given `fjs/djs/parser` already freezes on the first error and
      doesn't do multi-error collection today.

### Related

- `fjs/djs/tokenizer/module.f.mjs` — the fold that names the three errors.
- [`fjs/ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) — the grammar,
  with the `unterminated` branch the proposal extends.
