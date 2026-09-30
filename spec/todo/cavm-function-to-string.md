## Function text in the content-addressable VM: a hash as the name

**Priority:** P4
**Status:** open

### Problem

Default function text is EDAG-derived
([function text and serialization](./serialization.md#function-text-and-serialization),
[render or refuse](./3120-parameters.md#default-function-text-render-or-refuse)),
and the EDAG is name-erased: a captured binding is a position in a frame,
not the identifier the source spelled. So when a function's body refers to
another function, the renderer has nothing to call it by. The
[serialization questions](./serialization.md#open-questions) leave three
options for `String(f)`, and each fails for a captured *function*:

- `() => x` names a binding no reader can resolve, since the EDAG does not
  keep `x`;
- `() => 3`, the owner's preference for a captured *value*, would have to
  inline the function's whole text in place of the name, and through *its*
  captures the whole dependency graph — which is the case the
  [lazy frame rendering](./serialization.md#conditional-requirement-lazy-frame-rendering)
  requirement exists to forbid, and which has no finite answer at all for
  `self` (question 3);
- a generated fresh name is finite but arbitrary: two renderings of the
  same function, or of the same function on two VMs, disagree on the name.

In a [content-addressable VM](./content-addressable-vm.md) every value,
functions included, already has one canonical name: its hash.

### Proposal

In the CAVM, the default text of a function names each captured function by
its hash, spelled as an identifier:

```js
const f = () => 21
const g = () => f() * 2
```

`String(g)` renders as something like

```js
() => $Axo0DuQ…() * 2
```

where `$Axo0DuQ…` is the hash of `f` — the content identity of its EDAG and
captured frame, the same hash the CAVM keys `f` by. Rendering does not
recurse: the name stands for `f`, and a reader who wants `f`'s text asks
the CAVM for that hash. `self` is the same case, not a special one: a
function that refers to itself names its own hash.

Why this answers the open questions for the CAVM profile:

- **Finite.** A name is one identifier however deep the dependency graph,
  so the lazy-rendering requirement is met without lazy rendering.
- **Canonical.** The name is a function of content, not of a counter, so
  the same function renders the same on every CAVM and every run, and equal
  text means equal code — which a JS-compatible profile cannot promise
  ([serialization](./serialization.md), code identity versus allocation
  identity) and a CAVM can, since it deliberately replaces allocation
  identity with content identity.
- **Resolvable.** Unlike `x`, the name can be looked up: it is the address.
  Text containing hash names is source over a namespace the CAVM defines,
  so `String(f)` in this profile is a code representation and not a
  self-contained one — question 1's second reading, decided by the profile.
- **Legal spelling.** The characters an
  [identifier](../README.md#identifiers) may continue with — `A`–`Z`,
  `a`–`z`, `0`–`9`, `_` and `$` — are exactly sixty-four, so a hash spells
  as base64 over that alphabet with no character outside it: a 255-bit
  hash is forty-three characters, against sixty-four in hex. Standard
  base64's `+` and `/`, and base64url's `-`, are not identifier
  characters, so the alphabet is this one and not either standard's;
  `fjs/basen`'s `baseN` builds the codec from the alphabet alone, as the
  standard `base64` and `cbase32` modules already do. A leading `$` makes
  the name start with a non-digit and marks it as generated — `$` is rarely
  written by hand, which keeps the names out of the way of real ones.

Hash names are for captured *functions*. A captured non-function value keeps
whatever the serialization questions decide for it; `() => 3` and
`() => $…()` are two rules, one per kind of capture, and this proposal
touches only the second. Whether a captured object or array with a hash
should also be named rather than inlined — the `const x = []; () => x`
sharing case in [question 2](./serialization.md#open-questions) is the same
shape of problem — is a natural extension to consider, not part of this
proposal.

This is CAVM-only. A JS-compatible executor has no hash to name by, and
[execution models](../../fjs/edag/execution-models.md) keeps the identity
models distinct on purpose; the shared default renderer stays one operation
with the naming of a captured function as its one profile-dependent choice.

### Open

- **Length.** The full hash is 255 bits
  ([content-addressable-vm](./content-addressable-vm.md)), forty-three
  base64 characters: correct, and still long for a name. A prefix is
  readable but reintroduces collisions; the CAVM design already weighs a
  48-bit prefix against a full hash for its *value* representation, and the
  same trade applies to the name. Whether text may abbreviate what the VM keys by in full, and how a
  reader resolves an abbreviated name, is undecided.
- **Encoding details.** Base64 over the identifier alphabet is proposed
  above, and the alphabet's order is the one open choice in it. Forty-three
  characters carry 258 bits, so three are padding; the tag bit and the
  `undefined` all-zero hash of the CAVM design need not appear in a name
  that only ever stands for a function.
- **Round trip.** Whether the compiler should *accept* `$…` names as
  references into a CAVM — making the rendered text loadable, not just
  readable — is a language question and needs the
  [feature process](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions);
  rendering alone adds no syntax.

### Tasks

- [ ] Decide the hash spelling in a name: full or prefix, and the alphabet's
      order.
- [ ] Record the rule in [serialization](./serialization.md) as the CAVM
      profile's answer to questions 1–3, and the JS-compatible profile's
      remaining choice beside it.
- [ ] Extend the shared default renderer with the profile-dependent naming
      of a captured function, once it exists
      ([render or refuse](./3120-parameters.md#default-function-text-render-or-refuse)).

### Related

- [content-addressable-vm](./content-addressable-vm.md) — the hash this
  proposal names by, and its size trade-off.
- [serialization](./serialization.md#open-questions) — the three questions
  this proposal answers for one profile.
- [3120-parameters](./3120-parameters.md#default-function-text-render-or-refuse)
  — the renderer this rule plugs into.
- [execution-models](../../fjs/edag/execution-models.md#4-content-addressable-vm)
  — why the naming is a profile choice.
- [mvp-roadmap](../../nanvm-lib/todo/mvp-roadmap.md#canonical-representation-the-edag-as-data-decided)
  — the EDAG as the thing hashed and rendered.
- [member-functions](../../nanvm-lib/todo/member-functions.md) — nanvm-lib's
  `toString` placeholder, the JS-compatible side of the same gap.
