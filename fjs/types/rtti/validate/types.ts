/**
 * Type-level API for RTTI validation.
 *
 * `Validate<T>` and `Result<T>` are the shared consumer signatures — `parse`
 * uses the same pair, under the name `Parse<T>` — so a caller can swap the two
 * readers without changing a type annotation.
 *
 * @module
 */

export type { Path, Result, Validate, ValidationError } from '../common/types.ts'
