## `.json` input is read as FunctionalScript

**Priority:** P3
**Status:** open

### Problem

`transpile` ([`transpiler/module.f.mjs`](../transpiler/module.f.mjs)) reads
every input with the DJS tokenizer and parser, whatever the file extension.
The output side does branch on the extension — `fjs/djs/module.f.mjs` picks
`stringifyAsTree` for `.json` and `stringify` otherwise — so the compiler
writes two languages but reads only one.

That was invisible while the DJS reader was a superset of JSON. It stopped
being one with
[spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md): a
JSON document containing a `__proto__` key is a valid JSON document and not a
valid FunctionalScript module, so

```sh
fjs compile proto.json out.json   # fails, on input the compiler can write
```

The failure is correct for a FunctionalScript module and wrong for a JSON
document. It is currently pinned by `protoKey.jsonDocumentRejected` in
[`fjs/djs/proof.f.mjs`](../proof.f.mjs).

The reverse direction of the asymmetry is looser rather than stricter: a
`.json` input may today use `bigint`, `undefined`, comments, identifier keys,
`import`, and `const` — none of which is JSON.

### Proposal

No design yet. The question is whether `fjs compile` should pick the reader by
extension the way it picks the writer — `fjs/media/json/parser` for `.json`,
the DJS parser otherwise — or keep one reader and treat the extension as
naming the output format only. Picking by extension makes `.json` mean JSON in
both directions and closes the round trip `proto.json → out.f.js → out.json`;
it also makes today's DJS-in-`.json` inputs an error, which may be a breaking
change for existing files.

### Related

- [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md) —
  the rule that made the asymmetry observable.
