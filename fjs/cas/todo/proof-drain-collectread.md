## proof-drain-collectread. `proof.f.mjs` hand-rolls `collectRead` twice as `drain`

**Priority:** P4
**Status:** open

### Problem

`fjs/cas/proof.f.mjs` defines `drain` twice, byte-identical
(`:213-224` and `:251-262`):

```js
const drain = acc =>
    stream =>
        step(
            stream,
            (node) => {
                if (node === undefined) { return pure(ok(acc)) }
                const { first, tail } = node
                if (first[0] === 'error') { return pure(first) }
                return drain([...acc, first[1]])(tail)
            },
        )
```

Both call sites then concatenate the collected chunks —
`msb.listToVec(readResult[1])` at `:227` and `:265` — which is exactly what
the module's own exported `collectRead` returns. `collectRead` is *already
imported in this very file* (`:13`) and exercised directly at `:448`, `:458`,
`:473`. So the proof bypasses the module's abstraction and re-implements the
streaming fold it elsewhere proves, twice — the exact way a production/proof
pair drifts apart.

### Proposal

Delete both `drain` definitions and assert through the export:

```js
const [, readResult] = virtual(state1)(collectRead(c.read(hash)))
// readResult is IoResult<Vec>: drop the msb.listToVec wrapper at both sites.
```

(One behavioral nuance to keep in mind: `collectRead` enforces the
`maxLength` vector cap — `fjs/cas/module.f.mjs:81-83` — which these proofs'
payloads are far below; no expectation changes.)

### Tasks

- [ ] Replace both `drain([])(c.read(hash))` pipelines with
      `collectRead(c.read(hash))`; drop the two `msb.listToVec` wrappers.
- [ ] `fjs t` — cas proofs pass unchanged.
