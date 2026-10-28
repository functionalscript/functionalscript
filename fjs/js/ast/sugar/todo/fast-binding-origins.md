## Record each FAST binding's source origin

**Priority:** P4
**Status:** open

### Problem

`normalize` returns `{ parameters, body }` and nothing that says where a FAST
binding came from. The source AST keeps that beside its tree: the parser's
`ResolvedModule.origins` holds `{ id, name, kind, metadata }` for every
declaration, keyed by the `BindingId` object the tree uses. FAST does not
reuse those objects. `normalize` makes new ones:

- `establish` defines a new binding per write, so one `let` becomes several
  FAST bindings;
- `functionValue` makes new parameters (by position), `rest`, `self` and
  captures;
- a loop's parameters and results, and an `if` statement's results, are new
  per statement.

Some FAST bindings have no source binding at all: `rest` and `self` of a
function that has none, and a defaulted parameter's raw value.

Only `index` is copied, and it is diagnostic, not unique: in
`export default n => { let s = n; s = s + 1; return s; };` both `n` and `s`
have index `0`. So nothing downstream can name a FAST binding.

The [AST graph page](../../../../compiler/sugar/demo.f.mjs) shows the cost:
the source pane labels bindings `n` and `s`, and the FAST pane numbers them
`$0`, `$1`… ([`fastGraph`](../../graph/module.f.mjs)). A reader matches the
two panes by following arrows rather than by name. The drawing is correct;
only its labels are generic.

### Proposal

`normalize` also returns, for each FAST binding it makes, the source
binding it versions or stands for, or nothing. A side table, as the
parser's `origins` is, rather than a name inside `BindingId`, which
[`../../README.md`](../../README.md) keeps to identity.

`fastGraph` then labels versions after their source, `s`, `s₁`, `s₂`, and a
capture after the variable it copies.

Changing `normalize`'s result touches its callers: the EDAG lowering in
`fjs/compiler/edag` and the sugar proofs.
