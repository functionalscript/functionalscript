## Track Bun's computed-key evaluation order

**Priority:** P3
**Status:** open

Pinned Bun 1.4.5 evaluates the value before coercing the computed key in
`{ [key]: value() }`. Node 26.13.1 and Deno 2.9.8 coerce the key first.
This host JavaScript reproduction prints `["value","key"]` in Bun and
`["key","value"]` in Node:

```js
const events = []
const key = { toString: () => { events.push('key'); return 'x' } }
const value = () => { events.push('value'); return 1 }
const result = { [key]: value() }
console.log(JSON.stringify(events))
```

Consequently, [`proof.mjs`](../proof.mjs)'s
`earlierFailuresStayBeforeSharedDivergence` times out on Bun when key coercion
throws but the value diverges; Node and Deno reach the required failure.
The serializer output before and after the pure work-trampoline change in
[PR 3926](https://github.com/functionalscript/functionalscript/pull/3926) is
identical for these cases, compared with baseline `f39843b20`.

Investigate or report the host defect and recheck it on Bun upgrades. Preserve
the existing proof and FJS evaluation order; this is a host-engine limitation,
not a proposed change to FJS semantics or a reason to increase the timeout.
