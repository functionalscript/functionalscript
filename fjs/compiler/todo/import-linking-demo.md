## Show import linking on the compiler's demo pages

**Priority:** P3
**Status:** open

### Problem

The [compiler's output demos](./output-demos.md) accept one module's source.
A program that imports another module is refused on every output of the
side-by-side page ([`../demo.f.mjs`](../demo.f.mjs)): its in-memory file system
holds only the input, so the compiler reports the dependency it cannot read.
The source and Rust stage demos refuse the same programs as unbound reads, and
the EDAG demo draws them as unresolved dependency reads.

So the pages cannot show what linking does, though it is one of the main
things FunctionalScript is meant to show: a module imported twice is one value,
shared in the output, as the root README's "Compiling a module" section
describes in prose. The import examples in the shared list
([`spec/modules`](../../../spec/modules/module.f.js)'s "An import" and "A named
import and a call") parse and lower, but no page can link them.

### Proposal

**An import opens a box for its module.** The side-by-side page keeps its
`Source` box for the main module. When the main module parses and imports a
relative module path, a box for that module appears below it, labelled with
the file name and empty until the reader writes in it. A module's own imports
open boxes the same way, so the boxes follow the whole import tree, each file
once however many modules import it, in the order the tree first reaches it.
The reader never names a file or presses a button to add one: the import is
the name.

```js
import a from './a.f.js'
import b from './b.f.js'
export default [a, b]
```

opens `a.f.js` and `b.f.js`; if both import `./shared.f.js`, one
`shared.f.js` box opens under them. That is the lesson the page is for: the
shared module is one `const` in `.js` and `.data.js`, one node in the EDAG and
in Rust, and written twice in `.json`, which has no identity to keep.

**Which imports open a box.** A relative path to a module file
(`./x.f.js`, `../lib/y.f.mjs`, `./d.json`), once the importing module parses.
A box does not appear for a path still being typed (`'./m'`, `'./m.f'`): it
waits for the module to parse with a complete file name. While a module does
not parse, the boxes stay as they were rather than flicker. A package import
(`functionalscript/…`) opens no box; the compiler refuses it, and the panes say
so. A module that imports `./input.f.js` reaches the main box, not a new one,
and the compiler's answer to the cycle is what the panes show.

**Removing an import keeps its box, marked "not imported".** The box stays
where it was, greyed and labelled *not imported* in words, so its state does
not rest on colour alone, with a **Remove** button, a `data-demo-click`
control a keyboard reaches. Its text is kept: the page shows every file it
holds, and the compiler reads only the files the program imports, so a box
that is not imported changes no output. Typing the import again marks the box
imported again, with its text as it was. **Remove** deletes the box and its
text. A module that only a removed import reached is marked the same way.
Picking an example or opening a shared link replaces every box, so a file
from one program never turns up in another.

**The state is still one text.** Behind the boxes the page holds the files in
one string: the main module first, then each other file after a line
`// @filename: <name>`, the convention the TypeScript playground uses for
several files in one editor. So:

- a shared link still carries one text field, and restores every box,
  imported or not ([`website/demo/sharing`](../../website/demo/sharing/types.ts)
  takes a fixed set of fields, which a box per file would not fit);
- an example in [`../examples/module.f.js`](../examples/module.f.js) is still
  one string, and a multi-file example opens with its boxes written;
- a program with no marker is one module, as every example and shared link
  is today.

Each box is an input named after its file; an edit replaces that file's part
of the text, and the page recomputes which boxes the imports reach.

**Compiling.** The page writes every file into the in-memory file system
(`virtualAt`, as now) and compiles `input.f.js`. `_outputMarked` already
resolves imports through it, so no output logic changes. A box an import
opened that holds nothing yet is written as an empty file, so the compiler
refuses it as an empty module, by name, not as a file it cannot find. A
refusal of the main module, or of an output, reads as before, without the
location; a refusal of another file is the compiler's diagnostic, which names
the file and where in it (`b.f.js:2:29 - error: unexpected end`).

**The stage pages compile the main module only.** They show one stage of one
module; a multi-file example shows its main module there, and says that its
dependencies are compiled on the side-by-side page.

### Open questions

- **Subdirectories.** Whether a box can stand for `./lib/m.f.js` depends on the
  in-memory file system's directories; refuse such a path until it does.
- **An empty box's hint.** An empty module is refused, in the compiler's words,
  in the panes; a placeholder such as `export default …` in the box may help.
- **Subdirectories today.** `demo_files` already admits `lib/m.f.js` and
  writes it as a directory, so the boxes show such a path; decide whether to
  keep it.

### Tasks

- [x] List a module's relative imports from its parse result
      ([`demo_files`](../demo_files/module.f.mjs)'s `importsOf` and `reached`).
- [x] Split the page's text into files at `// @filename:` lines, and join it
      back ([`demo_files`](../demo_files/module.f.mjs)'s `split` and `join`), refusing a repeated name or a marker that is not a line of its
      own.
- [x] Draw a box per file the import tree reaches, and each file it does not
      as *not imported* with a **Remove** button.
- [x] Write every file into the page's file system, and show a refusal's file.
- [x] Have the stage pages compile the main module of a multi-file example.
- [x] Add an example that imports one module through two others, so the
      outputs show it shared.
- [x] Extend the side-by-side [`../proof.f.mjs`](../proof.f.mjs) table to the
      import examples.

### Related

- [Demo pages for the compiler's outputs](./output-demos.md) — the pages this
  extends; this question was one of its open questions.
- [`spec/modules`](../../../spec/modules/module.f.js) — the import examples.
