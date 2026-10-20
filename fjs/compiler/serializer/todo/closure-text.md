## The applied-arrow spelling of a closure is written in both emitters

**Priority:** P4
**Status:** open

### Problem

A function with captures is emitted as an arrow applied to its slots, and the
two JavaScript emitters each spell it.
[`function_text`](../function_text/module.f.mjs)'s `entry`, case `=>`, and
[`value`](../value/module.f.mjs)'s `entry`, default case, both name the
frame, render the lambda through `_renderSymbolic`, and apply it, with the
same `length === 0` shortcut:

```js
// function_text
const frame = n[2].map((_, k) => name(`${path}/frame${k}`))
const text = lambda(s.a, i, path, frame)
return n[2].length === 0 ? `(${text})`
    : `((${frame.map(binding).join(',')})=>(${text}))(${n[2].map(v => operand(s, v)).join(',')})`
// value
const frame = slots.map((_, k) => symbol(`value${i}/frame${k}`))
const text = _renderSymbolic(a, i, `value${i}/function`, frame)
return slots.length === 0 ? text
    : `((${frame.map(binding).join(',')})=>(${text}))(${slots.map(operand).join(',')})`
```

What `String(f)` prints and what a `.js` value module writes must agree on
this spelling, and today they agree by copy.

### Proposal

`function_text` exports `_closure(a, i, path, slotTexts)`: the frame named
from `path`, the lambda rendered, the application to the slot texts given,
and for no slots the bare lambda. `value`'s case is
`_closure(a, i, \`value${i}/function\`, slots.map(operand))` as it stands;
`function_text`'s case parenthesizes the answer only where there are no
slots, which is the one place the two spellings differ today — a bare
lambda inside an expression needs the parentheses, an applied arrow
already has its own — so the applied form reads the same from both
callers. `_renderSymbolic` may then become private.

### Tasks

- [ ] `_closure` with proof; both `entry` cases call it.

### Related

- [associate-edag-with-functions](../../todo/associate-edag-with-functions.md)
  — what the text is for.
- [shared-linked-comma](./shared-linked-comma.md) — the other shared shape
  the two emitters must agree on.
