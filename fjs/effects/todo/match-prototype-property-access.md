## match-prototype-property-access. `match` can dispatch to `Object.prototype` members

**Priority:** P2
**Status:** open

### Problem

`match` (`fjs/effects/module.f.ts:453-459`) looks up the handler for a
command with plain property access on a plain object:

```ts
export const match =
    <O extends Operation, R>(map: OperationMap<O, R>) =>
    <O1 extends O, T>(e: Effect<O1, T>): MatchResult<O1, T, R> => {
        if (typeof e === 'function') { return ['done', e()] }
        const { command, payload, continuation } = e
        return ['cont', map[command](...payload), continuation]
    }
```

`OperationMap<O, R>` restricts `command` to `O[0]` at the type level, but
`command` is runtime data carried on the `Do` node — nothing prevents an
`Effect` value whose `command` is `"constructor"`, `"toString"`,
`"hasOwnProperty"`, `"__proto__"`, or another name inherited from
`Object.prototype` rather than an own property of `map`. `map` is an
ordinary object literal (see every `OperationMap` built by callers, e.g.
`fjs/effects/node/module.f.ts`), so it inherits `Object.prototype`. When
`command` names an inherited property, `map[command]` silently resolves to
that inherited value instead of `undefined`:

```ts
map['constructor']       // Object, not a command handler
map['toString']          // Function.prototype.toString
```

`match` then calls it as `map[command](...payload)`. Calling
`Object.prototype.toString(...)` is harmless by itself, but the pattern is a
type confusion: a value the type system promises is `(...payload) => R`
turns out, at this call site, to be an arbitrary inherited function invoked
with attacker-influenced arguments. Anywhere an `Effect`'s `command` string
originates from decoded/external input (parsed protocol payload,
deserialized continuation, etc.) rather than from code that constructs `Do`
nodes with a statically known command, this is a live safety hole: it lets
that input select which function on `Object.prototype` (or any other
inherited property) gets called, with attacker-controlled `payload` as
arguments.

`asyncRun` (`fjs/effects/module.ts:3-15`) and the sync runner in
`fjs/effects/mock/module.f.ts:27` both build their dispatch loop directly on
`match`, so both inherit the hole.

### Proposal

Make the lookup reject inherited properties instead of silently returning
them. Options, roughly in order of preference:

- Guard with `Object.hasOwn(map, command)` (or
  `Object.prototype.hasOwnProperty.call(map, command)`) before indexing, and
  treat a miss as a hard error (throw, or a distinct `MatchResult` case) —
  same shape as an unknown command, since that's what it is.
- Require `OperationMap` values to be built with a `null` prototype
  (`Object.create(null)` or `{ __proto__: null, ... }`) so `map[command]`
  can never resolve to an inherited member in the first place. This closes
  the hole at construction time rather than at every lookup, but touches
  every `OperationMap` literal callers already write.

Either way, add a proof case in `fjs/effects/proof.f.ts` (the `match` suite
starts at line 97) that exercises `command` set to `"constructor"` or
`"toString"` and asserts `match` does not dispatch to the inherited
function.

### Tasks

- [ ] Decide between the `hasOwn` guard and the null-prototype
      `OperationMap` (or both, if the guard is cheap insurance even with a
      null-prototype map).
- [ ] Fix `match` in `fjs/effects/module.f.ts`.
- [ ] Add regression coverage in `fjs/effects/proof.f.ts` for a `command`
      that names an `Object.prototype` member.
- [ ] Re-check `fjs/effects/module.ts` (`asyncRun`) and
      `fjs/effects/mock/module.f.ts` for any place that re-derives the same
      unguarded `map[command]` pattern instead of going through `match`.

### Related

- `fjs/effects/module.f.ts` — `match`, `OperationMap`.
- `fjs/effects/module.ts` — `asyncRun`, the async interpreter built on `match`.
- `fjs/effects/mock/module.f.ts` — the sync interpreter built on `match`.
