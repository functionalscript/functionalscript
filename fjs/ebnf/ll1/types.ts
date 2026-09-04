/**
 * Type-level API of the LL(1) backend: what a parser takes and what it
 * returns.
 *
 * The input is a list of symbols, and the output is the typed AST of
 * `../ast/types.ts` — `parser(rule)` returns a `Parser<Ast<typeof rule>>`,
 * which is what `rewrite` in `../map` takes. See `./README.md` for why the
 * backend builds that tree and no other.
 *
 * @module
 */

import type { AbstractRequiredMap } from '../../types/object/types.ts'
import type { RangeSet } from '../../types/range_set/types.ts'
import type { Result } from '../../types/result/types.ts'

/**
 * The first set of every rule of a set, by name: the symbols a match of the
 * rule may begin with, EOF's `-1` among them where the rule may begin with
 * the end of input. A rule that matches empty has the first set of what it
 * consumes when it does not.
 *
 * An abstraction in the sense of `AbstractRequiredMap`, as `RuleSet` is:
 * `firstMap` builds it for every rule of the set, so a reader following a
 * name the set defines is reading a first set, not one that might be
 * missing.
 */
export type FirstMap = AbstractRequiredMap<string, RangeSet>

/**
 * A match: the tree and the index of the first symbol left unconsumed — the
 * input's length when everything was — or the index of the symbol the match
 * failed at, the length when it ran out of input. Both indices are physical:
 * consuming the end of input, which has no element, does not move one past
 * the length.
 */
export type MatchResult<T> = Result<readonly [ast: T, end: number], number>

/**
 * A parser over a list of symbols. The alphabet is the caller's: a text
 * parser hands over code points, a token parser its token symbols. The end of
 * input is synthesized once after the last symbol, so a grammar that ends in
 * EOF is matched against the whole input and a grammar that does not stops
 * where its rule does.
 */
export type Parser<T> = (input: readonly number[]) => MatchResult<T>
