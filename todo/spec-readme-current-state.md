## Drop the DJS name, and say a module is a function

**Priority:** P3
**Status:** open

### Problem

[`spec/README.md`](../spec/README.md) specifies FunctionalScript as the
compiler accepts it, section by section, and no longer sorts the language into
**DJS**, the data subset, and **FJS**, DJS plus functions: the compiler
accepts functions, so the sorting was false, and the name never earned its
keep. The language is FunctionalScript, and the data subset it contains is
DataJS, which has its own specification.

Two things remain.

Other documents still lean on the DJS name:
[`fjs/fsc/README.md`](../fjs/fsc/README.md), the parser's README and module
docs, [`spec/todo/README.md`](../spec/todo/README.md), which sorts its
roadmap into a DJS section and an FJS one, and the paragraph of
[`spec/datajs/README.md`](../spec/datajs/README.md) (Status) that explains
the two uses of "DJS", which has nothing left to explain once the wider use
is gone.

And the specification describes a module's scope three times — in Importing,
Shared Values and Functions — where the compiler reads one thing: a module is
a function. Its imports are its parameters, its constants its body
constants, and `export default` its `return`; an import is `args[i]` of the
module, and linking is application.

### Proposal

- Rename, reword or remove each DJS reference the same way the specification
  did: nothing replaces the name, a sentence that needs the function-free
  part of the language says "a module without functions" in words, and
  DataJS names only what `spec/datajs/README.md` defines. Do it in one pull
  request where the reference is only a name, and in a follow-up where it
  carries a decision.
- Say once, in Module Structure, that a module is a function, and let
  Importing, Shared Values and Functions refer to that sentence instead of
  each describing a scope of its own.

### Tasks

- [ ] Rename the DJS and FJS sections of `spec/todo/README.md` and the DJS
      names in `fjs/fsc` docs where they are only names; remove the two-uses
      paragraph from `spec/datajs/README.md`.
- [ ] Module Structure states that a module is a function, and the scope
      sentences elsewhere point at it.
- [ ] Broken-link sweep unchanged; `npm run gen` unchanged.

### Related

- [`spec/datajs/README.md`](../spec/datajs/README.md) — the data subset's own
  specification, which the introduction points to instead of defining a
  second data subset.
- [`fjs/fsc/serializer`](../fjs/fsc/serializer/module.f.mjs) — the writer the
  Output section's contract is stated over.
