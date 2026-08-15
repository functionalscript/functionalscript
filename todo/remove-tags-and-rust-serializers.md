# Remove serialization tags from the spec and the Rust serializers

**Priority:** P3
**Status:** open

## Problem

The tag tables in the spec and the custom binary serializers in `nanvm-lib`
date from the earlier plan to serialize values (including code, as bytecode)
in a custom tagged binary format. That plan has been superseded:

- The internal AST is a JSON/DJS-serializable object — an FJS value — and is
  the stable, canonical representation of functions
  ([`spec/README.md` §9](../spec/README.md#9-serialization-ast-as-data-not-bytecode)).
- The AST is used to generate the JS interpreter and Rust code; rustc replaces
  the previous serializer/deserializer pipeline (see "What changed" in
  [`nanvm-lib/todo/mvp-roadmap.md`](../nanvm-lib/todo/mvp-roadmap.md)).
- When a binary encoding of `Any` values is needed (CAVM hashing, storage,
  interchange), it is generic **CBOR**, not the tagged format (post-MVP task
  in the mvp-roadmap).
- The exact AST shape will be specified by an RTTI schema
  ([ast-spec](./ast-spec.md)), not by tag tables.

So the tags are no longer needed, and neither are the Rust serializers.

**Do not remove anything yet** — this issue is the record of the decision;
the cleanup happens when the issue is picked up.

## Inventory

### Spec ([`spec/README.md`](../spec/README.md))

- §1 JSON table: `Tag` column (`00`–`07`).
- §2 DJS table: `Tag` column (`80`, `08`, `0A`–`10`).
- §3 FJS table: `Tag` column (empty for `function`).
- §9 wording: "expressed as an FJS value (`Any`) using the tag tables above".
- The tables' feature links and structure stay; only the tag encoding goes.

### Referencing documents

- [`ast-spec`](./ast-spec.md): says the tag tables "become derived
  documentation" — update to reflect their removal (the RTTI schema alone is
  normative).
- [`nanvm-lib/todo/mvp-roadmap.md`](../nanvm-lib/todo/mvp-roadmap.md): check
  mentions of tags/serializers stay consistent.

### Rust (`nanvm-lib`)

- `src/common/serializable.rs` — the `Serializable` trait and primitive
  impls.
- `src/common/le.rs` — little-endian helpers; only used by the serializers,
  remove if nothing else adopts it.
- Per-type impls, including their tag constants (`UNDEFINED = 0b0000_0000`,
  …): `src/vm/{bigint,string,array,object,function,impls}/serializable.rs`.
- `src/vm/internal/icontainer.rs` — `Serializable` bounds on
  `IContainer::Header`/`Item` and the container `serialize`/`deserialize`
  methods.
- `src/naive/container.rs` — `Serializable` bounds on the naive container.

## Tasks

- [ ] Spec: drop the `Tag` columns from the §1/§2/§3 tables and the "using
      the tag tables above" wording in §9; keep the feature links.
- [ ] Update [ast-spec](./ast-spec.md) (and check the mvp-roadmap) so the
      RTTI schema is described as the only specification of the AST shape.
- [ ] Rust: remove the `Serializable` trait, its impls, the tag constants,
      and the `Serializable` bounds in `icontainer.rs` and
      `naive/container.rs`; remove `le.rs` if it ends up unused.

## Non-goals

- The future generic CBOR serialization of `Any` values (mvp-roadmap, P3) is
  unaffected — it is a separate facility and does not reuse the tags or the
  `Serializable` trait.
