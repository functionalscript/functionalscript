# 43. Stateful parser.

**Priority:** P3
**Status:** open

```ts
const { init, append, end } = parser(ruleMap)
let state = init
state = append(state, 'hello world!')
const ast = end(state)
```
