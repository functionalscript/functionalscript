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

File Types and Output were the third way, and are current: they name the five
output languages and the graph the `.f.js` writer
([`fjs/fsc/serializer`](../fjs/fsc/serializer/module.f.mjs)) writes, where
they used to say the compiler writes a module with no function in it.

### Proposal

- Rewrite the introduction without the layers: the document specifies
  FunctionalScript as the compiler accepts it today, and names DataJS as the
  interchange format it contains, with its own specification and its own
  extension. Every `DJS` goes, and nothing replaces it as a name: the
  function-free part of the language is wider than DataJS — imports,
  comments, property access, identifier keys, trailing commas — so where a
  sentence needs it, it says "a module without functions" in words, and
  DataJS names only what `spec/datajs/README.md` defines.
- Say once, in Module Structure, that a module is a function: its imports
  are its parameters, its constants its body constants, and `export default`
  its `return` — the compiler reads it so, an import being `args[i]` of the
  module and linking being application — and let Importing, Shared Values
  and Functions refer to that sentence instead of each describing a scope of
  its own.
- Walk every section against the parser and the compiler, section by section,
  and pin each claim to the proof that holds it: the value types, property
  access with its refusals, functions, imports with the attribute, module
  structure, comments, the `__proto__` key.
- Check the other documents that lean on the DJS name —
  [`fjs/fsc/README.md`](../fjs/fsc/README.md), the parser's README and module
  docs, [`spec/todo/README.md`](../spec/todo/README.md), which sorts its
  roadmap into a DJS section, and the paragraph of
  [`spec/datajs/README.md`](../spec/datajs/README.md) (Status) that explains
  the two uses of "DJS", which has nothing left to explain once the wider use
  is gone — and rename, reword or remove them the same way, in the same PR
  where the reference is only a name and in a follow-up where it carries a
  decision.

### Tasks

- [ ] Rewrite the introduction; remove every `DJS` from `spec/README.md`.
- [ ] Correct the "not recognized yet" list and every other stale sentence,
      each against the compiler's behavior, not from memory.
- [ ] Module Structure states that a module is a function, and the scope
      sentences elsewhere point at it.
- [ ] Rename the DJS sections of `spec/todo/README.md` and the DJS names in
      `fjs/fsc` docs where they are only names; remove the two-uses paragraph
      from `spec/datajs/README.md`.
- [ ] Broken-link sweep unchanged; `npm run gen` unchanged.

### Related

- [`fjs/fsc/serializer`](../fjs/fsc/serializer/module.f.mjs) — the writer the
  Output section's contract is now stated over.
- [`spec/datajs/README.md`](../spec/datajs/README.md) — the data subset's own
  specification, which the introduction should point to instead of defining a
  second data subset.
