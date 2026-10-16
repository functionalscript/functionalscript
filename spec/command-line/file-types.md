# File Types

**Status:** implemented

|File type|Extension|Denotes|
|---------|---------|-------|
|JSON|`.json`|A tree of values.|
|DataJS|`.data.js`|A graph of values.|
|FunctionalScript|`.f.js`|A graph of values and functions.|

The extension is what separates the languages, and it is the only thing that
does. On the way **out** a text is written in whichever language its name
declares ([output](output.md)). On the way **in** the compiler tells JSON from
JavaScript and no more: a `.json` file is a document, and anything else is
read by the module parser, `.data.js` included — so a `.data.js` input holding
a function is accepted today, its name a claim the reader does not check.
DataJS is a subset of FunctionalScript, so every `.data.js` is
FunctionalScript too; the extensions differ so that a document can say which
subset it keeps to.

This table is about the *language* — what `fjs compile` reads and writes. The
repository's own authored FunctionalScript is spelled `.f.mjs` instead, and its
type-level APIs live in authored `types.ts`; `.f.js` there is the stage-2
marker, meaning a module the parser/compiler in the same revision
accepts. Neither spelling changes what the language is: a `.f.mjs` is the same
graph of values a `.f.js` is. The repository extension contract is
[`fjs/compiler/README.md`](../../fjs/compiler/README.md).

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: none; this is FunctionalScript's own tool, not a feature of the language.
