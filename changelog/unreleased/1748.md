- **BREAKING CHANGES:** rtti's `option` is a nullary schema denoting
  **absence** — the member that is not there — so a member that may be
  omitted is `or(option, t)` and absence stops being a spelling of
  `undefined`: `{}` and `{ a: undefined }` are now distinct sets, told apart
  by every reader and by `subset`. `option(t)` becomes `or(option, t)`, which
  also **narrows**: a schema that accepted a present `undefined` at that
  member no longer does — the faithful translation of the old set is
  `or(option, t, undefined)`, and every migrated schema in this repository
  took the narrowing deliberately. `parse` no longer materializes an absent
  member: the struct kind drops the key, the array kind keeps a hole a hole
  and shortens a trailing absent run, so an optional member survives a JSON
  round-trip. In the data form absence is a fifth `unit` bit (`absentBit`),
  excluded from `unknown`; a declared `unknown` member is therefore required
  now, and "anything, or nothing" is `or(option, unknown)`. `Ts<>` and the
  runtime printer render an omittable member optional with absence stripped
  (`readonly a?: number`, `readonly [1, number?]`) — exact under
  `exactOptionalPropertyTypes` — and `toJsonSchema` derives `required` and
  `minItems` from the absent bit. A `Phantom` annotation on a schema whose
  root admits absence must carry the new `Absent` marker, pinned with the
  new `CheckRaw`.
