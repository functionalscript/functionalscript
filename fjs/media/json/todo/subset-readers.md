## Both readers of the JSON grammar hard-code its member layout and value dispatch

**Priority:** P4
**Status:** open

### Problem

[`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs) builds two node
shapes and exports a reader for one of them: `items`, for the list `cj`
builds. For the other, `object(p, v) = cj('{}', [p, ws, ':', ws, v])`, it
exports nothing, so [`parser`](../parser/module.f.mjs)'s `entry` and
[`fjs/media/datajs/parser`](../../datajs/parser/module.f.mjs)'s `member` both
read its positions:

```js
const [key, , , , v] = unmapped(node)
```

Both then switch over the tags `createValue` produces with the same arms,
DataJS adding `nan`, `undefined` and `id` to the seven.

### Proposal

- `entry` exported from `lib/json` beside `items`, typed by the rule as
  `items` is; the two destructures go.
- The dispatch as an algebra in `parser`: `valueCases({ array, object,
  string, number, word })` answering the handler, so `toJson` is one
  application and `toNode` spreads it and adds its three arms.

The first alone is worth doing; the second is the fuller fix.

### Tasks

- [ ] `entry` in `lib/json`; both parsers import it.
- [ ] `valueCases`; `toJson` and `toNode` through it.

### Related

- [157-json-djs-shared-value-machine](./157-json-djs-shared-value-machine.md)
  — the serializers' side of the same pair.
- [parser-meta-accessors](../../todo/parser-meta-accessors.md) — the
  accessors already shared.
