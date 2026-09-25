# Report missing imports before dependency evaluation

**Priority:** P2
**Status:** open

## Problem

The value transpiler evaluates a dependency before checking its selected
export. The EDAG linker can inspect the export table without evaluating the
module. If that same dependency has both a missing selected export and a
failing initializer, the requested output format changes the diagnostic.

Reproduction from [PR #2248's review](https://github.com/functionalscript/functionalscript/pull/2248#discussion_r4098332625):

```js
// main
import {missing} from "./dep";
export default 1;
```

```js
// dep
export const bad = null.x;
```

At `4d4aac85631b609456591d17b5678fd1b1fa5872`, `fjs compile main output.json`
and `output.data.js` report `dep - error: cannot read property "x" of null`.
`output.f.js` and `output.rs` report `dep - error: module has no missing export`.
All four exit with code 1 and write no output.

The default-import equivalent, `import missing from "./dep";`, has the same
disagreement (`default` instead of `missing`) on the base branch before named
imports, at `c4f505b4e41398e27d7abbcd25112cb7f12f52c0`. This is a diagnostic-ordering
limitation on rejected input, not a newly accepted wrong result. It is deferred
under the [review policy](../../../doc/REVIEW.md#deferring-a-defect).

The earlier-import fix in
[`770f5ba5c`](https://github.com/functionalscript/functionalscript/commit/770f5ba5cdfb1784284499b1de898d1bb7644ae2)
checks a selection before loading the next dependency. It does not move that
check ahead of the selected dependency's own evaluation.

## Expected behavior

All output formats should report the missing selected export for the example,
before running the failing initializer. Validation must use export presence,
so an existing export with value `undefined` stays valid. Valid unused imports
and empty import lists must still retain required evaluation and failures.

## Tasks

- [ ] Separate export validation from dependency value evaluation, preserving
      module identity, cached selections, attributes and cycle refusal.
- [ ] Prove the named and default reproductions across JSON, DataJS,
      FunctionalScript and Rust output, including exit code and absent output.
- [ ] Preserve the existing earlier-import diagnostic-ordering proofs and
      evaluation failures of valid unused bindings and empty lists.

## Related

- [one-module-resolution-walk](./one-module-resolution-walk.md) — consolidation
  must retain selected names and binding tables; shared traversal alone does
  not establish validation before evaluation.
