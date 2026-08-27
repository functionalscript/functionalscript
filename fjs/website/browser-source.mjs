/**
 * Static reading of authored source text: whether a module exports `proof`,
 * and which modules a browser would have to link to load it.
 *
 * The manifest generator classifies modules without importing them — that is
 * the point of reading them as text — and TypeScript 7 exposes no compiler API,
 * so both questions are answered here by reading the source as tokens, with
 * their own proofs, rather than by patterns over lines: whether a declaration
 * fits on one line, and how it is spaced, are not part of the syntax.
 */

/**
 * The characters a name is spelled with. A name outside this set — a Unicode
 * identifier, a quoted export name — reads as punctuation and so never matches
 * `proof`, `from` or `import`, the only names looked for here.
 *
 * @type {(char: string) => boolean}
 */
const nameChar = char =>
    (char >= 'a' && char <= 'z')
    || (char >= 'A' && char <= 'Z')
    || (char >= '0' && char <= '9')
    || char === '_' || char === '$'

/** @type {(char: string) => boolean} */
const space = char => char === ' ' || char === '\t' || char === '\n' || char === '\r'

/** @typedef {{ readonly kind: 'name' | 'string' | 'punctuation', readonly text: string }} _Token */

/**
 * Separates tokens while they are collected. The scan is a single pass over a
 * whole file, so tokens accumulate as text rather than into a growing array;
 * authored source holds no U+0000 to be mistaken for the separator.
 */
const separator = '\u0000'

/**
 * The source as tokens: names, the text of string literals, and single
 * characters of punctuation. A comment produces nothing, so what is written in
 * one is never read as code. A template produces a backtick and nothing else —
 * it can hold an entire embedded module, and it is never a module specifier.
 *
 * An escape inside a string becomes a space: escapes belong to prose, and a
 * module specifier — the only string this module reads — has none.
 *
 * @type {(source: string) => readonly _Token[]}
 */
const read = source => {
    let out = ''
    let index = 0
    while (index < source.length) {
        const char = source[index] ?? ''
        const next = source[index + 1]
        if (char === '/' && next === '/') {
            while (index < source.length && source[index] !== '\n') { index += 1 }
            continue
        }
        if (char === '/' && next === '*') {
            index += 2
            while (index < source.length
                && !(source[index] === '*' && source[index + 1] === '/')) { index += 1 }
            index += 2
            continue
        }
        if (char === '\'' || char === '"' || char === '`') {
            index += 1
            let text = ''
            while (index < source.length && source[index] !== char) {
                if (source[index] === '\\') {
                    text += ' '
                    index += 2
                    continue
                }
                text += source[index]
                index += 1
            }
            index += 1
            out += char === '`' ? `${separator}p\`` : `${separator}s${text}`
            continue
        }
        if (nameChar(char)) {
            let text = ''
            while (nameChar(source[index] ?? '')) {
                text += source[index]
                index += 1
            }
            out += `${separator}n${text}`
            continue
        }
        if (!space(char)) { out += `${separator}p${char}` }
        index += 1
    }
    return out.split(separator).slice(1).map(token => ({
        kind: token[0] === 'n' ? 'name' : token[0] === 's' ? 'string' : 'punctuation',
        text: token.slice(1),
    }))
}

/**
 * The tokens as bare words, every string literal standing in as a quote: a
 * declaration is read by its names, and no string can pass for one.
 *
 * @type {(tokens: readonly _Token[]) => readonly string[]}
 */
const words = tokens => tokens.map(token => token.kind === 'string' ? '\'' : token.text)

/** The keywords that can introduce an `export <keyword> proof` declaration. */
const declarations = ['const', 'let', 'var', 'function', 'class']

/**
 * Where the declared name sits relative to its keyword. `function*` declares a
 * generator, so the name follows the star.
 *
 * @type {(list: readonly string[], at: number) => number}
 */
const declaredName = (list, at) =>
    list[at] === 'function' && list[at + 1] === '*' ? at + 2 : at + 1

/**
 * Whether the words following an `export` bind the name `proof`: a
 * declaration — `async` and `function*` included — a namespace re-export, or a
 * named list. A list entry exports the last name of its `as` chain, so
 * `{ implementation as proof }` binds `proof` and `{ proof as implementation }`
 * does not. An unclosed list is incomplete syntax and binds nothing.
 *
 * @type {(list: readonly string[], at: number) => boolean}
 */
const bindsProof = (list, at) => {
    const head = list[at]
    if (head === undefined) { return false }
    // `async` modifies the declaration that follows it and binds nothing itself.
    if (head === 'async') { return bindsProof(list, at + 1) }
    if (declarations.includes(head)) { return list[declaredName(list, at)] === 'proof' }
    if (head === '*') { return list[at + 1] === 'as' && list[at + 2] === 'proof' }
    if (head !== '{') { return false }
    const close = list.indexOf('}', at + 1)
    if (close === -1) { return false }
    return list.slice(at + 1, close)
        .join(' ')
        .split(',')
        .some(item => {
            const names = item.split(' ').filter(name => name !== '')
            return names[names.length - 1] === 'proof'
        })
}

/**
 * Whether `source` exports a binding named `proof`. A mention inside a comment,
 * a string, or a template is not one — the website generator embeds the page's
 * entry module as source text — because none of them reaches the words below.
 *
 * @type {(source: string) => boolean}
 */
export const exportsProof = source => {
    const list = words(read(source))
    return list.some((word, index) => word === 'export' && bindsProof(list, index + 1))
}

/**
 * Every static module specifier in `source`: the string literal following the
 * `from` of a declaration, or an `import` naming its module directly.
 *
 * A dynamic `import(...)` is left out, and left out structurally — its string
 * follows a `(`, not the keyword. That is the reading the manifest wants: a
 * dynamic import fails inside the test that reaches it rather than while the
 * page links. A `from` written in prose or inside a string is left out for the
 * same reason: neither is a sequence of tokens.
 *
 * @type {(source: string) => readonly string[]}
 */
export const specifiers = source => {
    const tokens = read(source)
    return tokens.flatMap((token, index) => {
        if (token.kind !== 'string') { return [] }
        const previous = tokens[index - 1]
        return previous?.kind === 'name'
            && (previous.text === 'from' || previous.text === 'import')
            ? [token.text]
            : []
    })
}

/** @type {(specifier: string) => boolean} */
export const local = specifier => specifier.startsWith('./') || specifier.startsWith('../')
