/**
 * A grammar's rules as syntax diagrams: the lowered {@link RuleSet} read back
 * as the railroad a reader of a language specification expects, one diagram
 * per rule an author chose to name. Drawing is
 * [`fjs/website/demo/railroad`](../../website/demo/railroad/module.f.mjs)'s;
 * this module decides what is drawn.
 *
 * **A caller names the rules that get diagrams.** Lowering names every rule,
 * but the names it makes up — `value.array.2.item` — are positions, not
 * words a reader would look for. So a caller pairs the rules worth a
 * diagram with the words for them, and every reference to one of those is
 * a box that links to its diagram. Every other rule is drawn in place,
 * inside the diagram that reaches it.
 *
 * **Recursion is a box like any other reference.** A rule that reaches
 * itself does so through a titled rule, drawn as a box, so no diagram is
 * infinite. A cycle that runs through untitled rules only has nowhere to
 * stop, and is refused, naming the rule: there is no word for the box it
 * would need.
 *
 * **Lowering's scaffolding is read back as the shapes it spells.** A
 * repeat is an optional piece, a loop, or copies of its item, as its bounds
 * say. A sequence of single printable symbols is the one terminal a string
 * lowered to. An item followed by a repeat of `separator, item` — what
 * `join` builds — is one loop, returning through the separator, and an item
 * followed by a repeat of itself is a loop with nothing between the copies.
 *
 * @module
 *
 * @import { RuleSet } from '../data/types.ts'
 * @import { Diagram } from '../../website/demo/railroad/types.ts'
 * @import { RangeSet } from '../../types/range_set/types.ts'
 */

import { matchRule } from '../data/module.f.mjs'
import { at, definedValues } from '../../types/object/module.f.mjs'
import { assert, assertNotNullish } from '../../asserts/module.f.mjs'

/** @type {Diagram} */
const skip = ['skip']

/** @type {(text: string) => Diagram} */
const terminal = text => ['terminal', text]

/**
 * `items` one after another; one piece is itself, and none is plain track.
 *
 * @type {(items: readonly Diagram[]) => Diagram}
 */
const sequence = items => items.length === 0 ? skip : items.length === 1 ? items[0] : ['sequence', items]

/** @type {(d: Diagram) => readonly Diagram[]} */
const rowsOf = d => d[0] === 'choice' ? d[1] : [d]

/**
 * One of `first` and `rest`; a choice of one is that one, and a choice
 * among choices is one choice among all their rows, since the rows of one
 * column read as the same thing as the rows of two nested ones.
 *
 * @type {(first: Diagram, rest: readonly Diagram[]) => Diagram}
 */
const choice = (first, rest) => {
    const [head, ...tail] = [first, ...rest].flatMap(rowsOf)
    return tail.length === 0 ? head : ['choice', [head, ...tail]]
}

/** @type {(d: Diagram) => Diagram} */
const optional = d => choice(skip, [d])

/** @type {(n: number, d: Diagram) => readonly Diagram[]} */
const copies = (n, d) => Array.from({ length: n }, () => d)

/**
 * The symbols a reader cannot see spelled by name; the rest of the control
 * and non-ASCII symbols as code points.
 */
const named = { 9: '\\t', 10: '\\n', 13: '\\r', 32: 'space' }

/**
 * A code point as a label. A symbol above the last code point belongs to
 * another alphabet — a token symbol starts at `0x110000` — and is refused
 * rather than labelled `U+110005`, a code point it is not; see
 * `./todo/symbol-labels.md`.
 *
 * @type {(c: number) => string}
 */
const symbolText = c => {
    assert(c <= 0x10FFFF, ['not a code point', c])
    return at(String(c))(named)
        ?? (c < 0x20 || c > 0x7e ? `U+${c.toString(16).toUpperCase().padStart(4, '0')}` : String.fromCodePoint(c))
}

/**
 * A set's runs, `[first, last]` each, both inclusive. A set whose last
 * boundary is unpaired runs to the top of the alphabet, and its last run
 * has no `last`.
 *
 * @type {(s: RangeSet) => readonly (readonly [number, number | null])[]}
 */
const runs = s => s.flatMap((b, i) => i % 2 === 1 ? [] : [[b, i + 1 === s.length ? null : s[i + 1] - 1]])

/**
 * A run of up to three symbols is those symbols, which read better one by
 * one than as a range: `\t`, `\n` rather than `\t … \n`.
 *
 * @type {(run: readonly [number, number | null]) => readonly string[]}
 */
const runText = ([first, last]) =>
    last === null ? [`${symbolText(first)} …`]
    : last - first < 3 ? Array.from({ length: last - first + 1 }, (_, i) => symbolText(first + i))
    : [`${symbolText(first)} … ${symbolText(last)}`]

/**
 * A terminal set as the choice of its symbols and ranges. EOF, the one set
 * with a negative boundary, is `EOF`.
 *
 * @type {(s: RangeSet) => Diagram}
 */
const setDiagram = s => {
    const [head, ...tail] = s[0] < 0 ? ['EOF'] : runs(s).flatMap(runText)
    return choice(terminal(head), tail.map(terminal))
}

/**
 * The diagram of each rule in `titled`, under its title, in the order given.
 *
 * `titled` pairs the word a diagram is known by with the name of the rule it
 * draws. A reference to a titled rule is a `nonTerminal` box with that word;
 * every other rule is drawn in place, inside the diagram that reaches it.
 *
 * @throws If a rule is titled twice, which would leave its boxes a choice
 * of two diagrams to link to; if two rules share a title, which would give
 * two diagrams one link; or if a rule reaches itself through untitled rules
 * only.
 *
 * @type {(ruleSet: RuleSet) => (titled: readonly (readonly [string, string])[]) => readonly (readonly [string, Diagram])[]}
 */
export const toDiagrams = ruleSet => titled => {
    const titles = new Map(titled.map(([title, name]) => [name, title]))
    assert(titles.size === titled.length, ['a rule is titled twice', titled])
    assert(new Set(titles.values()).size === titled.length, ['a title names two rules', titled])
    /**
     * The printable symbol a rule is, if it is a set of exactly one: one
     * run, so two boundaries, one symbol apart. A set of more runs is not
     * its first run, and is drawn as the choice it is. A titled set is a
     * reference, drawn as its box, never folded into a literal.
     *
     * @type {(name: string) => string | null}
     */
    const printable = name => {
        const rule = ruleSet[name]
        const [tag, first, end] = rule
        return !titles.has(name) && tag === 'set' && rule.length === 3 && end === first + 1 && first > 0x20 && first < 0x7f
            ? String.fromCodePoint(first)
            : null
    }
    /**
     * What `b` separates copies of `a` with, if `b` is a repeat of `a`, or
     * of `separator, a`, that may run any number of times. A titled repeat,
     * or a titled `separator, a`, is a reference to its own diagram, so it
     * is drawn as its box rather than folded into a loop.
     *
     * @type {(path: ReadonlySet<string>) => (a: string, b: string) => Diagram | null}
     */
    const separatorOf = path => (a, b) => {
        const r = ruleSet[b]
        if (titles.has(b) || r[0] !== 'repeat' || r[1] !== 0 || r[2] !== Infinity) { return null }
        const item = r[3]
        if (item === a) { return skip }
        if (titles.has(item)) { return null }
        const [tag, separator, again] = ruleSet[item]
        return tag === 'sequence' && again === a && ruleSet[item].length === 3 ? ref(path)(separator) : null
    }
    /**
     * A sequence's items, each pair that spells a loop read as that loop.
     *
     * @type {(path: ReadonlySet<string>) => (items: readonly string[]) => readonly Diagram[]}
     */
    const items = path => names => {
        if (names.length === 0) { return [] }
        const [a, b, ...rest] = names
        const separator = b === undefined ? null : separatorOf(path)(a, b)
        return separator === null
            ? [ref(path)(a), ...items(path)(names.slice(1))]
            : [['loop', ref(path)(a), separator], ...items(path)(rest)]
    }
    /**
     * The rule `name`, drawn in place.
     *
     * @type {(path: ReadonlySet<string>) => (name: string) => Diagram}
     */
    const expand = path => name => {
        assert(!path.has(name), ['a rule reaches itself through untitled rules only', name])
        const inner = new Set([...path, name])
        return matchRule({
            set: setDiagram,
            sequence: names => {
                const text = names.map(printable)
                return names.length !== 0 && text.every(c => c !== null)
                    ? terminal(text.join(''))
                    : sequence(items(inner)(names))
            },
            variant: branches => {
                const [first, ...rest] = definedValues(branches).map(ref(inner))
                return choice(assertNotNullish(first), rest)
            },
            repeat: (min, max, item) => {
                const d = ref(inner)(item)
                return max === Infinity
                    ? min === 0 ? optional(['loop', d, skip]) : sequence([...copies(min - 1, d), ['loop', d, skip]])
                    : sequence([...copies(min, d), ...copies(max - min, optional(d))])
            },
        })(ruleSet[name])
    }
    /**
     * A reference to the rule `name`: a box if it is titled, else the rule
     * itself.
     *
     * @type {(path: ReadonlySet<string>) => (name: string) => Diagram}
     */
    const ref = path => name => {
        const title = titles.get(name)
        return title === undefined ? expand(path)(name) : ['nonTerminal', title]
    }
    return titled.map(([title, name]) => [title, expand(new Set())(name)])
}

/**
 * The rule a variant reaches by `tag`: how a caller finds a rule the
 * grammar writes inline, as a branch, to give it a title.
 *
 * @throws If the rule named `name` is not a variant, or has no `tag`.
 *
 * @type {(ruleSet: RuleSet) => (name: string, tag: string) => string}
 */
export const branch = ruleSet => (name, tag) => {
    const [kind, branches] = ruleSet[name]
    assert(kind === 'variant', ['not a variant', name])
    return assertNotNullish(at(tag)(branches), ['no such branch', name, tag])
}
