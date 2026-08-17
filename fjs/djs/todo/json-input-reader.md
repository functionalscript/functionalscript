## A `.json` input is read by the DJS reader, not the JSON one

**Priority:** P3
**Status:** open

### Problem

`transpile` ([`transpiler/module.f.mjs`](../transpiler/module.f.mjs)) picks its
reader by extension — `parseJsonFromTokens` for `.json`, `parseFromTokens`
otherwise — but both are the same DJS state machine, differing in one rule:
`"__proto__"` is an ordinary data key in a JSON document
([spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)).

So the `.json` reader is a *superset* of JSON, not JSON. A `.json` file may
contain `bigint`, `undefined`, comments, identifier keys, computed keys,
`import`, and `const` — none of which any other JSON reader accepts, including
this repository's own [`fjs/media/json/parser`](../../media/json/parser).
Nothing checks that a file the compiler treats as JSON is a JSON document.

### Proposal

No design yet. The question is whether a `.json` input should be parsed by
`fjs/media/json/parser`, so that `.json` means JSON in both directions, or go
on being the DJS reader with JSON's `__proto__` rule.

Against the switch: `fjs/media/json/parser`'s errors carry no position, so
`.json` inputs would lose the `path:line:column` diagnostics they have today,
and existing files using DJS extensions in a `.json` would stop compiling — a
breaking change. In favour: a file the compiler calls JSON would actually be
JSON, and the two readers would stop being one state machine with a flag.

### Related

- [spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md) —
  the one rule the two readers differ in today.
