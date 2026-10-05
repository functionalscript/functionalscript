## write-files. Every generator writes its own "create the directory, then write the files" chain

**Priority:** P4
**Status:** open

### Problem

A generator ends the same way each time: make the output directory, then
write one or more files into it, stopping at the first failure. Each one
chains the two effects itself:

```js
// fjs/ci ci
const workflowWritten = ioStep(
    mkdir(workflowsDirectory, { recursive: true }),
    () => writeUtf8File(ciPath, workflowText(gha)))
const publishWritten = ioStep(workflowWritten,
    () => writeUtf8File(npmPublishPath, workflowText(npmPublishWorkflow)))
// fjs/ci/nix writeJob
const created = mkdir(directory, { recursive: true })
const flakeWritten = step(created, () => writeUtf8File(`${directory}/flake.nix`, flakeText(job)))
// fjs/nanvm/update generateRustTests
const directoryReady = mkdir(directory, { recursive: true })
…
const methodsReady = step(corpus, () => mkdir(methodsDirectory, { recursive: true }))
// fjs/media/datajs/vectors/matrix write
export const write = text => step(mkdir(directory, { recursive: true }), () => writeUtf8File(path, text))
```

[`fjs/compiler`](../../../compiler/module.f.mjs)'s output step is a fifth.
Two concerns are mixed in each: what the files are, which is the
generator's business, and how files reach a disk, which is the effects
layer's. `fjs/ci`'s `ci` builds the GitHub Actions object and writes it
in the same function, and [`fjs/ci/publish`](../../../ci/publish/module.f.mjs)'s
`npmPublishPath` restates the `.github/workflows` literal that
`fjs/ci`'s `workflowsDirectory` holds, because the path and the write
are not one thing.

### Proposal

One effect in this module owns the chain:

```ts
/** Writes each file after creating its parent directory, in order, stopping at the first failure. */
export const writeFiles: (files: readonly (readonly [path: string, text: string])[]) => Effect<Mkdir | WriteFile | WriteBytes | Rm, void, IoChannel>
```

The operations are `mkdir`'s and `writeUtf8File`'s own: a long text is
written in chunks and a failed write removes the partial file, so
`WriteBytes` and `Rm` are part of the contract. The failure is
`Effect`'s own error type, `IoChannel`, not a `Result` in the success
slot.

A generator then computes its file set as a pure function and hands it
to `writeFiles`, which is what makes the set provable without a disk.
Its existing effect-returning exports stay, with their names and
signatures, as the line that writes that set: `fjs/ci`'s `ci(setup)`,
`fjs/ci/nix`'s `nixFlakes(jobs)`, `fjs/nanvm/update`'s
`generateRustTests()` and the matrix module's `write(text)` are called
by `fjs/ci/self`, by `main`s and by proofs, and none of them changes, so
there is nothing to declare. `ci` keeps one effect of its own before
the write — the `Cargo.toml` probe that decides whether the Rust jobs
exist — so its file set takes that answer as an argument rather than
reading the disk. `npmPublishPath` keeps its exported value, the
full `.github/workflows/gen.npm-publish.yml` that both `fjs/ci/publish`'s
and `fjs/ci`'s proofs pin; what changes is how it is spelled — a file
name joined to `workflowsDirectory` — so the directory literal exists
once and the export does not move. The literal's one home is
[`fjs/ci/common`](../../../ci/common/module.f.mjs): `workflowsDirectory`
is private to `fjs/ci` today, and `fjs/ci` imports `fjs/ci/publish`, so
`publish` cannot read it from there without a cycle; `common` sits
below both and imports neither, and `publish` already imports it.

### Tasks

- [ ] `writeFiles`, proved against the mock host.
- [ ] `fjs/ci`, `fjs/ci/nix`, `fjs/nanvm/update`, `fjs/media/datajs/vectors/matrix`
      and `fjs/compiler`'s output through it; each generator's file set
      as a pure function, behind the exports it has today.
- [ ] `tsc`, `fjs test`, `npm run gen` leaves the tree unchanged.

### Related

- [readjsonfile-writejsonfile-helpers](./readjsonfile-writejsonfile-helpers.md)
  — the same layer, one encoding up; on hold for want of a second
  consumer, which this has five of.
- [one-fixture-list](../../../../nanvm-harness/todo/one-fixture-list.md)
  — proposes a generator of the same shape; it would be the sixth.
- [check-render-split](../../../media/datajs/vectors/matrix/todo/check-render-split.md)
  — the matrix generator's own split, whose `write` is one of the sites.
