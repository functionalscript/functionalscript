## Separate demo control IDs from documentation heading IDs

**Priority:** P3
**Status:** open

### Problem

The generated site contains pre-existing collisions between README heading IDs
and demo control IDs on three pages:

- `fjs/media/datajs/`: `datajs`.
- `fjs/media/json/`: `json`.
- `fjs/types/patricia_trie/`: `example`.

The README heading precedes the form control. A fragment can therefore reach
the heading, while a label's `for` can resolve to the heading instead of the
control. Section-fragment navigation reserves its own IDs, but cannot predict
all field IDs a demo may render after an interaction.

### Proposal

Give shared demo controls a distinct, stable ID namespace, keeping event
`name` values separate from DOM IDs. Account for multiple instances and controls
shown only after changing demo views. Keep labels, radio groups, datalists,
and other ID references synchronized. Coordinate with the planned shared select
and button widgets rather than rewriting each demo independently.

### Tasks

- [ ] Define the shared control-ID contract and collision policy with README
      headings, including dynamic views and multiple control instances.
- [ ] Migrate shared controls and remaining manual controls with matching
      label and accessibility references.
- [ ] Check the three concrete pages and interactive view changes for unique
      IDs and correct label activation.

### Related

- [Shared select and button widgets](./select-and-button-widgets.md).
- [Section links](../../README.md#section-links).
