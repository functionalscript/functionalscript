## Bring `spec/README.md` up to the compiler, and drop the DJS layer

**Priority:** P2
**Status:** open

### Problem

[`spec/README.md`](../spec/README.md) promises to specify "the language that
the compiler accepts **today**", and it is behind the compiler in two ways.

Its introduction sorts the language into two layers, **DJS**, the data
subset, and **FJS**, DJS plus functions, and says everything the compiler
accepts is DJS. The compiler accepts functions now
([`compile-modules-to-edag.md`](../fjs/fsc/todo/compile-modules-to-edag.md),
Stage 2), so the sorting is false, and the name never earned its keep: the
language is FunctionalScript, and the data subset it contains is DataJS, which
has its own specification. A paragraph exists only to say that DJS is not
DataJS. Nothing in the rest of the document depends on the layer.

Several statements are stale against the parser as it stands after the
property-access, function, prototype-name and literal-access work:

- "Features the parser does not recognize yet — functions, operators,
  property access, type annotations" — two of the four are recognized.
- Output: "the module the compiler writes contains `const` statements and one
  `export default`, never a function", and `.f.js` as a DataJS document —
  which [`functionalscript-output.md`](../fjs/fsc/todo/functionalscript-output.md)
  changes.
- The File Types table has no row for the DataJS output, `.data.js`.

### Proposal

- Rewrite the introduction without the layers: the document specifies
  FunctionalScript as the compiler accepts it today, and names DataJS as the
  interchange format it contains, with its own specification and its own
  extension. Every `DJS` goes, and nothing replaces it as a name: the
  function-free part of the language is wider than DataJS — imports,
  comments, property access, identifier keys, trailing commas — so where a
  sentence needs it, it says "a module without functions" in words, and
  DataJS names only what `spec/datajs/README.md` defines.
- Walk every section against the parser and the compiler, section by section,
  and pin each claim to the proof that holds it: the value types, property
  access with its refusals, functions, imports with the attribute, module
  structure, comments, the `__proto__` key.
- Update File Types and Output with
  [`functionalscript-output.md`](../fjs/fsc/todo/functionalscript-output.md),
  once that lands; until then, state the outputs as they are.
- Check the other documents that lean on the DJS name —
  [`fjs/fsc/README.md`](../fjs/fsc/README.md), the parser's README and module
  docs, [`spec/todo/README.md`](../spec/todo/README.md), which sorts its
  roadmap into a DJS section — and rename or reword them the same way, in the
  same PR where the reference is only a name and in a follow-up where it
  carries a decision.

### Tasks

- [ ] Rewrite the introduction; remove every `DJS` from `spec/README.md`.
- [ ] Correct the "not recognized yet" list and every other stale sentence,
      each against the compiler's behavior, not from memory.
- [ ] Rename the DJS sections of `spec/todo/README.md` and the DJS names in
      `fjs/fsc` docs where they are only names.
- [ ] Broken-link sweep unchanged; `npm run gen` unchanged.

### Related

- [`functionalscript-output.md`](../fjs/fsc/todo/functionalscript-output.md) —
  owns the Output section's new contract.
- [`spec/datajs/README.md`](../spec/datajs/README.md) — the data subset's own
  specification, which the introduction should point to instead of defining a
  second data subset.
