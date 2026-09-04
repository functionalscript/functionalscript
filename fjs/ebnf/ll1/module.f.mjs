/**
 * The LL(1) backend over the EBNF data {@link RuleSet}: a predictive parser
 * that builds the typed AST of `../ast/types.ts`.
 *
 * {@link firstMap} is the analysis: the symbols every rule may begin with,
 * refusing a grammar no one symbol of lookahead can decide — a rule that
 * reaches itself before consuming anything (`left recursion`), and a variant
 * whose branches begin with a symbol in common (`first/first conflict`) —
 * naming the rule. {@link parserRuleSet} and {@link parser} are the machine
 * over it: a rule is entered before its first symbol is consumed, so the
 * lookahead only ever selects a variant's branch or a repetition's next
 * round, and the tree is one node per rule invocation, in the shape
 * `Ast<R>` gives each form. See `./README.md` for the design and `./types.ts`
 * for the type-level API.
 *
 * @module
 *
 * @import { RangeSet } from '../../types/range_set/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { Ast } from '../ast/types.ts'
 * @import { Rule } from '../types.ts'
 * @import { EmptyTagMap, RuleSet, RuleVisitor } from '../data/types.ts'
 * @import { FirstMap, Parser } from './types.ts'
 * @import { _FirstState, _RepeatFrame, _Stack, _State } from './private.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { at, definedEntries, definedValues } from '../../types/object/module.f.mjs'
import { contains, empty, intersection, union } from '../../types/range_set/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { contains as visiting, empty as noNames, set as visit } from '../../types/string_set/module.f.mjs'
import { emptyTagMap, matchRule, toData, validate } from '../data/module.f.mjs'

const { keys } = Object
const { isSafeInteger } = Number

/** The end of input, as the one symbol the parser synthesizes after the last. */
const eofSymbol = -1

/**
 * An ordinary symbol, as the sets of `../data` are drawn from: a non-negative
 * safe integer, spelled the one way. The input is refused outside that
 * domain because `-1` in it would read as the end of input, which is
 * synthesized and not spelled, and anything else in it could match no set.
 *
 * @type {(s: number) => boolean}
 */
const isSymbol = s => isSafeInteger(s) && s >= 0 && !Object.is(s, -0)

/**
 * Whether the rule named `name` can match empty — an own entry only, as in
 * `../data`: a rule may be named `constructor`, and `{}` inherits one.
 *
 * @type {(empty: EmptyTagMap) => (name: string) => boolean}
 */
const nullable = empty => name => at(name)(empty) !== null

/**
 * The first set of `name`, and the map extended with every rule computed on
 * the way. `current` holds the rules whose first sets are still being
 * computed: reaching one of them again is reaching it before any symbol was
 * consumed, which is left recursion.
 *
 * @type {(ruleSet: RuleSet, nullable: (name: string) => boolean) =>
 *  (current: StringSet) =>
 *  (map: FirstMap, name: string) =>
 *  _FirstState}
 */
const firstOf = (ruleSet, nullable) => {
    /** @type {(current: StringSet) => (map: FirstMap, name: string) => _FirstState} */
    const first = current => (map, name) => {
        const known = at(name)(map)
        if (known !== null) { return [map, known] }
        assert(!visiting(name)(current), ['left recursion', name])
        const inner = first(visit(name)(current))
        /** @type {RuleVisitor<_FirstState>} */
        const v = {
            set: s => [map, s],
            // A sequence begins with what its items begin with, up to and
            // including the first item that cannot match empty. The items
            // after it are not in first position, so they are reached from
            // the top rather than from here.
            sequence: items => {
                const [m, f] = items.reduce(
                    /** @type {(acc: readonly [FirstMap, RangeSet, boolean], item: string) => readonly [FirstMap, RangeSet, boolean]} */
                    (([m, f, open], item) => {
                        if (!open) { return [m, f, open] }
                        const [next, itemFirst] = inner(m, item)
                        return [next, union(f)(itemFirst), nullable(item)]
                    }),
                    [map, empty, true])
                return [m, f]
            },
            // Two branches beginning with the same symbol are a choice the
            // lookahead cannot make, so the second is refused, naming the
            // symbols the two have in common.
            variant: branches => definedEntries(branches).reduce(
                /** @type {(acc: _FirstState, entry: readonly [string, string]) => _FirstState} */
                (([m, f], [tag, item]) => {
                    const [next, itemFirst] = inner(m, item)
                    const clash = intersection(f)(itemFirst)
                    assert(clash.length === 0, ['first/first conflict', name, tag, clash])
                    return [next, union(f)(itemFirst)]
                }),
                [map, empty]),
            // A repetition begins with its item, unless no round can ever
            // start: `max` of `0` matches empty and only empty, so its first
            // set is empty and its item is not in first position.
            repeat: (_min, max, item) => max === 0 ? [map, empty] : inner(map, item),
        }
        const [next, f] = matchRule(v)(ruleSet[name])
        return [{ ...next, [name]: f }, f]
    }
    return first
}

/**
 * The first sets of the rules named, and of every rule they reach.
 *
 * @type {(ruleSet: RuleSet, nullable: (name: string) => boolean) => (names: readonly string[]) => FirstMap}
 */
const firstMapOf = (ruleSet, nullable) => {
    const first = firstOf(ruleSet, nullable)(noNames)
    return names => names.reduce(
        /** @type {(map: FirstMap, name: string) => FirstMap} */
        ((map, name) => first(map, name)[0]),
        {})
}

/**
 * The first set of every rule in the set: the symbols a match of the rule may
 * begin with, EOF's `-1` among them. A set begins with its symbols, a
 * sequence with its items' up to and including the first that cannot match
 * empty, a variant with its branches', and a repetition with its item's —
 * unless its `max` is `0`, when no round can start and it begins with
 * nothing, so a rule that can only match empty has the empty set.
 *
 * The set is read as `validate` in `../data` certifies it. What is refused
 * here is what that layer leaves to a backend, because another backend may
 * accept it: a rule that reaches itself before consuming a symbol —
 * `left recursion`, which no lookahead can decide and a predictive match
 * would loop on — and a variant two of whose branches begin with a symbol
 * in common — `first/first conflict`, which one symbol cannot tell apart.
 * Each names the rule. This is the analysis of a whole set, every rule of
 * it; a parser analyses only what its entry reaches.
 *
 * @type {(ruleSet: RuleSet) => FirstMap}
 */
export const firstMap = ruleSet => firstMapOf(ruleSet, nullable(emptyTagMap(ruleSet)))(keys(ruleSet))

/**
 * The rules a rule names.
 *
 * @type {RuleVisitor<readonly string[]>}
 */
const references = {
    set: () => [],
    sequence: items => items,
    variant: branches => definedValues(branches),
    repeat: (_min, _max, item) => [item],
}

/**
 * The names `name` reaches, itself first, added to those already found: a
 * rule the entry does not reach is dead, not wrong, as `../data` says, so
 * a parser leaves it out of its analysis rather than refusing the set over
 * it.
 *
 * @type {(ruleSet: RuleSet) => (found: readonly string[], name: string) => readonly string[]}
 */
const reach = ruleSet => (found, name) => found.includes(name)
    ? found
    : matchRule(references)(ruleSet[name]).reduce(reach(ruleSet), [...found, name])

/**
 * The machine, for a set already validated. A match is a loop over one
 * state — the frames suspended and what to do next — rather than a
 * recursion: nesting depth grows with the input, not the grammar, so a
 * recursive matcher would overflow the JS stack on a few thousand nested
 * brackets, where this one's stack grows on the heap.
 *
 * @type {(ruleSet: RuleSet, empty: EmptyTagMap, entry: string) => Parser<unknown>}
 */
const build = (ruleSet, empty, entry) => {
    const isNullable = nullable(empty)
    const first = firstMapOf(ruleSet, isNullable)(reach(ruleSet)([], entry))
    return input => {
        const outside = input.findIndex(s => !isSymbol(s))
        assert(outside === -1, ['not a symbol', outside, input[outside]])
        const { length } = input

        /**
         * The symbol at a cursor: one read out of the input, and the end of
         * input at its end. Only meaningful while `pos <= length`.
         *
         * @type {(pos: number) => number}
         */
        const symbolAt = pos => pos < length ? input[pos] : eofSymbol

        /**
         * Whether the symbol at `pos` is in `s`. Past the consumed end of
         * input there is no symbol, so nothing accepts it.
         *
         * @type {(s: RangeSet) => (pos: number) => boolean}
         */
        const accepts = s => pos => pos <= length && contains(s)(symbolAt(pos))

        /** @type {(name: string) => (pos: number) => boolean} */
        const starts = name => accepts(first[name])

        /**
         * Consuming a symbol contributes the symbol; the end of input has no
         * element to contribute, so its node is empty.
         *
         * @type {(pos: number) => unknown}
         */
        const leafAt = pos => pos < length ? input[pos] : []

        /**
         * A round is forced while fewer than `min` have matched, and optional
         * until `max`: one more starts exactly when the lookahead is in the
         * item's first set. An optional round therefore consumes at least
         * one symbol, so an unbounded repetition always terminates; a forced
         * one may match empty, which is how `times(3)([])` matches empty
         * three times.
         *
         * @type {(stack: _Stack, frame: _RepeatFrame, pos: number) => _State}
         */
        const round = (stack, frame, pos) => {
            const { min, max, item, rounds, count } = frame
            return count < min || (count < max && starts(item)(pos))
                ? [{ top: frame, rest: stack }, ['enter', item, pos]]
                : [stack, ['ok', toArray(rounds), pos]]
        }

        /**
         * Enters the rule `name` at `pos`. A rule is entered before its first
         * symbol is consumed, so the lookahead only ever selects — a
         * variant's branch, a repetition's next round — and every invocation
         * builds a node of its own.
         *
         * @type {(stack: _Stack, name: string, pos: number) => _State}
         */
        const enter = (stack, name, pos) => {
            /** @type {RuleVisitor<_State>} */
            const v = {
                set: s => [stack, accepts(s)(pos) ? ['ok', leafAt(pos), pos + 1] : ['error', pos]],
                sequence: items => items.length === 0
                    ? [stack, ['ok', [], pos]]
                    : [{ top: { kind: 'sequence', items, index: 0, done: [] }, rest: stack }, ['enter', items[0], pos]],
                // The branch the lookahead selects, else the one that
                // matches empty — the last such, as `emptyTagMap` in
                // `../data` names it.
                variant: branches => {
                    const all = definedEntries(branches)
                    const branch = all.find(([, item]) => starts(item)(pos))
                        ?? all.findLast(([, item]) => isNullable(item))
                    return branch === undefined
                        ? [stack, ['error', pos]]
                        : [{ top: { kind: 'variant', tag: branch[0] }, rest: stack }, ['enter', branch[1], pos]]
                },
                repeat: (min, max, item) =>
                    round(stack, { kind: 'repeat', min, max, item, rounds: null, count: 0 }, pos),
            }
            return matchRule(v)(ruleSet[name])
        }

        /**
         * Hands a matched node to the innermost frame: the next item of a
         * sequence, the variant's node tagged, or the next round.
         *
         * @type {(stack: NonNullable<_Stack>, ast: unknown, pos: number) => _State}
         */
        const resume = ({ top, rest }, ast, pos) => {
            switch (top.kind) {
                case 'sequence': {
                    const done = [...top.done, ast]
                    const index = top.index + 1
                    return index < top.items.length
                        ? [{ top: { ...top, index, done }, rest }, ['enter', top.items[index], pos]]
                        : [rest, ['ok', done, pos]]
                }
                case 'variant': { return [rest, ['ok', [top.tag, ast], pos]] }
                case 'repeat': {
                    return round(rest, { ...top, rounds: concat(top.rounds)([ast]), count: top.count + 1 }, pos)
                }
            }
        }

        /**
         * The public index of a cursor: consuming the end of input moves the
         * cursor past the physical end, and both report the length.
         *
         * @type {(pos: number) => number}
         */
        const physical = pos => Math.min(pos, length)

        /** @type {_State} */
        let state = [null, ['enter', entry, 0]]
        while (true) {
            const [stack, step] = state
            if (step[0] === 'enter') {
                state = enter(stack, step[1], step[2])
            } else if (step[0] === 'error') {
                // LL(1) committed to every choice on the way here, so there
                // is nothing to rewind and retry: the first failure is the
                // match's.
                return error(physical(step[1]))
            } else if (stack === null) {
                return ok([step[1], physical(step[2])])
            } else {
                state = resume(stack, step[1], step[2])
            }
        }
    }
}

/**
 * A parser for a rule set at its entry. The set is validated as `../data`
 * validates it, then the rules the entry reaches are analysed as
 * {@link firstMap} analyses a set, so a set that is no grammar and a grammar
 * that is not LL(1) are both refused here, before any input — a rule the
 * entry does not reach is dead, not wrong, and is left alone. The tree it
 * builds is the one `Ast<R>` gives the rule the set was lowered from — a
 * symbol for a set, an empty node for EOF, an array for a sequence,
 * `[tag, node]` for a variant, and one flat array for a repetition whatever
 * its bounds.
 *
 * @type {(ruleSet: RuleSet, entry: string) => Parser<unknown>}
 */
export const parserRuleSet = (ruleSet, entry) => {
    validate(ruleSet, entry)
    return build(ruleSet, emptyTagMap(ruleSet), entry)
}

/**
 * A parser for a front-end rule: the rule lowered by `toData` in `../data`
 * and matched by {@link parserRuleSet}, typed by what it builds. What it
 * returns is `Ast<R>`, so `rewrite` in `../map` takes it as it is.
 *
 * @template {Rule} const R
 * @param {R} rule
 * @returns {Parser<Ast<R>>}
 */
export const parser = rule => {
    const [ruleSet, entry] = toData(rule)
    return /** @type {Parser<any>} */ (build(ruleSet, emptyTagMap(ruleSet), entry))
}
