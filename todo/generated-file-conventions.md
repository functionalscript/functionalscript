## Identify and regenerate generated files

**Priority:** P3
**Status:** open

### Problem

Generated files are mixed with handwritten sources, and their names do not
consistently distinguish them. This affects JavaScript, Rust fixtures, CI
workflows, Nix flakes, and other outputs.

CI currently runs `npm run gen` over the checkout before checking for drift.
An obsolete output can survive when its generator stops writing it, and a
generator can accidentally depend on a previous output. Regenerating over
existing scripts also hides missing executable-bit support.

### Proposal

#### Naming and identification

Reserve these conventions for reproducible generated outputs:

| Situation | Convention | Example |
| --- | --- | --- |
| Flexible filename | `.gen` before the complete language suffix | `parser.gen.f.mjs`, `types.gen.d.ts`, `fixtures.gen.rs`, `schema.gen.json` |
| Whole directory of outputs | `generated/`, containing no handwritten files | `ci/generated/flake.nix` |
| Fixed filename and location | Keep the path; explicitly mark it as generated | `nix/flake.nix` |

Keep language and module suffixes intact. Update imports, module declarations,
package exports, and tool configuration when moving or renaming an output.
Where tools require a matching basename, such as an automatically resolved
declaration, use the directory convention or a fixed-path exception instead.

Use `.gitattributes` as the shared machine-readable identification, including
explicit exceptions. For example:

```gitattributes
*.gen.* linguist-generated=true
**/generated/** linguist-generated=true
/nix/flake.nix linguist-generated=true
```

These are examples, not a complete inventory. Mark every generated output,
including the other flakes, generated scripts, and workflow files. Do not mark
an entire mixed directory such as `nix/`, which contains a handwritten README.
Cleanup must use the repository's explicit markings, not GitHub's content
heuristics or only the current generator's output list: obsolete marked files
must still be found.

Where the format permits comments, generators should write a header identifying
the source and regeneration command, with "Do not edit". Put script headers
after the shebang. Use the path markings for formats without comments.

#### CI: delete, regenerate, compare

At the end of the existing generation-check job:

1. Establish the pinned tools needed for cleanup and regeneration independently
   of the generated paths that will be removed.
2. Delete **all generated files** identified by the convention and explicit
   exceptions, including tracked, untracked, and ignored outputs in the project.
   Keep handwritten sources, generator inputs, and installed dependencies.
3. Regenerate from those sources and pinned inputs. Fail immediately if cleanup
   or any generator fails; restore required file modes as well as contents.
4. Run the existing `git add -A && git diff --cached --exit-code` comparison
   against the checked-out commit. It must catch additions, modifications,
   deletions, and executable-bit changes. Outputs expected to be committed must
   not be hidden by ignore rules.

Keep cleanup, regeneration, and comparison separately reportable in CI. Update
the workflow generator under `fjs/ci/` and regenerate its output.
If cleanup removes ignored declarations or package tarballs, rebuild those too;
the package artifact must still exist for the upload that follows the check.

Nix needs explicit handling: deleting `nix/run` and `nix/flake.nix` must not
prevent the next step from running. Resolve the pinned runtime before deletion
and make it available to later steps without re-entering a deleted flake.
Generated `flake.lock` files must also be recreated from the existing pins;
`npm run gen` currently does not write them. Add a Nix-specific regeneration
step while keeping ordinary `gen` Nix-independent and Windows-compatible.
Do not use `npm run lock-update` for the drift check: it also updates unrelated
dependencies. Distinguish dependency-resolution lockfiles that are build inputs
from reproducible outputs when documenting the inventory.

Fix generated executable modes before enabling deletion in CI; the existing
[generated-run-script-mode](../fjs/ci/todo/generated-run-script-mode.md) task
owns that capability. Recreating a script must not rely on its old inode or a
manual `git update-index --chmod` repair.

### Tasks

- [ ] Inventory generated outputs, their sources, regeneration commands, and
      any fixed-path exceptions; distinguish build inputs from outputs.
- [ ] Document the conventions and migrate outputs and their consumers; extend
      `.gitattributes` and add generated headers where supported.
- [ ] Make every output reproducible after deletion, including script modes
      and Nix locks regenerated from existing pins.
- [ ] Add cleanup using the same identification rules, preserving handwritten
      files and finding obsolete outputs as well as currently produced ones.
- [ ] Update CI to establish its runtime, delete all generated files, regenerate,
      and compare with the commit; regenerate the workflow and update its docs.
- [ ] Verify a clean regeneration passes, stale tracked outputs remain deleted
      and fail drift, new or changed outputs fail drift, fixed-name outputs are
      covered, generation failures fail CI, executable modes are restored, and
      handwritten files survive cleanup.

### Related

- [CI generator](../fjs/ci/README.md) — current generation and drift-check flow.
- [Nix environments](../nix/README.md) — generated files and lock regeneration.
- [Generated script modes](../fjs/ci/todo/generated-run-script-mode.md) —
  prerequisite for deleting and recreating executable outputs.
- [Nix integration](../fjs/ci/todo/65z-ci-nix.md) — existing stale-directory task;
  use the shared cleanup convention when implementing it.
