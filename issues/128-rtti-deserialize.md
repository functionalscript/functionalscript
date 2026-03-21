# 128. RTTI: Deserializer (`parse`)

Implement a `parse` function (deserializer) that, given a schema `Type` and an unknown input value, constructs a **new** value containing only the fields/elements declared by the schema. This is distinct from `validate` (which checks an existing value in-place) — `parse` always returns a freshly constructed object.

## Problem: Open/Closed Type Inconsistency

TypeScript is inconsistent between objects and tuples:

- **Objects are open** — extra properties are structurally allowed. `StructTs` correctly uses an open mapped type and the validator can return the original value unchanged.
- **Tuples are closed** — length is part of the type. `TupleTs` produces a fixed-length tuple type. However, `tupleValidate` currently uses the open model (no length check), meaning validated values may have extra elements not reflected in the type — a soundness gap.

## Solution

The `parse` approach resolves this inconsistency uniformly: by constructing a new value from only the declared schema entries, both structs and tuples become effectively closed at runtime, matching what `Ts<T>` expresses at the type level. Extra tuple elements and undeclared object properties are silently dropped.

This also provides **forward compatibility** with extended serialization formats — newer versions of a format may add extra fields or tuple elements, and an older schema-based parser will still work correctly by ignoring the unknown parts.

## Location

`types/rtti/parse/module.f.ts`
