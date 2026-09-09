/**
 * Type-level API of the LL(1) backend: what a parser takes, what it returns,
 * and the rewrite set it folds.
 *
 * The input is a list of {@link Meta} symbols carrying `I`, and the output is
 * the typed AST of `../ast/types.ts`: `parser(rule, set)` returns a
 * `Parser<Ast<typeof rule, I, O>, I>`, where `O` is what the set's mappings
 * return. See `./README.md` for the design.
 *
 * @module
 */

import type { AbstractRequiredMap } from '../../types/object/types.ts'
import type { Phantom } from '../../types/phantom/types.ts'
import type { RangeSet } from '../../types/range_set/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Children, Meta } from '../ast/types.ts'
import type { Rule } from '../types.ts'

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
 * A parser over a list of symbols, each carrying its metadata `I`. The
 * alphabet is the caller's: a text parser hands over code points, a token
 * parser its token symbols, and `I` is whatever the caller knows about each
 * that the grammar does not. The end of input is synthesized once after the
 * last symbol, so a grammar that ends in EOF is matched against the whole
 * input and a grammar that does not stops where its rule does.
 *
 * A match begins at `start`, the beginning of the input by default, and
 * the indices it reports are the input's, so a caller resumes where the
 * last match ended by handing that index back — a token layer runs a
 * one-token grammar this way, once per token, over the one input. The
 * index is refused outside `0..length`.
 *
 * The second parameter is read: a parser handed to an array combinator
 * that supplies an index in that position — `inputs.map(parse)` — begins
 * each match at the element's index rather than at the input's start.
 * Wrap it, `inputs.map(input => parse(input))`, as with any function of
 * an optional number.
 */
export type Parser<T, I = unknown> = (symbols: readonly Meta<I>[], start?: number) => MatchResult<T>

/**
 * One mapping: the rule the author holds, and the function the parser
 * applies to what that rule matches, with the rules under it already mapped.
 * The rule's type is erased here, since the function was typed from it where
 * the mapping was made, so the set is a plain list. `I` is a phantom: it says
 * which layer's input the function was written against, so that a mapping of
 * one layer is not a mapping of another.
 */
export type Mapping<I, O> =
    Phantom<readonly [rule: Rule, f: (children: never) => Meta<O>], I>

/**
 * The mappings a parser folds, in any order, one per rule. A list, so that it
 * is assembled across modules — a grammar's mappings for its own scaffolding
 * beside a consumer's — and nothing in its type depends on the whole.
 */
export type RewriteSet<I, O> = readonly Mapping<I, O>[]

/**
 * The constructor of a layer's mappings: `mapping` in `./module.f.mjs`, bound
 * once to the layer's metadata types by annotating a binding of it as
 * `Mappings<Cp, Tok>`, so that `f` is typed from the rule it is keyed by
 * under that `I` and `O`, where a function inside a list literal gets no
 * contextual type at all. A rule says nothing of either type, which is why
 * they are bound where a layer begins and read from there, and why a
 * binding rather than a call: TypeScript infers the two from the binding's
 * annotation through the `Children` alias cheaply, where inferring them
 * from a call's return type unrolls the alias and exceeds its instantiation
 * limit (TS2589).
 */
export type Mappings<I, O> =
    <const R extends Rule>(rule: R, f: (children: Children<R, I, O>) => Meta<O>) => Mapping<I, O>
