/**
 * Synthetic Universal Language (SUL) — a universal encoding that bijectively maps any finite sequence of symbols to
 * a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.
 *
 * A *level* defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.
 * A *symbol* is an element of a level's alphabet `[0, n)`.
 * A *word* is a finite sequence of symbols that encodes into a single symbol of the next level.
 *
 * @module
 */

