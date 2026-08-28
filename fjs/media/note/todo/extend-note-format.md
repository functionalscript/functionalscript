## Extend the note format

**Priority:** P3
**Status:** open

### Problem

`vnd.fjs.note` v1 is deliberately minimal — `dialect` + `text` — so it can
represent a plain note but not yet the richer items it is meant to grow into:
calendar events, issues, and todos need more than text.

### Proposal

Add **optional** fields under the same tag, one PR each, every candidate
measured against the
[versioning rule](../../revision/README.md#media-type-and-dialect-tag) (an old
reader that ignores the field must still read the blob correctly — otherwise
the field forces a new dialect) and the
[interpretable-in-isolation rule](../../revision/README.md#interpretable-in-isolation)
(optional is reserved for fields whose absent value is a constant default).

Candidates, roughly in order of usefulness:

- `title: or(option, string)` — a short summary line (issues, events). Decide
  whether an absent title and `''` collapse into one meaning, or whether the
  field should reject `''` the way `lock` blobs treat emptiness.
- `tags: or(option, array(string))` — free-form labels. Absent and `[]` are two
  spellings of "no tags"; decide which one canonical writers emit, or make
  the field's presence require a non-empty array.
- Event fields — `start` / `end` times. Needs a time representation decision
  first (ISO 8601 strings? epoch numbers? timezone handling?), which is a
  format-wide vocabulary choice, not a note-local one.
- `due` — a todo's deadline; same time-representation dependency.
- `status` — an issue's open/closed state. **Caution:** this is the riskiest
  candidate under the versioning rule — an old reader ignoring
  `status: 'closed'` presents a closed issue as an open note. Evaluate
  whether that is a misread (new dialect) or acceptable display degradation
  (same tag). Note that "done"/archival may already be covered by the
  revision chain's `archived` flag, so `status` may not be needed at all.
- A `text` syntax tag (e.g. Markdown) — only if plain "reader's decision"
  proves insufficient.
- An escape for a literal `[N]` in `text` — under the dependency-reference
  convention (`[0]` names `dependencies[0]`), a literal in-range bracketed
  integer cannot currently be written. Additive: today's texts keep their
  meaning, an escape only makes more texts expressible.
- A reference-extraction helper — a no-regex scanner giving readers one
  authoritative implementation of the `[N]` convention instead of each
  re-deriving "decimal integer, no sign, no leading zeros, in range".

### Tasks

- [ ] decide and document the time representation used by date-valued fields
- [ ] `title`
- [ ] `tags`
- [ ] event fields (`start` / `end`)
- [ ] `due`
- [ ] decide whether `status` is needed given revision-level `archived`, and
      whether it can keep the tag
- [ ] an escape for a literal `[N]` in `text`
- [ ] a reference-extraction helper for the `[N]` convention
