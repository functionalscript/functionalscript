# `vnd.fjs.note`

A `note` BLOB is a human-authored text item — a note, a todo, an issue, a
calendar event — stored as a value of its own.

The format starts deliberately minimal: the dialect tag, the text, and
optionally the subjects the item depends on and a priority. That is not a
placeholder shape but the extension strategy: `noteSchema` says `open` — an
rtti struct is closed unless it does — so every future capability (a title,
tags, dates, a status) is an **optional** field added under the same tag, and
starting minimal is what keeps every extension additive (see
[Extending the format](#extending-the-format)).

```ts
import { noteSchema, dialect, mediaType, validate, decodeText, encodeText } from './module.f.mjs'
```

## Shape

```ts
export const priorities = ['P1', 'P2', 'P3', 'P4', 'P5'] as const

export const noteSchema = {
    dialect: 'vnd.fjs.note',
    text: string,
    dependencies: or(option, array(string)),
    priority: or(option, ...priorities),
} as const
```

| Field          | Type                  | Meaning                                            |
|----------------|-----------------------|----------------------------------------------------|
| `dialect`      | `'vnd.fjs.note'`      | Format tag — the media type is derived from it.    |
| `text`         | `string`              | The item's text. Any string, including `''`.       |
| `dependencies` | `string[]` (optional) | Subjects of the items this one depends on — see [Dependencies](#dependencies). |
| `priority`     | `'P1' \| 'P2' \| 'P3' \| 'P4' \| 'P5'` (optional) | The author's urgency ranking, most urgent first — see [Priority](#priority). |

`text` is **required**, and may be `''`. An absent text and an empty one would
otherwise be two spellings of one blob, and a blob whose only purpose is to
hold text has nothing to say when it does not — the same argument that makes
`lock` required in [`vnd.fjs.lock`](../lock/README.md#not-a-step).

The format records the text and defines no markup for it: how a reader
renders it (e.g. as Markdown) is the reader's decision. A future optional
field may tag a syntax explicitly; until then, nothing in the blob promises
one. The single exception is the
[dependency-reference convention](#referencing-dependencies-from-the-text):
`[0]` in the text names `dependencies[0]`.

## Dependencies

`dependencies` names the items this one depends on — a todo blocked by
another todo, an issue waiting on a prerequisite. Each entry is a **subject
identity string**, the same vocabulary as
[`vnd.fjs.revision`](../revision/README.md)'s `subject` and a lock map's
keys: an unconstrained string that identifies a *mutable* object, so no
semantic check applies and any string is a valid entry.

An entry is never a content hash. A dependency tracks the live item — a
blocked-by relation follows the other item as it evolves, so freezing it to
one snapshot would say the wrong thing. When a *specific* resolution does
need recording — "this note, as it stood when these dependencies stood
there" — that is exactly what the revision layer's
[`lock`](../revision/README.md#lock-maps) is for: the revision whose
`snapshot` is this note binds the note's dependency subjects to content
hashes, and the note itself stays a value. The two fields compose without
overlapping: the note says *what* it depends on, the revision's lock says
*which content* those subjects resolved to.

The field is **optional** because its absent value is the constant "depends
on nothing" — the same rule that keeps `archived` optional in the revision
dialect. An explicit `[]` says the same thing; the format does not
distinguish the two, a cost accepted because requiring the field would force
`[]` noise onto every plain note. The format defines no cycle rule: subjects
are identities, not references to further note blobs, so no reference chain
exists to terminate. What a dependency *means* — blocking, ordering,
subtasking — is the reader's interpretation, exactly as lock-map semantics
belong to resolvers.

### Referencing dependencies from the text

`text` may reference an entry by its zero-based index in square brackets:

```json
{
  "dialect": "vnd.fjs.note",
  "text": "Ship the release once [0] and [1] are closed.",
  "dependencies": ["fix the tokenizer", "update the spec"]
}
```

A reference is `[` + a decimal integer — no sign, no leading zeros — + `]`,
and it is a reference **only when it indexes an existing entry**. A bracketed
integer that indexes nothing (out of range, or no `dependencies` at all), and
any other bracketed content (`[ ]`, `[x]`, `[a1]`), is ordinary text. So the
convention is self-contained — resolving a reference needs nothing but the
blob — and it adds no validation stage: there is no such thing as a
structurally valid note with a *broken* reference, only text.

Two consequences:

- **Entry order is significant.** Reordering or removing entries renumbers
  references, exactly as reordering `parents` changes a revision's meaning.
  Text and list live in one blob and are edited together, so a writer keeps
  them consistent the way it keeps any two halves of one value consistent;
  duplicates are pointless but harmless.
- **A literal in-range `[0]` cannot currently be written** in a note that has
  dependencies. No escape is defined yet — defining one (and a reader-side
  reference-extraction helper) is tracked in
  [todo/extend-note-format.md](./todo/extend-note-format.md), and either is
  an additive change under the versioning rule.

## Priority

`priority` ranks the item's urgency on a closed five-rank scale, most urgent
first: `P1` is "drop everything", `P5` is "someday". The vocabulary is
[`todo/README.md`](../../../todo/README.md#issue-format)'s issue format,
reused rather than invented, so one scale ranks the repository's own issues
and a note blob alike.

**Priority, not severity.** The two are different claims: severity states a
fact about a problem's impact, priority states the author's decision about
what to work on first. This format records authored items, so it carries the
decision; an impact assessment is prose and belongs in `text`. If a
defect-tracking use ever genuinely needs a separate impact axis, `severity`
is an additive optional field of its own — recording one never precluded the
other.

**Literals, not numbers.** A numeric rank would pose questions only a
semantic check could answer — is `1` high or low, is `0` allowed, is `2.5`? —
and this dialect deliberately has no semantic stage. The closed literal union
is enforced entirely structurally: an unknown rank (`'P0'`, `'high'`, `1`)
fails validation rather than passing as free-form data. Widening the scale
later is the same fail-closed decision as widening `lock` in the revision
dialect — an older reader rejects a `P0` note outright rather than
misreading it, and every existing rank keeps meaning what it always did.

Absent means **unprioritized**: the author has not decided. That is a
constant default — derivable from nothing, the rule that keeps the field
optional — and it is deliberately distinct from every rank, including `P5`:
"someday" is a decision, "no decision yet" is not a rank.

## A value, not a step

There are no timestamps, no author, and no history fields. A note is a
**value**: it says what the item's text is, and nothing about when or by whom.

Everything temporal comes from [`vnd.fjs.revision`](../revision/): an evolving
note is a mutable object whose `subject` identifies it and whose every
`snapshot` is one of these blobs. Editing is a new revision; concurrent edits
merge as revisions do; a finished todo is the revision chain's `archived`
flag. No second history mechanism appears, and `revision` stays the only one —
exactly the arrangement [`vnd.fjs.lock`](../lock/README.md#not-a-step)
established.

## Canonical serialization

Identical to the sibling dialects': sort every object's property names
lexicographically, recursively, comparing names as strings. All three dialects
encode through the same `stringify(sort)`, so blobs differing only in
whitespace or property order converge to one CAS address.

## Media type and dialect tag

The tag is `vnd.fjs.note` and the media type is derived mechanically:
`application/` + dialect + `+json`.

```
dialect:   vnd.fjs.note
mediaType: application/vnd.fjs.note+json
```

This module contributes `noteDialect` to [`fjs/media`](../)'s `detect` — with
no refinement, since a note has no hash fields, so structure alone decides the
match and a blob is classified as `application/vnd.fjs.note+json` exactly when
`decodeText` would accept it. `fjs/mcp` registers it alongside
`revisionDialect` and `lockDialect`, so `cas_get` reports a note under its own
media type. See
[the revision spec](../revision/README.md#media-type-and-dialect-tag) for the
convention and the versioning rule, which this dialect follows unchanged.

## Extending the format

Extensions are governed by the
[versioning rule](../revision/README.md#media-type-and-dialect-tag): an
additive optional field keeps the tag **only** when an old reader that ignores
it still reads the blob correctly; a field whose absence an old reader would
silently misread forces a new dialect. Candidates — a `title`, `tags`,
event dates, an issue status — are collected in
[todo/extend-note-format.md](./todo/extend-note-format.md), each to be
measured against that rule and against the
[interpretable-in-isolation rule](../revision/README.md#interpretable-in-isolation)
before it lands.

## Out of scope (this module)

- Anything to do with history, authorship, or time — a note has none of its
  own; use a revision.
- Markup or rendering rules for `text`.
- What a dependency relation means (blocking, ordering, subtasking), and any
  resolution of dependency subjects to content — the reader's and the
  revision layer's business, respectively (see [Dependencies](#dependencies)).
- Kind-specific semantics (what makes a note "a todo" or "an event") — future
  optional fields, per the extension rule above.

## Related

- [fjs/media/revision/README.md](../revision/README.md) — the dialect
  convention, the versioning rule, and the history mechanism notes rely on
- [fjs/media/lock/README.md](../lock/README.md) — the sibling value-not-step
  dialect this one mirrors
- [fjs/media](../) — dialect-tagged JSON detection
