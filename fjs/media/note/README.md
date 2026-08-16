# `vnd.fjs.note`

A `note` BLOB is a human-authored text item — a note, a todo, an issue, a
calendar event — stored as a value of its own.

The format starts deliberately minimal: the dialect tag and the text, nothing
else. That is not a placeholder shape but the extension strategy: rtti structs
are open, so every future capability — a title, tags, dates, a status — is an
**optional** field added under the same tag, and starting minimal is what
keeps every extension additive (see
[Extending the format](#extending-the-format)).

```ts
import { noteSchema, dialect, mediaType, validate, decodeText, encodeText } from './module.f.mjs'
```

## Shape

```ts
export const noteSchema = {
    dialect: 'vnd.fjs.note',
    text: string,
} as const
```

| Field     | Type              | Meaning                                            |
|-----------|-------------------|----------------------------------------------------|
| `dialect` | `'vnd.fjs.note'`  | Format tag — the media type is derived from it.    |
| `text`    | `string`          | The item's text. Any string, including `''`.       |

`text` is **required**, and may be `''`. An absent text and an empty one would
otherwise be two spellings of one blob, and a blob whose only purpose is to
hold text has nothing to say when it does not — the same argument that makes
`lock` required in [`vnd.fjs.lock`](../lock/README.md#not-a-step).

The format records the text and defines no markup for it: how a reader
renders it (e.g. as Markdown) is the reader's decision. A future optional
field may tag a syntax explicitly; until then, nothing in the blob promises
one.

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
- Kind-specific semantics (what makes a note "a todo" or "an event") — future
  optional fields, per the extension rule above.

## Related

- [fjs/media/revision/README.md](../revision/README.md) — the dialect
  convention, the versioning rule, and the history mechanism notes rely on
- [fjs/media/lock/README.md](../lock/README.md) — the sibling value-not-step
  dialect this one mirrors
- [fjs/media](../) — dialect-tagged JSON detection
