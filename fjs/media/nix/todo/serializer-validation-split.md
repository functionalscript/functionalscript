## serializer-validation-split. Split validation out of the Nix serializer

**Priority:** P3
**Status:** open

### Problem

`fjs/media/nix/module.f.ts` folds two unrelated jobs into one recursive walk:
deciding whether an `Expression` is *legal Nix* and deciding what text it
*renders as*. Because every node can reject, partiality plumbing propagates
through the whole module: **twelve functions return `X | undefined`** — every
`serialize*` (`:139`, `:144`, `:149`, `:168`, `:184`, `:192`, `:202`, `:214`,
`:222`, `:230`) and both public entry points (`:257`, `:262`) — and every
caller re-implements the propagation by hand.

The rules being checked are few and entirely structural — they do not depend on
anything the renderer computes:

| rule | where it lives today |
|------|----------------------|
| an identifier matches `[A-Za-z_][A-Za-z0-9_'-]*` and is not reserved | `isIdentifier` (`:99`), called from `serializeReference` (`:140`) and `serializePattern` (`:150`) |
| no attribute path is a prefix of another in the same binding group | `bindingsCompatible` (`:164`), called from `serializeBindings` (`:169`) |
| a lambda's pattern names are identifiers and pairwise distinct | `serializePattern` (`:150`) |

Everything else in the module is total: escaping, indentation, delimiters,
joining. `attributeName` (`:119`) already proves it — it consumes the *same*
`isIdentifier` predicate and stays total by quoting whatever fails.

#### 1. Three copies of the all-or-nothing array traverse

The "map a partial function over an array; if any element is `undefined` the
whole result is `undefined`" step is written out three times, and the copies
have already drifted apart:

```ts
// serializeBindings (:178-181) — compares lengths
const defined = serialized.flatMap(value => value === undefined ? [] : [value])
return defined.length !== serialized.length ? undefined : joinChunks(defined, '\n')

// serializeList (:193-196) — probes with `includes`, and computes
// `definedItems` *before* the check that makes it meaningful
const definedItems = items.flatMap(item => item === undefined ? [] : [item])
return items.includes(undefined) ? undefined : ...

// serializeApplication (:208-210) — compares lengths again, and folds in a
// second, unrelated `serializedFn === undefined` test
const definedArgs = serializedArgs.flatMap(a => a === undefined ? [] : [a])
return serializedFn === undefined || definedArgs.length !== serializedArgs.length ? undefined : ...
```

Each one allocates a second array purely to re-discover a fact
(`some(x => x === undefined)`) the first array already carried.

#### 2. `undefined` where the codebase uses `null`

The module signals absence with `undefined` throughout.
`fjs/types/nullable/module.f.ts` states the convention the other way round —
`fromUndefined` exists precisely as "the boundary rule between JavaScript
hosts (which return `undefined` from property/index lookups) and
FunctionalScript (which uses `null` for absence)". Nothing here is a host
lookup; these are the module's own return values, so they should be
`Nullable<T>` and interoperate with `map`/`match` instead of open-coding
`=== undefined` at ten sites.

#### 3. Failures are anonymous

`nix(expression)` returns `undefined` and nothing else. A caller generating a
`flake.nix` (the motivating consumer — see
[65z-ci-nix](../../../ci/todo/65z-ci-nix.md)) learns only that *something*
in a possibly large expression was rejected, with no way to find out what. The
information exists at the point of rejection and is discarded at every frame on
the way out.

#### 4. A private chunk vocabulary that its two siblings already own

`Chunks = readonly string[]` (`:137`) plus a local
`joinChunks(chunks, separator)` (`:154`) re-invent what the other two
serializers in `fjs/media/` already do with `fjs/types/list`:

- `fjs/media/json/serializer/module.f.ts:39-52` — `join` (a `reduce` with a
  separator) and `wrap(open)(close)`, both over `List<List<string>>`;
- `fjs/media/html/module.f.ts` — `flatMap`/`flat`/`map` over `List<string>`
  end to end.

The public signature already promises the shared vocabulary —
`nix` returns `ChunkList<string>` (`:257`), i.e. `List<string>` — while the
whole body is eager arrays, so the two representations meet only at the return
statement.

#### 5. `level` is a trailing positional parameter

`serialize(expression, level)` and friends take `level` last, so
`indent(level)` — `'    '.repeat(level)` (`:107`) — is recomputed at every node
that needs it (`:176`, `:189`, `:227` twice, `:251`), once per binding in
`serializeBindings`. `AGENTS.md` ("Place curried partial applications at
their dependency's scope") asks for the opposite order: with
`serialize = (level: number) => (expression: Expression) => …`, the
`level`-dependent partials are bound once per level and the dependency
structure is visible in the scope they live in.

### Proposal

Make the split explicit and let the plumbing disappear rather than abstracting
it.

**1. One validator.** A single pass owning every rule from the table above:

```ts
/** The reason `expression` is not legal Nix, or `null` when it is. */
const check = (expression: Expression): Nullable<string> => …
```

It reports the first violation with enough context to locate it (the offending
identifier, the conflicting attribute paths, the duplicated pattern name).

**2. A total renderer.** With legality established, `serialize` loses its
`| undefined` everywhere and becomes

```ts
const serialize = (level: number) => (expression: Expression): List<string> => …
```

Note what this deletes rather than moves: **all three traverse copies vanish**,
because `bindings.map(serializeBinding(level))` no longer has a failure case to
collect. Do *not* add an `allOrNothing` / `traverse` helper to
`fjs/types/array` for them — the duplication is a symptom of the missing split,
and abstracting it would preserve the plumbing this issue removes.

**3. One public entry point that carries the reason.** The module has no
importers yet (only its own `proof.f.ts`), so this is the cheapest moment to
fix the contract:

```ts
export const nix = (expression: Expression): Result<List<string>, string> => {
    const reason = check(expression)
    return reason === null ? ok(serialize(0)(expression)) : error(reason)
}

/** Serializes an expression with exactly one trailing newline on success. */
export const nixToString = (expression: Expression): Result<string, string> =>
    mapOk((chunks: List<string>) => `${concat(chunks)}\n`)(nix(expression))
```

using `fjs/types/result`. Two details the shape has to respect:

- **The trailing newline is part of the contract**, not incidental
  formatting: `nixToString` guarantees "exactly one trailing newline on
  success" (`:261`) and ten proof cases assert it (`proof.f.ts:72-105`). A bare
  `mapOk(concat)` would silently turn `'{}\n'` into `'{}'`. The `ok` branch
  must append it, exactly as today.
- **Do not route the branch through `nullable`'s `match`.** Its signature is
  `<T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>`
  — both branches must produce the *same* `R`, so `error(reason)` and
  `ok(chunks)` cannot be the two arms without widening `R` to the union by
  hand, and the result is `Nullable<R>` rather than `R`. The explicit
  `reason === null` branch above is the honest spelling; changing `match` to
  serve this is out of scope.

If preserving today's shape matters more than the diagnostic,
`Nullable<List<string>>` is an acceptable fallback — but then export `check`
too, so the reason is reachable at all.

**4. Reuse the sibling chunk vocabulary.** Drop `Chunks` and `joinChunks`;
build `List<string>` with `fjs/types/list`'s `flat`/`flatMap`/`map` as
`fjs/media/html` does.

Do **not** plan on importing `join`/`wrap` from
`fjs/media/json/serializer/module.f.ts`. They are private constants (`:39-53`)
— only `objectWrap`/`arrayWrap` are exported — and, more decisively, `join`
hardcodes its separator to `comma` (`:38`, `:40-42`), while Nix separates
bindings with `'\n'` plus an indent. Sharing them would mean parameterizing
json's `join` by separator and exporting both, i.e. changing a module this
issue otherwise does not touch, to serve one caller.

So: keep the joining local to `fjs/media/nix`, written with `fjs/types/list`
rather than arrays. What is being reused is the *chunk-list vocabulary*
(`List<string>`, `flat`, `flatMap`), which is the part both siblings actually
share; the separator logic is genuinely per-format. If a third format later
wants a separator-parameterized `join`, that is its own issue and json is
where it lands.

**5. Curry on `level` first**, so `indent(level)` and any other
`level`-dependent partial are bound once per level.

### Rider: declare the module's media identity

The membership rule agreed in
[group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
is "a module goes under `fjs/media/` iff it implements content whose identity
is a media type — or a named dialect of one". Every sibling makes that identity
findable: `json` and `html` are named after registered types, so
`application/json` and `text/html` need no restating; `revision` exports
`mediaType` (`fjs/media/revision/module.f.ts:34`) because its dialect is
FS-specific; `type` is the detector itself.

`nix` is the exception in both directions — it is named after a format with
*no* registered media type, and it states nothing. A reader cannot answer "what
does this module produce, in media-type terms?" from the module at all. The
honest declaration is the conventional unregistered `text/x-nix`: state it in
the module header, and if the detector direction in
[detect-json](../../type/todo/detect-json.md) lands a sibling-declared
`{ mime, … }` record, export it the way `fjs/media/revision` does. This is a
documentation-and-one-constant change, not a move: Nix expressions *are*
content, so the bucket is right; only the declaration is missing.

### Tasks

- [ ] Add `check(expression): Nullable<string>` covering identifier form,
      reserved words, attribute-path conflicts, and lambda-pattern names.
- [ ] Make `serialize` total and curry it on `level` first; delete the three
      all-or-nothing traverse copies together with the `| undefined` returns.
- [ ] Switch the public entry points to `Result<…, string>` (or `Nullable` plus
      an exported `check`) and update `fjs/media/nix/proof.f.ts`.
- [ ] Keep `nixToString`'s single trailing newline: the ten
      `proof.f.ts:72-105` assertions must pass with only their `Result`
      wrapping changed, not their expected text.
- [ ] Replace `Chunks` / `joinChunks` with `fjs/types/list` chunk building,
      keeping the separator logic local — do not export or reshape
      `fjs/media/json/serializer`'s private `join`/`wrap` for this.
- [ ] Add proof cases for each rejection reason — today's proof can only
      observe "rejected", so the reasons need coverage as they become
      observable.
- [ ] Declare the `text/x-nix` media type in the module header.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` membership rule the rider applies.
- [detect-json](../../type/todo/detect-json.md) — the direction in which
  siblings declare `{ mime, parse, serialize }` for the detector to dispatch
  over.
- [serializer-shared-atoms](../../json/todo/serializer-shared-atoms.md) —
  shares `colon` / `MapEntries` between the json and djs serializers; the same
  "one owner for a serializer atom" question, disjoint atoms.
- `fjs/media/json/serializer/module.f.ts` — `join` / `wrap` over
  `List<List<string>>`, the existing chunk-joining vocabulary.
- `fjs/types/nullable/module.f.ts` — the `null`-for-absence convention and the
  `fromUndefined` boundary rule.
- [65z-ci-nix](../../../ci/todo/65z-ci-nix.md) — the motivating consumer
  (generating `flake.nix`); it is the caller that would read the rejection
  reason this issue makes available.
