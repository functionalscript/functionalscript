## Refuse a source that is not UTF-8

**Priority:** P1
**Status:** open

### Problem

`fjs compile` reads every source — the input, each imported module, each JSON
import and a `.json` input — through `_parseModule` and `_parseJson` in
[`../transpiler`](../transpiler/module.f.mjs), which call `readUtf8File` from
[`fjs/effects/node`](../../effects/node/module.f.mjs), which decodes the bytes
with `utf8ToString` from [`fjs/text`](../../text/module.f.mjs). That decoder
never fails: a malformed sequence comes out as characters, and the module
compiles. A string literal holding these bytes, compiled to any
output, against the same file imported by Node:

|Bytes|FunctionalScript|Node|
|-|-|-|
|`FF`|U+00FF|U+FFFD|
|`C2`, cut short|U+00C2|U+FFFD|
|`C0 AF`, overlong|U+00C0 U+00AF|U+FFFD U+FFFD|
|`ED A0 80`, a surrogate|the lone surrogate U+D800|U+FFFD U+FFFD U+FFFD|

A key is read the same way, a `.json` input and a JSON import give the same
answers, and a comment holding such bytes is accepted, although it changes no
value.

That is a different successful value for an accepted program, which rule 2
of the [principles](../../../spec/README.md#principles) forbids: missing
support may be refused, but accepted source never receives a different
successful meaning. It is a current violation, so the
[compatibility epic](../../../todo/fjs-javascript-compatibility.md) makes it
P1. [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
gives the order: refuse now.

### Proposal

A source is correct UTF-8 or it is refused, the rule
[DataJS](../../../spec/datajs/README.md#encoding) already states for its
documents and [Source Text](../../../spec/README.md#source-text) states for
the compiler's inputs. Refuse, not replace: U+FFFD would match Node on a
string, but it accepts a file that is not the text anybody wrote, and
JavaScript has no rule for bytes to agree with — the host decodes them — so a
refusal is missing support, never another result.

The checked decoder exists: `fromVec` in
[`fjs/text/utf8`](../../text/utf8/module.f.mjs) answers `null` for anything
that is not correct UTF-8, surrogates and overlong forms included, and
`sourceDefect` in
[`fjs/media/datajs/vectors/matrix`](../../media/datajs/vectors/matrix/module.f.mjs)
already decodes with it before reading a document, for this very reason. The
read goes through it where the bytes enter, and the refusal reaches `compile`
as a `ParseError` naming the file, not as `file not found`, which `notFound`
in the transpiler makes of every read failure today.

Where the check lives is the one open question. `readUtf8File` promises
UTF-8 and is the boundary every text read crosses, so refusing there fixes
its other callers too, but not every caller turns a refusal into an error:
`borrowedBy` in [`fjs/git/store`](../../git/store/module.f.mjs) reads a
repository's alternates through it and takes any failure of that read as
no alternates, so a refusal there would drop every borrowing the file names
where today only the line holding the bytes misses —
[byte-paths](../../git/todo/byte-paths.md) records why the store does not
refuse such a file. The transpiler checking its own read is the smaller
change. Either way the refusal is one helper shared by `_parseModule` and
`_parseJson`, and so by the EDAG linker, which reads through both.

### Tasks

- [ ] Decode sources with `fromVec` and refuse `null`, in `readUtf8File` or in
      the transpiler's shared read; keep the refusal distinguishable from a
      missing file, and, if it is `readUtf8File`, keep `fjs/git/store`'s
      alternates read from taking it as no alternates.
- [ ] `compile` reports it as `<path> - error: …` for the input, an imported
      module, a JSON import and a `.json` input.
- [ ] Proofs in [`../proof.f.mjs`](../proof.f.mjs) for each byte sequence in
      the table: in a string, a key and a comment, in a `.json` input and in
      a JSON import.
- [ ] `spec/README.md` states the refusal and drops its pointer to this
      issue.

### Related

- [`fjs/text/todo/utf8-to-string-cost.md`](../../text/todo/utf8-to-string-cost.md)
  — a faster decoder must keep this refusal.
- [`fjs/text/utf8/todo/vec-to-code-point-pipeline.md`](../../text/utf8/todo/vec-to-code-point-pipeline.md)
  — the checked and unchecked decode pipelines; this moves the compiler's
  read from the second to the first.
- [`fjs/git/todo/byte-paths.md`](../../git/todo/byte-paths.md) — another
  reader of `readUtf8File` that meets such bytes, and why it does not refuse
  them.
