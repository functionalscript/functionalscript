## Admit `toLowerCase` and `toUpperCase`

**Priority:** P3
**Status:** open

A language feature: this file is the proposal
[DESIGN.md §12](../../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
asks for, and implementation waits on the approval recorded below.

### Problem

`s.toLowerCase()` and `s.toUpperCase()` are compilation errors,
`prohibited member function`
([`../module.f.js`](../module.f.js)'s `prohibitedCalls`, the rows in
[`../README.md`](../README.md)), because their answer depends on the
engine's Unicode version: ECMAScript defines both as the Unicode Default
Case Conversion of "the latest version of the Unicode Standard", so an
engine shipping one Unicode version and an engine shipping the next can
case a newly assigned character differently, and `allowedCalls` admits only
what is "pure, specified exactly, and the same on every engine".
[`nanvm/lib/src/vm/string/README.md`](../../../../nanvm/lib/src/vm/string/README.md)
lists the pair among what is out by design, and grows no entry for them.

Case conversion is nonetheless among the most common things a module does
to a string, and about a dozen `.f.mjs` modules in the tree call it today —
[`git/config`](../../../git/config/module.f.mjs) on units and section
names, [`web`](../../../web/module.f.mjs) on a scheme and a host,
[`effects/node`](../../../effects/node/module.f.mjs) and its
[virtual host](../../../effects/node/virtual/module.f.mjs) on header names
and hosts, [`media/type`](../../../media/type/module.f.mjs) on a file
extension, [`media/rust`](../../../media/rust/module.f.mjs) on a
`camelCase` name, [`basen/cbase32`](../../../basen/cbase32/module.f.mjs)
on a digit, [`path/import`](../../../path/import/module.f.mjs) on a dot
segment, [`website/cli/search`](../../../website/cli/search/module.f.mjs)
on a query. Each holds at the pre-compiler state, and
[`todo/fjs-nanvm-integration.md`](../../../../todo/fjs-nanvm-integration.md)
counts the call as a rewrite the module owes, not a feature the language
lacks. The receivers are of two kinds. Most decide a protocol over ASCII —
a scheme name, a unit letter, a hexadecimal digit, a dot segment, a file
extension — and the caller then compares the answer with ASCII literals,
so only an answer inside ASCII matters; the few characters outside ASCII
that case into it, the Kelvin sign among them, have done so since long
before any version an engine ships, so the engines agree here too.
On ASCII every engine of every Unicode version answers the same, and for
these the rule refuses the whole operation for a divergence they cannot
reach. The rest normalize text the module does not control: the query a
user types into `website/cli/search`, the header names and hosts a
request carries to `effects/node` and `web`, the identifier `media/rust`
snake-cases, which Rust lets be Unicode. There a non-ASCII receiver
is ordinary input, and the divergence the rule guards against is reachable
in principle, for a character one engine's Unicode version cases and
another's does not — which is what the proposal pins.

The refusal protects a real guarantee, that a module means one thing
everywhere, and the proposal has to keep it. It also protects, by accident,
against a hole the full operation has: a predicate that asks
`c.toLowerCase()` whether `c` is a letter accepts `'K'`, the Kelvin
sign, which lowercases to `k` ([`text/ascii`](../../../text/ascii/module.f.mjs)'s
`isLatinLetter`, and the hole that raised
[`js/identifier`'s todo](../../identifier/todo/lexical-predicates-from-text-ascii.md)).
That is a reason to document, not to refuse.

### Proposal

Move `toLowerCase` and `toUpperCase` from `prohibitedCalls` to
`allowedCalls`, with the meaning JavaScript gives them — the Unicode
Default Case Conversion, full mappings included, so `'ß'.toUpperCase()` is
`'SS'` and a final sigma lowercases by its context — and pin the Unicode
version the language speaks, as it already pins the ECMAScript edition the
prototype lists come from. NaNVM answers that version exactly, and the
limit joins the ones
[spec: built-in member functions](../../../../spec/README.md#built-in-member-functions)
already lists for native execution: a host engine with a newer Unicode may
case a character the pinned version leaves uncased, as it may already format
a large-integer radix string differently. Rust's standard library carries
the tables, at the Unicode version the pinned toolchain ships
([`fjs/ci/config`](../../../ci/config/module.f.js)), so the VM writes no
table of its own. The toolchain pin reaches this repository's builds
alone: the crate is built on every user's machine
([`nanvm/lib`'s roadmap](../../../../nanvm/lib/todo/mvp-roadmap.md)), by
whatever `rustc` is there, and a `rust-version` in its manifest is a
floor, not a pin. So the version is checked, not trusted, as
`fjs/ci/config` checks Node's: the crate asserts the standard library's
`char::UNICODE_VERSION` against the pinned version at compile time, and a
build whose library carries another version does not build, rather than
give the same module another meaning
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
The pinned version is named in the spec and in
[`../README.md`](../README.md)'s rows, and moves only when the toolchain
does, the assertion with it. A lone surrogate has no case and
no Rust `char`, and the VM's lossy conversion to a Rust string
(`vm/string/from.rs`) would replace it with U+FFFD, which JavaScript does
not: the VM converts each well-formed run and copies a lone surrogate
unchanged, so `'\ud800A'.toLowerCase()` keeps its first code unit.

Two alternatives, and why not:

- **Admit the names with an ASCII meaning**, cased below `0x80` and copied
  above. Refused: the same source would then answer `'Ä'.toLowerCase()`
  differently on a JavaScript engine and on NaNVM, which is the one thing
  the prohibition exists to prevent.
- **Refuse a non-ASCII receiver** at run time
  ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):
  admit the names, and throw on a receiver with a code unit at or above
  `0x80`, where the engines could disagree. Honest, and the
  protocol-deciding callers pass, but the text-normalizing ones do not: a
  search query with one non-ASCII letter would throw where it answers
  today, and the host engine running the source directly does not throw,
  so it is the ASCII alternative's divergence moved from the value to the
  completion. Kept as the fallback should a pinned Unicode version be
  judged too weak a guarantee.

Independent of this decision, the protocol-deciding callers want an ASCII
case fold, not Unicode's: `text/ascii` could export it over code points
today, beside its hexadecimal fold, and a caller whose alphabet is ASCII
could take it without waiting on a language change. Which callers those
are is the follow-up's to establish, one by one, since the list above is
not it: `media/rust`'s `snakeCase` reads as one and is not, a Rust
identifier being Unicode, so `snakeCase('Ä')` answers `_ä` today and
would not through an ASCII fold. Nor is the fold behavior-neutral where it
fits: it retires every acceptance that is the Kelvin-sign hole above in a
protocol whose alphabet is ASCII, and the follow-up names each —
`cBase32ToVec5x` decodes the Kelvin sign today, since `normalizeChar`
lowercases it to `k`, a letter of the alphabet, and `git/config`'s
`tryInt` reads it as the unit suffix `k`, so a count may end in it; an
ASCII fold answers `null` for both. The text-normalizing callers stay on
`toLowerCase`: `matches('Ä', 'ä')` holds today through Unicode's
lowercasing and would not through ASCII's, so they wait on this proposal.
The fold is a module's task, filed where it lands, not this one's.

Benefits: the most-asked-for string operation compiles as written,
JavaScript's meaning and JavaScript's spelling, and about a dozen modules
lose a rewrite. Drawbacks: the language names a Unicode version, carries
it forward with the toolchain, and a build of the crate elsewhere needs a
standard library at that version or does not build; a host engine ahead of the pin is an
engine-defined edge the spec documents rather than a divergence the
compiler refuses, and the text-normalizing callers can reach it; and the
Kelvin-sign class of mistake becomes writable,
which the row in [`../README.md`](../README.md) warns about.

### Approval

None yet. Implementation needs formal, explicit approval from a language
designer other than the proposer
([DESIGN.md §12](../../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions));
record the designer and a link to the approval here.

### Tasks

- [ ] obtain and record the approval above, with the Unicode version it pins
- [ ] `fjs/js/prototype`: move the two names to `allowedCalls`; rewrite
      their rows in `README.md`, naming the pinned version and the ASCII
      predicate hole; update the proof and `types.ts`
- [ ] `spec/README.md`: add the pair to the string row of the built-in
      member functions table, and the version pin to native execution's
      limits
- [ ] `nanvm/lib`: answer both on a string in `vm/string`, through the
      standard library's conversion of each well-formed run, a lone
      surrogate copied unchanged, with a compile-time assertion of
      `char::UNICODE_VERSION` against the pin; drop the row from its README's
      "out by design" table; take the pair through
      [`fjs/nanvm/methods`](../../../nanvm/methods/module.f.mjs)'s pending
      list and the shared corpus, with cases for the full mappings, the
      final sigma and a lone surrogate
- [ ] [`todo/fjs-nanvm-integration.md`](../../../../todo/fjs-nanvm-integration.md):
      the `toLowerCase` row no longer names a rewrite
- [ ] the callers above compile as written; whichever rewrote meanwhile may
      stay rewritten

### Related

- [`../README.md`](../README.md) — the rows this changes
- [`to-sorted-inconsistent-comparator.md`](./to-sorted-inconsistent-comparator.md)
  — the other engine-defined edge an allowed call has, handled by
  documenting it
- [`nanvm/lib/todo/member-functions.md`](../../../../nanvm/lib/todo/member-functions.md)
  — the completeness check the new pair goes through
- [`js/identifier`'s todo](../../identifier/todo/lexical-predicates-from-text-ascii.md)
  — the Kelvin-sign hole, and the ASCII classes the callers actually want
- [`todo/fjs-nanvm-integration.md`](../../../../todo/fjs-nanvm-integration.md)
  — counts the call as the module's rewrite, which this proposal reverses
