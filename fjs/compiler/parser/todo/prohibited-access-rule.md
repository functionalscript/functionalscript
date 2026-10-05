## prohibited-access-rule. The parser exports two sets so the serializer can rebuild the rule they encode

**Priority:** P4
**Status:** open

### Problem

Whether a member access is allowed depends on two things, whether it is
a call and whether the name is in the matching set. The parser decides it
in `accessClosed`:

```js
// parser accessClosed
if (method && _prohibitedCallNames.has(named)) { return error(prohibitedCall(key)) }
if (!method && _prohibitedNames.has(named)) { return error(prohibitedKey(key)) }
```

and exports the two sets, `_prohibitedNames` and `_prohibitedCallNames`,
so that the serializer's `key` in
[`serializer`](../../serializer/module.f.mjs) can decide it again:

```js
// serializer key
if (method && _prohibitedCallNames.has(k)) { return error('a prohibited member function') }
if (!method && _prohibitedNames.has(k)) { return error('a prohibited property name') }
```

What is exported is the data; the rule — which set a call consults, which
set an access consults — is rebuilt at the consumer, and the two copies
already word their refusals differently. A third consumer would write it
a third time, and a change to the rule (a name prohibited both ways, say)
would have to be made in each.

### Proposal

The parser exports the rule, not the sets:

```ts
/** Why the access is refused, or `null` when it is allowed. */
export const _prohibitedAccess: (method: boolean) => (name: string) => 'member function' | 'property name' | null
```

`accessClosed` and `key` each wrap the answer in their own error. The two
sets become private to the parser. That removes two public exports,
`_prohibitedNames` and `_prohibitedCallNames`, which is the point — the
rule is the API, not its data — so the implementing PR declares it
under `Changelog:` as a `**BREAKING CHANGES:**` item rather than keeping
the sets exported beside the rule.

### Tasks

- [ ] `_prohibitedAccess`; `accessClosed` and the serializer's `key`
      through it; the sets no longer exported, and their removal
      declared in the PR's `Changelog:` section.
- [ ] `tsc`, `fjs test`.
