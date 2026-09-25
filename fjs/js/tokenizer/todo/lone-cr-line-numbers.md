## Count every line terminator in token positions

**Priority:** P4
**Status:** open

### Problem

`advanceMetadata` in [`../module.f.mjs`](../module.f.mjs), the fold that
carries a token's line and column across the text, starts a new line at LF
alone. The grammar reads CR as a newline too —
[`fjs/ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs)'s `newLine` — as
JavaScript does, so a file that ends its lines with a lone CR is accepted, and
every position after its first CR is wrong:

```sh
$ printf 'export default 1;\r\rfoo;\n' > a.f.js
$ fjs compile a.f.js a.json
…/a.f.js:1:20 - error: unexpected token    # foo is at 3:1
```

The same holds after a CR inside a block comment and after a line comment a
CR ends. CRLF comes out right only because its LF does the counting. The
other two ECMAScript line terminators, U+2028 and U+2029, are refused outside
a string, but a string may hold them, as JSON's may, and there they are not
counted either: `export default "a<U+2028>b";` followed by `foo;` on the next
line reports `foo` on line 2, where JavaScript counts line 3.

Only a position is wrong: the tokens and the value are the same, and a source
position is no observation of the language
([failure is one outcome](../../../../spec/README.md#failure-is-one-outcome)).
But `path:line:column` is what `fjs compile` prints and what an editor jumps
to, so a CR-only file sends its reader to the wrong line.

### Proposal

`advanceMetadata` starts a line at each of ECMAScript's
`LineTerminatorSequence`s: LF, CR, U+2028, U+2029, and CRLF once. The fold
takes one code point at a time, so CRLF needs one bit of state — a line was
already started at the CR — or, equivalently, a CR starts a line only when no
LF follows it. `lineTerminators` in `fjs/ebnf/lib/js` already names the four;
the fold reads them from there rather than restating them.

### Tasks

- [ ] `advanceMetadata` counts LF, CR, U+2028 and U+2029, CRLF once, reading
      `lineTerminators`.
- [ ] Proofs in [`../proof.f.mjs`](../proof.f.mjs) for the position of a
      token after a lone CR, after CRLF, after a CR inside a block comment and
      after a U+2028 inside a string.
- [ ] `spec/README.md` drops its pointer to this issue.

### Related

- [`fjs/media/json/todo/parse-error-location-format.md`](../../../media/json/todo/parse-error-location-format.md)
  — the JSON reader's errors, which `fjs compile` prints with an offset
  rather than a line and column.
