/**
 * The code IR as text, the way a review reads it: a function per paragraph,
 * a `let`, a `block`, a `loop` and a `match` over lines of their own, and
 * every other term on one line where its parts fit there. An `if_` whose parts fit is
 * on one line too, and an `else` that is an `if_` continues it. A product is
 * its fields in braces, `{ i: 0.0, value: 0.0 }`, and a field of one reads
 * `r.value`.
 *
 * ```text
 * fn max(a: f64, b: f64) -> f64 =
 *     if lt(a, b) then b else a
 * ```
 *
 * An interface that the module imports comes first, as its binding, its
 * sealed types and its functions' signatures:
 *
 * ```text
 * import String from fjs:l0
 *     fn length(s: any.only(string)) -> u(31)
 * ```
 *
 * A parameter that the callee owns reads `own v: any`, and a counted sealed
 * type names its counting functions after its tag's:
 * `kind: kind, carrier: i64, dup: dup, drop: drop`.
 *
 * The text is for people and for golden proofs. Nothing reads it back: the
 * IR passes from one stage to the next as data.
 *
 * @module
 *
 * @import { ArmOf, Fn, Int, Interface, Module, Parts, Sealed, Signature, Term, Type } from '../types.ts'
 */

import { bool, equal, never, unit } from '../module.f.js'

// types

/** `u(n)` and `i(n)` where a range is one of them, else `int(lo, hi)`. @type {(t: Int) => string} */
const showInt = ([, lo, hi]) => {
    const next = hi + 1n
    // `next` is a power of two
    const power = hi >= 0n && (next & hi) === 0n
    const width = next.toString(2).length
    return power && lo === 0n && hi > 0n ? `u(${width - 1})`
        : power && lo === -next ? `i(${width})`
        : `int(${lo}, ${hi})`
}

/** @type {(show: (t: Type) => string, parts: Parts) => string} */
const showParts = (show, parts) => parts.map(([name, t]) => `${name}: ${show(t)}`).join(', ')

/** A sealed type by its name, and the variants it keeps where it keeps some: `any`, `any.only(number)`. @type {(t: Sealed) => string} */
const showSealed = ([, , name, only]) => only === null ? name : `${name}.only(${only.join(', ')})`

/**
 * A type as text: `unit`, `never` and `bool` by their names, a product as
 * its fields in braces, a sealed type as its interface names it, and any
 * other sum as `sum({ … })`.
 *
 * @type {(t: Type) => string}
 */
export const show = t => {
    switch (t[0]) {
        case 'int': { return showInt(t) }
        case 'f64': case 'f64c': { return t[0] }
        case 'product': { return equal(t, unit) ? 'unit' : `{ ${showParts(show, t[1])} }` }
        case 'sealed': { return showSealed(t) }
        default: { return equal(t, never) ? 'never' : equal(t, bool) ? 'bool' : `sum({ ${showParts(show, t[1])} })` }
    }
}

// terms

/** A float as a float: `1.0`, `-0.0`, `NaN`. @type {(v: number) => string} */
const showFloat = v => {
    const text = Object.is(v, -0) ? '-0' : `${v}`
    return [...text].every(c => c === '-' || (c >= '0' && c <= '9')) ? `${text}.0` : text
}

/**
 * A literal: an integer of the range that holds it alone, and a float of
 * `f64c`, as their values; any other with its type.
 *
 * @type {(type: Type, value: bigint | number) => string}
 */
const showLit = (type, value) => {
    const text = typeof value === 'bigint' ? `${value}` : showFloat(value)
    const plain = type[0] === 'int' ? type[1] === value && type[2] === value : type[0] === 'f64c'
    return plain ? text : `${text} as ${show(type)}`
}

/** @type {(module: string, name: string) => string} */
const callee = (module, name) => module === 'self' ? name : `${module}.${name}`

/** @type {(label: string) => string} */
const transfer = label => label === 'return' ? 'return' : `br ${label}`

/** Whether a `match` is an `if_`: its arms are `true`, then `false`, and name nothing. @type {(arms: readonly ArmOf<Term>[]) => boolean} */
const isIf = arms => equal(arms.map(([variants, binder]) => [variants, binder]), [[['true'], null], [['false'], null]])

/** A trap's reason, quoted: `trap('not number')`. @type {(reason: string) => string} */
const showTrap = reason => {
    const quoted = [...reason].map(c => c === "'" || c === '\\' ? `\\${c}` : c).join('')
    return `trap('${quoted}')`
}

/** The range that `trunc_sat` saturates to, as the first of its parts, and nothing for any other operator. @type {(t: Int | undefined) => readonly string[]} */
const target = t => t === undefined ? [] : [show(t)]

/**
 * A term on one line, or `null` where a part of it needs lines of its own:
 * a `let`, a `block`, a `loop`, a `match` other than an `if_`, and an
 * `if_` whose `then` is a `match`, since `if a then if b then c else d
 * else e` reads as nothing.
 *
 * @type {(t: Term) => string | null}
 */
const flat = t => {
    /** @type {(head: string, parts: readonly Term[], lead?: readonly string[]) => string | null} */
    const apply = (head, parts, lead = []) => {
        const texts = parts.map(flat)
        return texts.includes(null) ? null : `${head}(${[...lead, ...texts].join(', ')})`
    }
    switch (t[0]) {
        case 'lit': { return showLit(t[1], t[2]) }
        case 'get': { return t[1] }
        case 'op': { return apply(t[1], t[2], target(t[3])) }
        case 'call': { return apply(callee(t[1], t[2]), t[3]) }
        case 'make': {
            const texts = t[1].map(([k, x]) => [k, flat(x)])
            return texts.some(([, x]) => x === null) ? null
                : texts.length === 0 ? '{}'
                : `{ ${texts.map(([k, x]) => `${k}: ${x}`).join(', ')} }`
        }
        case 'field': {
            const [, e, name] = t
            const text = flat(e)
            return text === null ? null : e[0] === 'match' || e[0] === 'br' ? `(${text}).${name}` : `${text}.${name}`
        }
        case 'variant': { return equal(t[3], ['make', []]) ? t[2] : apply(t[2], [t[3]]) }
        case 'match': {
            const [, e, arms] = t
            const texts = isIf(arms) && arms[0][2][0] !== 'match' ? [e, arms[0][2], arms[1][2]].map(flat) : [null]
            return texts.includes(null) ? null : `if ${texts[0]} then ${texts[1]} else ${texts[2]}`
        }
        case 'br': {
            const value = flat(t[2])
            return value === null ? null : `${transfer(t[1])} ${value}`
        }
        case 'trap': { return showTrap(t[1]) }
        default: { return null }
    }
}

/** A head, then a term: on the same line where it fits there, else on lines of their own below. @type {(lines: (t: Term, pad: string) => readonly string[], pad: string, head: string, x: Term) => readonly string[]} */
const headed = (lines, pad, head, x) => {
    const text = flat(x)
    return text === null ? [`${pad}${head}`, ...lines(x, `${pad}    `)] : [`${pad}${head} ${text}`]
}

/** Lines, with a comma after the last where more follows. @type {(ls: readonly string[], more: boolean) => readonly string[]} */
const comma = (ls, more) => more ? [...ls.slice(0, -1), `${ls.at(-1)},`] : ls

/**
 * A loop's parameters, each with its type and its first value: on the line
 * of the label where every first value fits there, else a parameter to a
 * line, and a first value that needs lines below it.
 *
 * @type {(lines: (t: Term, pad: string) => readonly string[], pad: string, label: string, params: readonly (readonly [string, Type, Term])[]) => readonly string[]}
 */
const loopHead = (lines, pad, label, params) => {
    const heads = params.map(([k, x]) => `${k}: ${show(x)} =`)
    const firsts = params.map(([, , first]) => flat(first))
    return !firsts.includes(null) ? [`${pad}loop ${label} (${heads.map((h, j) => `${h} ${firsts[Number(j)]}`).join(', ')})`] : [
        `${pad}loop ${label} (`,
        ...params.flatMap(([, , first], j) => comma(headed(lines, `${pad}    `, heads[Number(j)], first), j < params.length - 1)),
        `${pad})`,
    ]
}

/** @type {(t: Term, pad: string) => readonly string[]} */
const lines = (t, pad) => {
    const inner = `${pad}    `
    /** @type {(head: string, x: Term) => readonly string[]} */
    const after = (head, x) => headed(lines, pad, head, x)
    /** An application on one line, or its parts on lines of their own, separated by commas. @type {(head: string, parts: readonly Term[], lead?: readonly string[]) => readonly string[]} */
    const apply = (head, parts, lead = []) => {
        const texts = parts.map(flat)
        return !texts.includes(null) ? [`${pad}${head}(${[...lead, ...texts].join(', ')})`] : [
            `${pad}${head}(`,
            ...lead.map(x => `${inner}${x},`),
            ...parts.flatMap((x, k) => comma(lines(x, inner), k < parts.length - 1)),
            `${pad})`,
        ]
    }
    switch (t[0]) {
        case 'lit': { return [`${pad}${showLit(t[1], t[2])}`] }
        case 'get': { return [`${pad}${t[1]}`] }
        case 'let': {
            const [, name, e, body] = t
            return [...after(`let ${name} =`, e), ...lines(body, pad)]
        }
        case 'op': { return apply(t[1], t[2], target(t[3])) }
        case 'call': { return apply(callee(t[1], t[2]), t[3]) }
        case 'make': {
            const one = flat(t)
            return one !== null ? [`${pad}${one}`] : [
                `${pad}{`,
                ...t[1].flatMap(([k, x], j) => comma(headed(lines, inner, `${k}:`, x), j < t[1].length - 1)),
                `${pad}}`,
            ]
        }
        case 'field': {
            const one = flat(t)
            return one !== null ? [`${pad}${one}`] : [`${pad}(`, ...lines(t[1], inner), `${pad}).${t[2]}`]
        }
        case 'variant': { return equal(t[3], ['make', []]) ? [`${pad}${t[2]}`] : apply(t[2], [t[3]]) }
        case 'match': {
            const [, e, arms] = t
            const one = flat(t)
            if (one !== null) { return [`${pad}${one}`] }
            if (isIf(arms)) {
                return [...after('if', e), `${pad}then`, ...lines(arms[0][2], inner), `${pad}else`, ...lines(arms[1][2], inner)]
            }
            return [...after('match', e), ...arms.flatMap(([variants, binder, body]) => [
                `${pad}  ${variants === null ? 'else' : variants.join(' | ')}${binder === null ? '' : ` as ${binder}`} =>`,
                ...lines(body, inner),
            ])]
        }
        case 'block': { return [`${pad}block ${t[1]}: ${show(t[2])}`, ...lines(t[3], inner)] }
        case 'loop': { return [...loopHead(lines, pad, t[1], t[2]), ...lines(t[3], inner)] }
        case 'br': { return after(transfer(t[1]), t[2]) }
        default: { return [`${pad}${showTrap(t[1])}`] }
    }
}

/** A signature after `fn` and its name. @type {(name: string, s: Signature) => string} */
const showSignature = (name, { params, result }) => `fn ${name}(${params.map(([k, t, mode]) => `${mode === 'own' ? 'own ' : ''}${k}: ${show(t)}`).join(', ')}) -> ${show(result)}`

/** A function as its signature and body. @type {(name: string, f: Fn) => readonly string[]} */
const showFn = (name, f) => [`${showSignature(name, f)} =`, ...lines(f.body, '    ')]

/** An interface as its binding, its sealed types and its functions' signatures. @type {(name: string, i: Interface) => readonly string[]} */
const showInterface = (name, { abi, types, functions }) => [
    `import ${name} from ${abi}`,
    ...types.flatMap(([type, { variants, kind, carrier, dup, drop }]) => [
        `    type ${type} = ${variants.join(' | ')}`,
        `        kind: ${kind}, carrier: ${carrier}${dup === undefined ? '' : `, dup: ${dup}`}${drop === undefined ? '' : `, drop: ${drop}`}`,
    ]),
    ...functions.map(([k, s]) => `    ${showSignature(k, s)}`),
]

/**
 * A module as text: the interfaces it imports, then its functions, in their
 * order, each after a blank line but the first, and its exports last.
 *
 * @type {(m: Module) => string}
 */
export const print = m => [
    ...[...m.imports.map(([name, i]) => showInterface(name, i)), ...m.functions.map(([name, f]) => showFn(name, f))]
        .flatMap((paragraph, k) => [...(k === 0 ? [] : ['']), ...paragraph]),
    ...(m.exports.length === 0 ? [] : ['', `export ${m.exports.join(', ')}`]),
].map(line => `${line}\n`).join('')
