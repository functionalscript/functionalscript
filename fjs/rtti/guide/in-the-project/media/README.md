# Media formats

**Status:** implemented

The repository's blob formats, and JSON itself, are schemas:

- `vnd.fjs.revision`, `vnd.fjs.lock` and `vnd.fjs.note`, in
  [`media/revision`](../../../../media/revision/module.f.mjs),
  [`media/lock`](../../../../media/lock/module.f.mjs) and
  [`media/note`](../../../../media/note/module.f.mjs);
- the dialect registry in [`media`](../../../../media/module.f.mjs), which
  matches a blob against the format schemas and declares none of its own;
- the JSON data model, in [`media/json/rtti`](../../../../media/json/rtti/module.f.mjs),
  and JSON Schema itself, in
  [`media/json/schema`](../../../../media/json/schema/module.f.mjs) — both
  [recursive](../../schemas/recursion/README.md).

A format someone may extend says `open`, with the reason written beside it, so
an older reader still reads a blob a newer writer extended. A format a
content-addressed store holds is a value the caller must keep, which is what
`validate` is for ([`parse` and `validate`](../../readers/parse-and-validate/README.md)).

## Examples

The demo on this page offers five schemas: a revision, a lock, a note, any
JSON value, and a JSON Schema, each with a value it accepts. They are defined
in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists them among all the others.

## Where it is implemented

The modules linked above.
