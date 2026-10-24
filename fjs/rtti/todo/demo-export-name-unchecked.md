## Check a demo example's export name against its schema

**Priority:** P4
**Status:** blocked
**Blocked by:** [namespace import](../../../spec/todo/2220-namespace-import.md)

### Problem

Each project schema in the demo is declared with its export's name as a
string, beside the schema value itself, through `projectSchema` in
[`../schema-demo/module.f.mjs`](../schema-demo/module.f.mjs), in each
`sample.f.mjs` of the guide's
[`in-the-project`](../guide/in-the-project/README.md) pages:

```js
projectSchema('op1Id', 'edag', op1Id)
```

Nothing ties the string to the value. Writing `projectSchema('op3Id', 'edag',
op1Id)` makes the page print `import { op3Id } …` while every reader runs
against `op1Id`, and no gate notices: `tsc`, the coverage run and the
website build all pass. A review of
[functionalscript/functionalscript#2545](https://github.com/functionalscript/functionalscript/pull/2545)
made exactly that change and saw nothing fail. Today the only check is a
person reading the file — the same way a miscounted comment beside the list
was caught.

### Proposal

Let the name select the schema rather than sit beside it. Import each
module's exports as one object and pass that object with the name, so the
demo looks the schema up:

```js
import * as edag from '../edag/module.f.mjs'
projectSchema('op1Id', 'edag', edag)  // the schema is edag['op1Id']
```

The printed name and the schema run are then one thing. A misspelled name
finds no schema, which `proof.demo.projectValuesAccepted` already fails on.

FunctionalScript does not admit `import * as` yet: the
[specification](../../../spec/README.md) lists namespace imports as
unsupported, and the parser's proof refuses `import * as ns from "./d"`.
[Namespace import](../../../spec/todo/2220-namespace-import.md) is the issue
that adds them, so this one waits on it. A proof that pairs each name with
its value by hand instead would be a second copy of the same pairs, open to
the same slip, so it is no fallback.

### Related

- [`../schema-demo/module.f.mjs`](../schema-demo/module.f.mjs) —
  `projectSchema`; the [`in-the-project`](../guide/in-the-project/README.md)
  pages — the lists.
- [Link a demo schema to its export](demo-link-to-schema-export.md) — the
  other open question about how a project example names its export.
- [Namespace import](../../../spec/todo/2220-namespace-import.md) — the
  language issue this one is blocked by.
