## Abbreviate FunctionalScript as FJS

**Priority:** P3
**Status:** open

### Problem

FunctionalScript's abbreviation is now **FJS**, not FS. There is no "Java" in
the name, and that is the point: JavaScript is a trademark, so the language is
not called FunctionalJavaScript, but the abbreviation says what it is — a
functional subset of JavaScript. The CLI (`fjs`), the source tree (`fjs/`) and
most recent prose already use it.

Older documents still say FS, and "FS" is ambiguous besides: the same tree uses
it for *filesystem* ("network-FS", "shared FS"). Nothing states the
abbreviation or the reason for it, so the next contributor has no rule to
follow.

### Proposal

State the abbreviation and its reason once, in the root `README.md`, and
replace every FS that means FunctionalScript with FJS.

The lists below are where the uses were found when this issue was filed,
not a checklist to stop at: the task is every whole-word, case-sensitive `FS`
in the tree, each sorted into one list or the other, and the lists grow with
whatever the search finds that they missed.

In scope — FS meaning the language:

- `spec/todo/design-principles.md`, which defines "FunctionalScript (FS)" and
  uses it throughout, and the spec issues that follow it:
  `2330-property-accessor.md`, `2360-built-in.md`, `3111-function-frame.md`,
  `9100-call-like-instructions.md`, `2460-js-string-literals.md` (the
  "JSON ⊂ DJS ⊂ FS" lattice), and the `spec/todo/README.md` row describing
  design-principles.
- `todo/037-language-design-map.md`, `todo/edag-stage1-discussion.md`, and
  `todo/plan/roadmap.md` ("FS grammar", and "CA FS", which is the "CA
  FunctionalScript" of the row above it).
- `fjs/media`: `todo/cbor.md`, `type/todo/detect-cbor.md`,
  `revision/README.md`, `nix/todo/media-type-declaration.md` ("the FS dialect
  scheme", "FS value", "FS-canonical").
- `fjs/emergent_testing` (`README.md` and comments in `proof.f.mjs`),
  `fjs/nanvm/proof.f.mjs`, and `fjs/ebnf/todo/recognizer-backend.md`.
- `nanvm-lib/todo/fs-vm-load-save.md` ("FS VM") and
  `nanvm-lib/todo/callable-function-objects.md`. Rename the file to
  `fjs-vm-load-save.md` and fix its links.
- `todo/types-for-fs.md`: rename to `types-for-fjs.md` and fix its links.

Out of scope — FS or `fs` that means something else:

- Filesystems: `fjs/cas/plan/staging-lease.md`, the `FS["Local filesystem"]`
  node in `todo/sergey/disot/README.md`'s diagram, NFS, IPFS, EROFS.
- Node's `fs` module and the `Fs` effect type in `fjs/effects/node`.
- `fsm`, the finite-state machine.
- Historical `changelog/*.md` entries, whose `fs/…` paths name the directory
  as it was when they shipped.
- `fjs/website/README.md`'s note that the mark is "the old 'fs' logo … with a
  'j' added", which is history told correctly.

The compiler directory, `fjs/fsc`, and the "FSC" it is called by are
[rename-fsc-to-compiler](../fjs/todo/rename-fsc-to-compiler.md)'s.

### Tasks

- [ ] Say in the root `README.md` that the abbreviation is FJS, and why it is
      not FunctionalJavaScript.
- [ ] Search the tree for every whole-word `FS`, sort each use into the lists
      above, and replace FS with FJS in every in-scope one.
- [ ] Rename `nanvm-lib/todo/fs-vm-load-save.md` and `todo/types-for-fs.md`
      and fix every link to them.
- [ ] Decide whether `fjs/todo/group-fs-subdirectories-by-concern.md`, whose
      title already says `fjs/`, is renamed too.

### Related

- [rename-fsc-to-compiler](../fjs/todo/rename-fsc-to-compiler.md) — the
  compiler directory's part of the same rebrand.
