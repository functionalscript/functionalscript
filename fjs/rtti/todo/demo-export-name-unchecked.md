## Check a demo example's export name against its schema

**Priority:** P4
**Status:** open

### Problem

Each project schema in the demo is declared with its export's name as a
string, beside the schema value itself, in `inProject` in
[`../demo.f.mjs`](../demo.f.mjs):

```js
inProject('op1Id', 'edag', op1Id)
```

Nothing ties the string to the value. Writing `inProject('op3Id', 'edag',
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
inProject('op1Id', 'edag', edag)  // the schema is edag['op1Id']
```

The printed name and the schema run are then one thing. A misspelled name
finds no schema, which `proof.demo.projectValuesAccepted` already fails on.

First settle whether FunctionalScript admits `import * as`. One proof uses
it today; whether the compiler accepts it is for `npm start compile` and the
language's own rules to say, not this issue. A proof that pairs each name
with its value by hand instead would be a second copy of the same pairs,
open to the same slip, so it is no fallback.

### Related

- [`../demo.f.mjs`](../demo.f.mjs) — `inProject` and the `projectSchemas`
  list.
- [Link a demo schema to its export](demo-link-to-schema-export.md) — the
  other open question about how a project example names its export.
