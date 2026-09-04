/**
 * The serializable EBNF grammar: the intermediate representation (IR) every
 * backend consumes, the lowering from the front end in `../module.f.mjs`
 * into it, and the checks a grammar passes on the way.
 *
 * Every rule is a tagged tuple, and {@link matchRule} is the one place the
 * tag is read: {@link emptyTagMap}, {@link validate} and every backend
 * dispatch through it. {@link toData} lowers a front-end rule, naming every
 * rule it meets and returning the identity map a transformer keys on. See
 * `./README.md` for the design and `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Entry } from '../../types/object/types.ts'
 * @import { RangeSet } from '../../types/range_set/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { DataRule, Rule as FRule, Thunk } from '../types.ts'
 * @import { EmptyTag, EmptyTagMap, GrammarData, Rule, RuleNameMap, RuleSet, RuleVisitor, Sequence, Terminal, Variant } from './types.ts'
 * @import { _Lowered, _State } from './private.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { errorMask } from '../../text/code_point/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { at, definedEntries, isObject, structurallySame } from '../../types/object/module.f.mjs'
import { intersection, isRangeSet, rangeSet } from '../../types/range_set/module.f.mjs'
import { contains, empty as noStrings, set as stringSetAdd } from '../../types/string_set/module.f.mjs'

const { isSafeInteger, MAX_SAFE_INTEGER } = Number
const { entries, fromEntries, keys, getPrototypeOf } = Object

/**
 * A plain record — an object literal's shape — and nothing else that is an
 * object: a `Map` has no own string-keyed entries, so read as a variant it
 * would be an empty one. One realm, one prototype chain, so the prototype
 * is a reliable test. Not a type predicate: both call sites hold a value the
 * type system has already narrowed, and only ask whether to refuse it.
 *
 * @type {(v: unknown) => boolean}
 */
const isRecord = v => isObject(v) && getPrototypeOf(v) === Object.prototype

/**
 * The one discriminator over the data {@link Rule}: each handler receives the
 * rule's payload without its tag.
 *
 * A hand-written or deserialized set is data, so the carrier is checked
 * here, where the tag is read: a tag nothing spells, a fixed-arity tuple
 * with a field past its arity, or a variant whose branches are no object,
 * is refused rather than dispatched with part of it dropped. What the
 * payload holds — boundaries, bounds, names — is `validate`'s.
 *
 * @type {<R>(v: RuleVisitor<R>) => (rule: Rule) => R}
 */
export const matchRule = v => rule => {
    switch (rule[0]) {
        case 'set': {
            const [, ...s] = rule
            return v.set(s)
        }
        case 'sequence': {
            const [, ...items] = rule
            return v.sequence(items)
        }
        case 'variant': {
            const [, branches] = rule
            assert(rule.length === 2 && isRecord(branches), ['not a variant', rule])
            return v.variant(branches)
        }
        case 'repeat': {
            const [, min, max, item] = rule
            assert(rule.length === 4, ['not a repeat', rule])
            return v.repeat(min, max, item)
        }
        default: { throw ['not a rule', rule] }
    }
}

/**
 * Whether the rule named `item` is nullable in `map` — an own entry only: a
 * rule may be named `constructor`, and `{}` inherits one.
 *
 * @type {(map: EmptyTagMap) => (item: string) => boolean}
 */
const nullable = map => item => at(item)(map) !== null

/**
 * The nullability of one rule, given that of the rules it names.
 *
 * @type {(nullable: (item: string) => boolean) => RuleVisitor<EmptyTag>}
 */
const emptyTagVisitor = nullable => ({
    set: () => undefined,
    sequence: items => items.every(nullable) ? true : undefined,
    // A variant's tag is its last nullable branch's, the one a dispatch
    // miss selects.
    variant: branches => definedEntries(branches)
        .filter(([, item]) => nullable(item))
        .at(-1)
        ?.[0],
    // A repetition is a sequence of items, not a choice, so it carries no
    // tag of its own; zero rounds match whatever the item does.
    repeat: (min, _max, item) => min === 0 || nullable(item) ? true : undefined,
})

/** @type {(map: EmptyTagMap) => (rule: Rule) => EmptyTag} */
const emptyTagOf = map => matchRule(emptyTagVisitor(nullable(map)))

/** @type {(ruleSet: RuleSet) => (map: EmptyTagMap) => EmptyTagMap} */
const emptyTagStep = ruleSet => map => {
    const of = emptyTagOf(map)
    return fromEntries(entries(ruleSet).map(([name, rule]) => [name, of(rule)]))
}

/**
 * Relaxes `map` one round at a time until a round changes no rule.
 *
 * @type {(step: (map: EmptyTagMap) => EmptyTagMap, names: readonly string[]) => (map: EmptyTagMap) => EmptyTagMap}
 */
const fixpoint = (step, names) => map => {
    const next = step(map)
    return names.every(name => at(name)(next) === at(name)(map)) ? next : fixpoint(step, names)(next)
}

/**
 * Computes, for every rule in the set, whether it can match empty input, by
 * the standard nullable-set fixpoint: a sequence is nullable iff all of its
 * items are, a variant iff at least one branch is (its tag is that
 * branch's), a repeat iff its `min` is `0` or its item is nullable, and a
 * set never. Rules may reference each other cyclically, so this starts every
 * rule as non-nullable and relaxes every rule, one round at a time, until a
 * full round changes nothing. A round only ever grows the nullable set or
 * moves a variant's tag to a later nullable branch, both bounded, so this
 * always terminates.
 *
 * @type {(ruleSet: RuleSet) => EmptyTagMap}
 */
export const emptyTagMap = ruleSet => fixpoint(emptyTagStep(ruleSet), keys(ruleSet))({})

/** EOF, the one set with a negative boundary. */
const eofSet = /** @type {const} */ ([-1, 0])

/** @type {Terminal} */
const eof = ['set', ...eofSet]

/** The symbol domain: every ordinary symbol, open above. */
const domain = rangeSet([0])

/**
 * A non-negative safe integer, spelled the one way: `-0` is refused, since a
 * boundary or a bound written as `-0` is not canonical, and `range_set`
 * refuses the boundary for the same reason.
 *
 * @type {(n: number) => boolean}
 */
const isSymbol = n => isSafeInteger(n) && n >= 0 && !Object.is(n, -0)

/**
 * A reference is a string naming a rule of the set. The type is checked
 * because data is untyped: a number would reach the same rule through
 * property-key coercion, and an explicit `undefined` under a variant's tag
 * would be a branch the type calls absent, each certifying a value that is
 * no `Rule`.
 *
 * @type {(ruleSet: RuleSet) => (name: string) => (item: unknown) => void}
 */
const defined = ruleSet => name => item =>
    assert(typeof item === 'string' && at(item)(ruleSet) !== null, ['unknown rule', name, item])

/**
 * The checks on one rule, given the name it has, the reference check of its
 * set, and whether a name is nullable there.
 *
 * @type {(name: string, ref: (item: unknown) => void, nullable: (item: string) => boolean) => RuleVisitor<void>}
 */
const validateVisitor = (name, ref, nullable) => ({
    set: s => {
        assert(isRangeSet(s) && s.length !== 0, ['not a set of symbols', name, s])
        assert(s.every(isSafeInteger), ['a boundary is not a safe integer', name, s])
        assert(s[0] >= 0 || structurallySame(s, eofSet), ['a set holds ordinary symbols only, or is EOF', name, s])
    },
    sequence: items => items.forEach(ref),
    // Every own entry, so a tag written with no rule under it is refused
    // rather than read as absent.
    variant: branches => entries(branches).forEach(([, item]) => ref(item)),
    repeat: (min, max, item) => {
        assert(isSymbol(min), ['min is not a non-negative integer', name, min])
        assert((isSafeInteger(max) || max === Infinity) && min <= max, ['max is not an integer at or above min, or Infinity', name, max])
        ref(item)
        assert(max !== Infinity || !nullable(item), ['a nullable item under an unbounded repeat', name, item])
    },
})

/** @type {(ruleSet: RuleSet, empty: EmptyTagMap) => (name: string) => (rule: Rule) => void} */
const validateRule = (ruleSet, empty) => name =>
    matchRule(validateVisitor(name, defined(ruleSet)(name), nullable(empty)))

/**
 * Refuses a rule set that is not a grammar, naming the rule: a reference to a
 * name the set does not define, the entry included; a terminal that is not a
 * canonical, non-empty set of safe-integer symbols, or that mixes EOF with
 * ordinary symbols; repeat bounds outside their domain; and a nullable item
 * under an unbounded repeat, which would repeat forever. Left recursion and
 * dispatch conflicts are a backend's to report, since another backend may
 * accept them.
 *
 * @type {(ruleSet: RuleSet, entry: string) => void}
 */
export const validate = (ruleSet, entry) => {
    // The set is data too: an array would answer `at('0')` with its first
    // element and walk under `entries`, so the carrier is checked first.
    assert(isRecord(ruleSet), ['not a rule set', ruleSet])
    defined(ruleSet)(entry)(entry)
    const rule = validateRule(ruleSet, emptyTagMap(ruleSet))
    entries(ruleSet).forEach(([name, r]) => rule(name)(r))
}

//

/** @type {(taken: StringSet, hint: string) => (i: number) => string} */
const freshFrom = (taken, hint) => i => {
    const candidate = i === 0 ? hint : `${hint}${i}`
    return contains(candidate)(taken) ? freshFrom(taken, hint)(i + 1) : candidate
}

/**
 * The hint itself when no rule has it yet, else the hint with a counter.
 *
 * @type {(taken: StringSet) => (hint: string) => string}
 */
const freshName = taken => hint => freshFrom(taken, hint)(0)

/**
 * The name hint of a rule reached from `parent` at `key`: an element index,
 * a branch tag, or `item` under a repeat.
 *
 * @type {(parent: string, key: string) => string}
 */
const childHint = (parent, key) => parent === '' ? key : `${parent}.${key}`

/** @type {(state: _State, name: string, fr: FRule) => _State} */
const register = ({ names, taken, ruleSet }, name, fr) => ({
    names: new Map([...names, [fr, name]]),
    taken: stringSetAdd(name)(taken),
    ruleSet,
})

/** @type {(state: _State, name: string, rule: Rule) => _State} */
const emit = ({ names, taken, ruleSet }, name, rule) =>
    ({ names, taken, ruleSet: { ...ruleSet, [name]: rule } })

/**
 * One symbol, and the top ordinary symbol is the open tail; EOF is `null`,
 * not a number, so `-1` is refused like any negative.
 *
 * @type {(n: number) => Terminal}
 */
const symbolTerminal = n => {
    assert(isSymbol(n), ['not a symbol', n])
    return n === MAX_SAFE_INTEGER ? ['set', n] : ['set', n, n + 1]
}

/**
 * The code points of a string rule, one symbol each; malformed UTF-16 is
 * refused rather than encoded as a symbol outside the domain.
 *
 * @type {(s: string) => readonly number[]}
 */
const codePoints = s => {
    const list = toArray(stringToCodePointList(s))
    assert(list.every(c => (c & errorMask) === 0), ['malformed UTF-16', s])
    return list
}

/** @type {(parent: string) => (acc: _Lowered<readonly Entry<string>[]>, child: Entry<FRule>) => _Lowered<readonly Entry<string>[]>} */
const lowerChild = parent => ([state, done], [key, child]) => {
    const [next, name] = lower(state, childHint(parent, key), child)
    return [next, [...done, [key, name]]]
}

/** @type {(state: _State, parent: string, children: readonly Entry<FRule>[]) => _Lowered<readonly Entry<string>[]>} */
const lowerChildren = (state, parent, children) => {
    /** @type {_Lowered<readonly Entry<string>[]>} */
    const init = [state, []]
    return children.reduce(lowerChild(parent), init)
}

/**
 * The list is spread first because `Array#map` skips the holes of a sparse
 * array: `[, 'x']` would lower as a one-element sequence. Spreading makes
 * each hole the `undefined` it is, which is no rule and is refused as one.
 *
 * @type {(state: _State, name: string, items: readonly FRule[]) => _Lowered<Sequence>}
 */
const lowerSequence = (state, name, items) => {
    const [next, named] = lowerChildren(state, name, [...items].map((item, i) => [`${i}`, item]))
    return [next, ['sequence', ...named.map(([, n]) => n)]]
}

/**
 * Every entry of a front-end variant is a branch: the front end types each
 * key as a rule, so a branch that is explicitly `undefined` is no rule and
 * reaches `lowerBody`'s refusal rather than being dropped, which would
 * lower a different grammar than the one written.
 *
 * @type {(state: _State, name: string, branches: import('../types.ts').Variant) => _Lowered<Variant>}
 */
const lowerVariant = (state, name, branches) => {
    const [next, named] = lowerChildren(state, name, entries(branches))
    return [next, ['variant', fromEntries(named)]]
}

/**
 * The data rule a name stands for: `null` is EOF, a number one symbol, a
 * string one symbol per code point in sequence, an array a sequence, an
 * object a variant.
 *
 * @type {(state: _State, name: string, dr: DataRule) => _Lowered<Rule>}
 */
const lowerBody = (state, name, dr) => {
    switch (typeof dr) {
        case 'number': { return [state, symbolTerminal(dr)] }
        case 'string': { return lowerSequence(state, name, codePoints(dr)) }
        case 'object': {
            if (dr === null) { return [state, eof] }
            if (dr instanceof Array) { return lowerSequence(state, name, dr) }
            assert(isRecord(dr), ['not a rule', dr])
            return lowerVariant(state, name, dr)
        }
        default: { throw ['not a rule', dr] }
    }
}

/** @type {(state: _State, hint: string, dr: DataRule) => _Lowered<string>} */
const lowerData = (state, hint, dr) => {
    const name = freshName(state.taken)(hint)
    const [next, rule] = lowerBody(register(state, name, dr), name, dr)
    return [emit(next, name, rule), name]
}

/**
 * A thunk is named before its info is read, so a rule that names itself
 * finds itself. A `const` thunk *is* the rule its body spells, under the
 * thunk's name; a `set` is clipped to the domain, which drops a generic
 * complement's `-Infinity` and anything below `0`; a `repeat` lowers its
 * item under its own name.
 *
 * A hand-written info tuple is data too, and a field past a fixed arity is
 * refused here rather than dropped: the data form's own arity check never
 * sees the front-end tuple, only what this emitted from it.
 *
 * @type {(state: _State, hint: string, fr: Thunk) => _Lowered<string>}
 */
const lowerThunk = (state, hint, fr) => {
    const name = freshName(state.taken)(fr.name === '' ? hint : fr.name)
    const registered = register(state, name, fr)
    const info = fr()
    // An info is a tuple; an object spelling one — `{ 0: 'const', 1: c,
    // length: 2 }` — would pass every field read below and is refused first.
    assert(info instanceof Array, ['not a rule', name, info])
    switch (info[0]) {
        case 'const': {
            assert(info.length === 2, ['not a const', name, info])
            const [next, rule] = lowerBody(registered, name, info[1])
            return [emit(next, name, rule), name]
        }
        case 'set': {
            const [, ...s] = info
            return [emit(registered, name, ['set', ...intersection(domain)(rangeSet(s))]), name]
        }
        case 'repeat': {
            const [, min, max, r] = info
            assert(info.length === 4, ['not a repeat', name, info])
            const [next, item] = lower(registered, childHint(name, 'item'), r)
            return [emit(next, name, ['repeat', min, max, item]), name]
        }
        default: { throw ['not a rule', name, info] }
    }
}

/**
 * The name of `fr`, lowering it first when it has not been met: sharing is
 * by `===`, so a thunk, an array or an object met twice is one named rule,
 * and a number or a string met twice is one rule by value.
 *
 * @type {(state: _State, hint: string, fr: FRule) => _Lowered<string>}
 */
const lower = (state, hint, fr) => {
    // The memo's `Map` keys by SameValueZero, so `-0` would find `0`'s rule
    // and inherit it; it is refused before the lookup, as it is everywhere.
    assert(!Object.is(fr, -0), ['not a symbol', fr])
    const known = state.names.get(fr)
    if (known !== undefined) { return [state, known] }
    return typeof fr === 'function' ? lowerThunk(state, hint, fr) : lowerData(state, hint, fr)
}

/** @type {RuleNameMap} */
const noNames = new Map()

/** @type {_State} */
const initial = { names: noNames, taken: noStrings, ruleSet: {} }

/**
 * Lowers a front-end rule into a rule set, validated, with its entry and the
 * map from every rule identity met to its name.
 *
 * A rule is named by its thunk's `.name` where it has one, and otherwise by
 * the rule it was reached from and the position it was reached at —
 * `value.array`, `json.0` — with a counter where a name is taken. Only the
 * returned entry is part of the contract; a consumer matches by it, never by
 * a name read off the set. Every rule emitted is reachable from the entry,
 * since the walk from the entry is the emission.
 *
 * @type {(fr: FRule) => GrammarData}
 */
export const toData = fr => {
    const [{ names, ruleSet }, entry] = lower(initial, '', fr)
    validate(ruleSet, entry)
    return [ruleSet, entry, names]
}
