## Don't use the JSON serializer as a set key

**Priority:** P3
**Status:** open

### Problem

The subset construction needs a canonical key for a `SortedSet<string>` and
reaches for a media-format serializer to get one (`module.f.mjs:19, 30, 71`):

```js
import { stringify } from '../media/json/module.f.mjs'
const stringifyIdentity = stringify(identity)
...
const s = stringifyIdentity(set)
if (s in dfa) { return dfa }
```

That inverts the layering: `fjs/fsm` is generic automaton tooling, and
`fjs/media/json/module.f.mjs` imports its tokenizer, which imports the
795-line `fjs/js/tokenizer` — so building a DFA transitively loads the whole
JavaScript lexer. It also pays for full JSON string escaping on every
state-set key. [recognizer-backend](../../bnf/todo/recognizer-backend.md)
proposes generalizing exactly this subset construction, so the dependency
would propagate.

(Also visible at `:71`: `s in dfa` reads a `StringMap` with `in` instead of
`at` from `fjs/types/object`.)

### Proposal

Name the operation for what it is — a canonical key for a sorted string
set — and put it where the data lives (`fjs/types/sorted_set` or
`fjs/types/string_set`), implemented as a `join` over a separator.
`fjs/fsm` then imports nothing from `fjs/media`.

### Tasks

- [ ] Add a canonical-key function to the sorted-set module with proof
      coverage
- [ ] Convert `fjs/fsm` and drop its `fjs/media/json` import

### Related

- [recognizer-backend](../../bnf/todo/recognizer-backend.md) — will inherit
  whichever key mechanism `fsm` uses
