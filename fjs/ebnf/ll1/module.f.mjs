/**
 * The LL(1) backend over the EBNF data {@link RuleSet}: a predictive parser
 * that builds the typed AST of `../ast/types.ts` and folds a rewrite set
 * into the parse.
 *
 * {@link firstMap} is the analysis: the symbols every rule may begin with,
 * refusing a grammar no one symbol of lookahead can decide — a rule that
 * reaches itself before consuming anything (`left recursion`), and a variant
 * whose branches begin with a symbol in common (`first/first conflict`) —
 * naming the rule. {@link parserRuleSet} and {@link parser} are the machine
 * over it: a rule is entered before its first symbol is consumed, so the
 * lookahead only ever selects a variant's branch or a repetition's next
 * round, and the tree is one node per rule invocation, in the shape
 * `Ast<R, I, O>` gives each form. A node whose rule is mapped is handed to
 * its mapping as it comes into existence, and the mapping's result stands
 * in its place. {@link mapping} is how a mapping is written. See
 * `./README.md` for the design and `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { RangeSet } from '../../types/range_set/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { Ast, Children, Meta } from '../ast/types.ts'
 * @import { Rule } from '../types.ts'
 * @import { EmptyTagMap, RuleNameMap, RuleSet, RuleVisitor } from '../data/types.ts'
 * @import { FirstMap, Mapping, Parser, RewriteSet } from './types.ts'
 * @import { _FirstState, _Follows, _Frame, _Mappers, _RepeatFrame, _Visit } from './private.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { fixpoint } from '../../types/function/module.f.js'
import { concat } from '../../types/list/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { at, definedEntries, definedValues, structurallySame } from '../../types/object/module.f.mjs'
import { contains, empty, intersection, union } from '../../types/range_set/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { contains as visiting, empty as noNames, set as visit } from '../../types/string_set/module.f.mjs'
import { _nullable as nullable, emptyTagMap, eofSymbol, isSymbol, matchRule, toData, validate } from '../data/module.f.mjs'
import { min as minNumber } from '../../types/number/min/module.f.js'
import { walkFold } from '../../types/stack_walk/module.f.js'

const { keys, fromEntries } = Object
const { isSafeInteger } = Number

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
 * The rules a rule enters: the ones it names, except the item of a
 * repetition of at most zero rounds, which no round ever enters.
 *
 * @type {RuleVisitor<readonly string[]>}
 */
const references = {
    set: () => [],
    sequence: items => items,
    variant: branches => definedValues(branches),
    repeat: (_min, max, item) => max === 0 ? [] : [item],
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
 * What one rule says about the symbols that may follow the rules it names,
 * given its own follow set: in a sequence, each item is followed by what
 * the items after it begin with, and by what follows the sequence where
 * those may all match empty; a variant's branch is followed by what follows
 * the variant; a repetition's item by what follows the repetition and, where
 * a round may follow, by what the item begins with.
 *
 * @type {(first: FirstMap, nullable: (name: string) => boolean) => (own: RangeSet) => RuleVisitor<_Follows>}
 */
const followsOf = (first, nullable) => own => ({
    set: () => [],
    sequence: items => items.reduceRight(
        /** @type {(acc: readonly [_Follows, RangeSet, boolean], item: string) => readonly [_Follows, RangeSet, boolean]} */
        (([follows, after, open], item) => [
            [...follows, [item, open ? union(after)(own) : after]],
            union(first[item])(nullable(item) ? after : empty),
            open && nullable(item)]),
        [[], empty, true])[0],
    variant: branches => definedValues(branches).map(item => [item, own]),
    repeat: (_min, max, item) => max === 0 ? [] : [[item, union(own)(max > 1 ? first[item] : empty)]],
})

/**
 * The symbols that may come right after a match of each rule named: the
 * standard follow-set fixpoint over the rules the entry reaches, from every
 * set empty — nothing is required after the entry, since a match stops
 * where its rule does — relaxed a round at a time until a round changes
 * nothing. A round only ever grows a set, so it terminates.
 *
 * @type {(ruleSet: RuleSet, first: FirstMap, nullable: (name: string) => boolean, names: readonly string[]) => FirstMap}
 */
const followMap = (ruleSet, first, nullable, names) => {
    const follows = followsOf(first, nullable)
    /** @type {(follow: FirstMap) => FirstMap} */
    const step = follow => names
        .flatMap(name => matchRule(follows(follow[name]))(ruleSet[name]))
        .reduce(
            /** @type {(m: FirstMap, entry: readonly [string, RangeSet]) => FirstMap} */
            ((m, [name, symbols]) => ({ ...m, [name]: union(m[name])(symbols) })),
            follow)
    // `structurallySame`, not `===`: a round rebuilds every set it unions
    // into, whether or not its contents changed.
    return fixpoint(step, structurallySame)(fromEntries(names.map(name => [name, empty])))
}

/**
/**
 * What a rule's own optional decision is made on: the symbols that make the
 * lookahead take one more step here rather than leave the rule. A rule that
 * can match empty is entered on what it begins with, and a repetition with
 * a round left to spare starts that round on what its item begins with —
 * one decision or the other, or both, since a repetition from zero is
 * nullable and its two sets are one.
 *
 * A round below `min` is forced and a `max`th round impossible, so neither
 * is a decision; every other rule is entered by its parent, which is the
 * parent's decision and not this one's.
 *
 * @type {(first: FirstMap, nullable: (name: string) => boolean) => (name: string) => RuleVisitor<RangeSet>}
 */
const decisionOf = (first, nullable) => name => {
    const skip = nullable(name) ? first[name] : empty
    return {
        set: () => skip,
        sequence: () => skip,
        variant: () => skip,
        repeat: (min, max, item) => union(skip)(max > min ? first[item] : empty),
    }
}

/**
 * Refuses a rule whose own decision is made on a symbol that may also
 * follow it — a first/follow conflict, which one symbol cannot decide: the
 * lookahead takes the step where the grammar also allows the rule to end
 * and leave the symbol to what follows, so `[option('x'), 'x']` would never
 * match `x`, and neither would `[repeat(1, 2)('x'), 'x']` on `xx`. The
 * refusal names the rule and the symbols.
 *
 * @type {(ruleSet: RuleSet, first: FirstMap, nullable: (name: string) => boolean, names: readonly string[]) => void}
 */
const checkFollow = (ruleSet, first, nullable, names) => {
    const follow = followMap(ruleSet, first, nullable, names)
    const decision = decisionOf(first, nullable)
    names.forEach(name => {
        const clash = intersection(matchRule(decision(name))(ruleSet[name]))(follow[name])
        assert(clash.length === 0, ['first/follow conflict', name, clash])
        return undefined
    })
    return undefined
}

/** @type {_Mappers} */
const noMappers = new Map()

/**
 * The rewrite set keyed by name, through the map `toData` returns, refused
 * before any input where the machine refuses everything else: a rule the
 * grammar does not hold has no name, and a rule mapped twice would let the
 * later entry win — the set is assembled from several sources, so the
 * output would depend on assembly order.
 *
 * @type {(names: RuleNameMap) => (set: readonly Mapping<unknown, unknown>[]) => _Mappers}
 */
const mappersOf = names => set => set.reduce(
    /** @type {(m: _Mappers, mapping: Mapping<unknown, unknown>) => _Mappers} */
    ((m, [rule, f]) => {
        const name = names.get(rule)
        assert(name !== undefined, ['a rule the grammar does not hold', rule])
        assert(!m.has(name), ['a rule mapped twice', name])
        return new Map([...m, [name, f]])
    }),
    noMappers)

/**
 * A node as it comes into existence: its rule's mapping applied where the
 * rule has one, the node itself where it has none. What a mapping takes was
 * typed from its rule where the mapping was made; the cast is that typing's
 * receipt, since the machine builds nodes untyped.
 *
 * @type {(mappers: _Mappers) => (name: string, node: unknown) => unknown}
 */
const emitBy = mappers => (name, node) => {
    const f = mappers.get(name)
    return f === undefined ? node : f(/** @type {never} */ (node))
}

/**
 * The machine, for a set already validated. A match is a walk over an
 * explicit stack, driven by `../../types/stack_walk`'s `walkFold` with the
 * cursor as its accumulator, rather than a recursion: nesting depth grows
 * with the input, not the grammar, so a recursive matcher would overflow
 * the JS stack on a few thousand nested brackets, where this one's stack
 * grows on the heap.
 *
 * A node comes into existence at five sites — a set's leaf and the empty
 * sequence in `enter`, the end of a sequence, the variant wrap and the
 * closing of a repetition in `resume` and `round` — and each hands it to
 * `emit` first, so a frame only ever holds mapped values and the only
 * structure that exists is the unmapped region between a mapping and the
 * mappings below it.
 *
 * @type {(ruleSet: RuleSet, empty: EmptyTagMap, entry: string, mappers: _Mappers) => Parser<unknown, unknown>}
 */
const build = (ruleSet, empty, entry, mappers) => {
    const isNullable = nullable(empty)
    const names = reach(ruleSet)([], entry)
    const first = firstMapOf(ruleSet, isNullable)(names)
    checkFollow(ruleSet, first, isNullable, names)
    const emit = emitBy(mappers)
    return (symbols, start = 0) => {
        const { length } = symbols
        assert(isSafeInteger(start) && start >= 0 && start <= length, ['start outside the input', start, length])

        /**
         * The symbol at a cursor: one read out of the input, and the end of
         * input at its end. Only meaningful while `pos <= length`.
         *
         * A symbol outside the domain of `../data` is refused: `-1` would
         * read as the end of input, which is synthesized and not spelled,
         * and anything else could match no set.
         *
         * A symbol is checked where it is read rather than by a scan of the
         * whole input up front: a parser resumed at an index reads from
         * there, and a token layer that resumes it once per token would pay
         * the scan once per token — quadratic in the input. What the parse
         * never reads is never checked, and never matters.
         *
         * @type {(pos: number) => number}
         */
        const symbolAt = pos => {
            if (pos >= length) { return eofSymbol }
            const { symbol } = symbols[pos]
            assert(isSymbol(symbol), ['not a symbol', pos, symbols[pos]])
            return symbol
        }

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
         * Consuming a symbol contributes the symbol as it arrived, its
         * metadata with it; the end of input has no element to contribute,
         * so its node is empty.
         *
         * @type {(pos: number) => unknown}
         */
        const leafAt = pos => pos < length ? symbols[pos] : []

        /**
         * A round is forced while fewer than `min` have matched, and optional
         * until `max`: one more starts exactly when the lookahead is in the
         * item's first set. An optional round therefore consumes at least
         * one symbol, so an unbounded repetition always terminates; a forced
         * one may match empty, which is how `times(3)([])` matches empty
         * three times.
         *
         * @type {(frame: _RepeatFrame, pos: number) => _Visit}
         */
        const round = (frame, pos) => {
            const { name, min, max, item, rounds, count } = frame
            return [pos, count < min || (count < max && starts(item)(pos))
                ? ['push', frame, item]
                : ok(emit(name, toArray(rounds)))]
        }

        /**
         * Enters the rule `name` at `pos`. A rule is entered before its first
         * symbol is consumed, so the lookahead only ever selects — a
         * variant's branch, a repetition's next round — and every invocation
         * builds a node of its own.
         *
         * @type {(pos: number, name: string) => _Visit}
         */
        const enter = (pos, name) => {
            /** @type {RuleVisitor<_Visit>} */
            const v = {
                set: s => accepts(s)(pos) ? [pos + 1, ok(emit(name, leafAt(pos)))] : [pos, error(pos)],
                sequence: items => [pos, items.length === 0
                    ? ok(emit(name, []))
                    : ['push', { kind: 'sequence', name, items, index: 0, done: [] }, items[0]]],
                // The branch the lookahead selects, else the one that
                // matches empty — the last such, as `emptyTagMap` in
                // `../data` names it.
                variant: branches => {
                    const all = definedEntries(branches)
                    const branch = all.find(([, item]) => starts(item)(pos))
                        ?? all.findLast(([, item]) => isNullable(item))
                    return [pos, branch === undefined
                        ? error(pos)
                        : ['push', { kind: 'variant', name, tag: branch[0] }, branch[1]]]
                },
                repeat: (min, max, item) =>
                    round({ kind: 'repeat', name, min, max, item, rounds: null, count: 0 }, pos),
            }
            return matchRule(v)(ruleSet[name])
        }

        /**
         * Hands a matched node to the innermost frame: the next item of a
         * sequence, the variant's node tagged, or the next round.
         *
         * @type {(pos: number, top: _Frame, ast: unknown) => _Visit}
         */
        const resume = (pos, top, ast) => {
            switch (top.kind) {
                case 'sequence': {
                    const done = [...top.done, ast]
                    const index = top.index + 1
                    return [pos, index < top.items.length
                        ? ['push', { ...top, index, done }, top.items[index]]
                        : ok(emit(top.name, done))]
                }
                case 'variant': { return [pos, ok(emit(top.name, [top.tag, ast]))] }
                // `'repeat'`, the one kind left: every frame is built above
                default: {
                    return round({ ...top, rounds: concat(top.rounds)([ast]), count: top.count + 1 }, pos)
                }
            }
        }

        /**
         * The public index of a cursor: consuming the end of input moves the
         * cursor past the physical end, and both report the length.
         *
         * @type {(pos: number) => number}
         */
        const physical = pos => minNumber(pos, length)

        const result = walkFold({ enter, resume })(start)(entry)
        // LL(1) committed to every choice on the way to an error, so there
        // is nothing to rewind and retry: the first failure is the match's.
        return result[0] === 'error'
            ? error(physical(result[1]))
            : ok([result[1][1], physical(result[1][0])])
    }
}

/**
 * A parser for a rule set at its entry. The set is validated as `../data`
 * validates it, then the rules the entry reaches are analysed as
 * {@link firstMap} analyses a set, and their follow sets beside, so a set
 * that is no grammar and a grammar that is not LL(1) — left recursion, a
 * first/first conflict, a first/follow conflict — are all refused here,
 * before any input, naming the rule; a rule the entry does not reach is
 * dead, not wrong, and is left alone. The tree it builds is the one
 * `Ast<R, I>` gives the rule the set was lowered from — the input symbol
 * for a set, an empty node for EOF, an array for a sequence, `[tag, node]`
 * for a variant, and one flat array for a repetition whatever its bounds.
 * Nothing is mapped: a hand-written set holds no rule an author can key a
 * mapping by.
 *
 * @type {(ruleSet: RuleSet, entry: string) => Parser<unknown, unknown>}
 */
export const parserRuleSet = (ruleSet, entry) => {
    validate(ruleSet, entry)
    return build(ruleSet, emptyTagMap(ruleSet), entry, noMappers)
}

/**
 * A parser for a front-end rule, folding a rewrite set: the rule lowered by
 * `toData` in `../data` and matched by {@link parserRuleSet}, with each
 * mapped rule's node replaced by what its mapping returns as the node is
 * built. The set is keyed by rule identity, as the lowering shares rules —
 * the mapping applies to the rule the author holds, and to a look-alike
 * spelled elsewhere not at all — and refused before any input where it
 * names a rule the grammar does not hold or names one twice. The empty set
 * is the identity, by definition: `Ast<R, I>` is `Ast<R, I, never>`.
 *
 * @template {Rule} const R
 * @template [I=unknown]
 * @template [O=never]
 * @param {R} rule
 * @param {RewriteSet<I, O>} [set]
 * @returns {Parser<Ast<R, I, O>, I>}
 */
export const parser = (rule, set = []) => {
    const [ruleSet, entry, names] = toData(rule)
    return /** @type {Parser<any, any>} */ (build(ruleSet, emptyTagMap(ruleSet), entry, mappersOf(names)(set)))
}

/**
 * A mapping of the rule the author holds: the function is applied to what
 * the rule matches, the rules under it already mapped, and returns one
 * symbol — a `Meta<O>` — that stands in the node's place. Its value goes in
 * `meta`, its kind in `symbol`: a symbol of the next grammar, or of this
 * one. A mapping reports no errors: it is a transformation from one alphabet
 * to another, and what can fail belongs to the layer above.
 *
 * Bind it once per layer, annotated with the layer's metadata types, and
 * every mapping's function is typed from its rule under them:
 *
 * ```js
 * const tok = mapping   // annotated `Mappings<Cp, Tok>`
 * const set = [tok(digit, d => …), tok(digits, ds => …)]
 * ```
 *
 * Called unbound, it types nothing: `I` has no candidate and `O` is fixed
 * before the function's return is seen, so the mapping is one over
 * `unknown` metadata rather than a refusal.
 *
 * @template {Rule} const R
 * @template I
 * @template O
 * @param {R} rule
 * @param {(children: Children<R, I, O>) => Meta<O>} f
 * @returns {Mapping<I, O>}
 */
export const mapping = (rule, f) => /** @type {const} */ ([rule, f])
