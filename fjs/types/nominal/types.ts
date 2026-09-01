/**
 * Types for nominal typing (branded TypeScript types).
 *
 * @module
 */

/**
 * Nominal type.
 *
 * It doesn't allow `===` between different nominal types.
 * It doesn't allow `<`, `>`, `<=`, `>=` comparisons at all.
 */
export type Nominal<N extends string, R extends string, B> =
    symbol & { readonly[k in N]: readonly [R, B] }

// Brand carriers for the comparison experiments in `proof.f.mjs`. They live
// here because `declare const` / `unique symbol` have no JavaScript form; the
// proof imports the two types below and keeps the expressions that demonstrate
// what TypeScript does or does not reject. `_`-prefixed: private by contract.

declare const noCompareBrand: unique symbol

declare const brand: unique symbol

/** A unique-symbol-keyed brand. TypeScript still permits `<` between two of these. */
export type _SymbolKeyBranded = { readonly [noCompareBrand]: void }

/** A `symbol` intersection brand. `<` on this is TS2469, so the proof only comments it. */
export type _SymbolIntersectionBranded = symbol & { readonly [brand]: 'SafeId' }
