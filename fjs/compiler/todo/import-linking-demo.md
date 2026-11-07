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

**Which imports open a box.** A box opens for the file an import names: a
relative (`./`, `../`) or rooted (`/`) specifier, resolved against the
importing file, once the importing module parses. The file's name is whatever
the path names (`./x.f.js`, `../lib/y.f.mjs`, `./d.json`, and as well `./dep`
or `/lib/d.mjs`), since the compiler reads any file the path names, not only
`.f.js`, `.f.mjs` and `.json` ones. While a module does not parse, the boxes
stay as they were rather than flicker. A bare specifier (`functionalscript/…`)
opens no box; the compiler refuses it, and the panes say so. The main box is
labelled `input.f.js (main module)`, so a reader knows the name a dependency
imports it by. A module that imports `./input.f.js` reaches the main box, not
a new one. The panes show the compiler's answer to a cycle, `circular
dependency`, and the page names every file the cycle passes through
(`Import cycle: input.f.js → a.f.js → input.f.js`), which that message does
not.

**The page is a sandbox: the program's directory is its root.** The page
compiles over the in-memory file system it has always used, whose root holds
the main module. So `/` names the program's directory, a box is named by its
path from there, and `/lib/d.mjs` and `../lib/d.mjs` from `a/` are one box,
`lib/d.mjs`, since they read one stored file. They are not one module: the
in-memory resolver's identity keeps the leading `/`
([rooted-module-identity](../../effects/node/virtual/todo/rooted-module-identity.md)),
so the compiler loads a file reached both ways twice, and the two are not
shared. Until that is fixed, the page says so under the boxes, naming each
file a program reaches both by a rooted path and by a relative one. Nothing is
above the root, so a path that climbs above it opens
no box and the compiler refuses it as a file it cannot find. This is the
page's contract, not the compiler's: `fjs compile` resolves an import as
the host does (`resolveFileModule` in
[`fjs/effects/node`](../../effects/node/module.mjs)), where `/` is the root of
the disk and `../` may leave the main module's directory. A program that
imports by either reads other files on the command line than on the page, so
the page says so, under the boxes, naming each such import: a rooted one,
and a relative one that climbs above the program's directory.

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

**Each file is kept on its own.** The page's state is the main module and a
list of the other files, each a name and a text; nothing joins them into one
text, so nothing a module can hold is reserved. Each box is an input named
after its file, and an edit replaces that file's text. So:

- a shared link carries two fields
  ([`website/demo/sharing`](../../website/demo/sharing/types.ts) takes a fixed
  set): the main module, as today, and `files`, every other file as one JSON
  list of `[name, text]` pairs. A link without `files` is the one module it
  was before. A `files` field that is not such a list, names a file twice or
  names one a program cannot hold is refused, in words, before the page
  restores it;
- an example in [`../examples/module.f.js`](../examples/module.f.js) keeps
  its `source` as the main module, so every page that offers the shared list
  reads it unchanged. The files it imports are listed beside the example, by
  its ID, and the compiler page opens them in their boxes.

**Compiling.** The page writes every file into the in-memory file system
(`virtualAt`, as now) and compiles `input.f.js`. `_outputMarked` already
resolves imports through it, so no output logic changes. A box an import
opened that holds nothing yet is written as an empty file, so the compiler
refuses it as an empty module, by name, not as a file it cannot find. A
refusal of the main module, or of an output, reads as before, without the
location; a refusal of another file is the compiler's diagnostic, which names
the file and where in it (`b.f.js:2:29 - error: unexpected end`).

**The stage pages compile the main module only.** They show one stage of one
module, and an example's `source` is its main module, so they need no change;
its other files are linked on the side-by-side page.

### Open questions

- **Subdirectories.** The in-memory file system holds directories, so a box
  can stand for `lib/m.f.js`; decide whether the page should show the path as
  a tree.
- **An empty box's hint.** An empty module is refused, in the compiler's words,
  in the panes; a placeholder such as `export default …` in the box may help.

### Tasks

- [x] List the files a module imports from its parse result
      ([`demo_files`](../demo_files/module.f.mjs)'s `importsOf` and `reached`).
- [x] Carry the files other than the main module in a shared link's `files`
      field ([`demo_files`](../demo_files/module.f.mjs)'s `encode` and
      `decode`), refusing one that is not a list of `[name, text]` pairs,
      names a file twice, or names one a program cannot hold.
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
