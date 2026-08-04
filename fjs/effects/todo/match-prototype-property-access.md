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

Don't reinvent the guard: `fjs/types/object/module.f.ts:19-23` already ships
`at`, a safe own-property lookup built on
`Object.getOwnPropertyDescriptor` —

```ts
export const at: (name: string) => <T>(object: Map<T>) => Nullable<Exclude<T, undefined>>
    = name => object => {
        const d = getOwnPropertyDescriptor(object, name)
        return d === undefined ? null : fromUndefined(d.value)
    }
```

`getOwnPropertyDescriptor` only ever sees `map`'s own properties, so an
inherited `command` (`"constructor"`, `"toString"`, …) makes `at` return
`null` rather than resolving to `Object.prototype`; its proof
(`fjs/types/object/proof.f.ts:15-24`) already asserts exactly that for
`constructor`. Reuse it in `match` instead of introducing a second,
parallel lookup:

```ts
export const match =
    <O extends Operation, R>(map: OperationMap<O, R>) =>
    <O1 extends O, T>(e: Effect<O1, T>): MatchResult<O1, T, R> => {
        if (typeof e === 'function') { return ['done', e()] }
        const { command, payload, continuation } = e
        const handler = at(command)(map)
        if (handler === null) { /* unknown command — see below */ }
        return ['cont', handler(...payload), continuation]
    }
```

Open design question: how the `null` case surfaces in `MatchResult`. It is
not a value `OperationMap<O, R>` promises to have for every `O1 extends O`
under the type system, so this is properly an invariant violation rather
than an expected outcome — throwing (`assert`-style) is likely the right
default, matching how the rest of `fjs/effects` treats "should be
statically impossible" cases. A dedicated `MatchResult` variant is the
alternative if a caller needs to recover instead of crash; decide against
`fjs/effects`'s existing error-handling conventions before implementing.

Add a proof case in `fjs/effects/proof.f.ts` (the `match` suite starts at
line 97) that exercises `command` set to `"constructor"` or `"toString"`
and asserts `match` does not dispatch to the inherited function.

### Tasks

- [ ] Decide how `at`'s `null` (unknown/inherited command) surfaces in
      `MatchResult` — throw vs. a new result variant — matching
      `fjs/effects`'s existing conventions for statically-impossible cases.
- [ ] Fix `match` in `fjs/effects/module.f.ts` to look up the handler via
      `at` from `fjs/types/object/module.f.ts` instead of `map[command]`.
- [ ] Add regression coverage in `fjs/effects/proof.f.ts` for a `command`
      that names an `Object.prototype` member.
- [ ] Re-check `fjs/effects/module.ts` (`asyncRun`) and
      `fjs/effects/mock/module.f.ts` for any place that re-derives the same
      unguarded `map[command]` pattern instead of going through `match`.

### Related

- `fjs/effects/module.f.ts` — `match`, `OperationMap`.
- `fjs/effects/module.ts` — `asyncRun`, the async interpreter built on `match`.
- `fjs/effects/mock/module.f.ts` — the sync interpreter built on `match`.
- `fjs/types/object/module.f.ts` — `at`, the safe own-property lookup this
  issue proposes reusing.
