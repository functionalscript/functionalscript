/**
 * Static reading of authored source text: whether a module exports `proof`,
 * and which modules a browser would have to link to load it.
 *
 * The manifest generator classifies modules without importing them — that is
 * the point of reading them as text — and TypeScript 7 exposes no compiler API,
 * so both questions are answered by ordinary functions here, with their own
 * proofs, rather than by patterns whose supported characters are implicit.
 */

/**
 * Blanks comments and quoted literals before looking for export declarations.
 * Export declarations cannot occur inside a string, comment, or template, so
 * this is enough to distinguish syntax from source text.
 *
 * @type {(source: string) => string}
 */
export const codeOnly = source => {
    let result = ''
    let index = 0
    while (index < source.length) {
        const char = source[index]
        const next = source[index + 1]
        if (char === '/' && next === '/') {
            index += 2
            while (index < source.length && source[index] !== '\n') { index += 1 }
            result += '\n'
            index += 1
            continue
        }
        if (char === '/' && next === '*') {
            index += 2
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
                result += source[index] === '\n' ? '\n' : ' '
                index += 1
            }
            result += '  '
            index += 2
            continue
        }
        if (char === '\'' || char === '"' || char === '`') {
            const quote = char
            result += ' '
            index += 1
            while (index < source.length) {
                if (source[index] === '\\') {
                    result += '  '
                    index += 2
                    continue
                }
                if (source[index] === quote) {
                    result += ' '
                    index += 1
                    break
                }
                result += source[index] === '\n' ? '\n' : ' '
                index += 1
            }
            continue
        }
        result += char
        index += 1
    }
    return result
}

/**
 * The characters an export name is spelled with. A name outside this set —
 * a Unicode identifier, a quoted export name — reads as punctuation and so
 * never matches `proof`, which is the only name being looked for.
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

/**
 * The code as names and single-character punctuation, whitespace dropped, so
 * that spacing stops mattering: `export{ a as proof }` and
 * `export { a as proof }` both read as
 * `['export', '{', 'a', 'as', 'proof', '}']`.
 *
 * @type {(code: string) => readonly string[]}
 */
const tokens = code => [...code]
    .map(char => nameChar(char) ? char : space(char) ? ' ' : ` ${char} `)
    .join('')
    .split(' ')
    .filter(token => token !== '')

/** The keywords that can introduce an `export <keyword> proof` declaration. */
const declarations = ['const', 'let', 'var', 'function', 'class']

/**
 * Whether the tokens following an `export` bind the name `proof`: a
 * declaration, a namespace re-export, or a named list. A list entry exports
 * the last name of its `as` chain, so `{ implementation as proof }` binds
 * `proof` and `{ proof as implementation }` does not. An unclosed list is
 * incomplete syntax and binds nothing.
 *
 * @type {(list: readonly string[], at: number) => boolean}
 */
const bindsProof = (list, at) => {
    const head = list[at]
    if (head === undefined) { return false }
    if (declarations.includes(head)) { return list[at + 1] === 'proof' }
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
 * Whether `source` exports a binding named `proof`. A mention inside a comment
 * or a string is not one — the website generator embeds the page's entry module
 * as source text — so the literals are blanked before the names are read.
 *
 * @type {(source: string) => boolean}
 */
export const exportsProof = source => {
    const list = tokens(codeOnly(source))
    return list.some((token, index) => token === 'export' && bindsProof(list, index + 1))
}

/** @type {(line: string, prefix: string, quote: string) => readonly string[]} */
const quoted = (line, prefix, quote) =>
    line.split(prefix + quote).slice(1).map(part => part.split(quote)[0] ?? '')

/**
 * A line that can carry a static module specifier: the head of an
 * `import`/`export` declaration — in either spacing `exportsProof` accepts —
 * or the `} from '...'` tail of one whose bindings span several lines.
 * Documentation and ordinary expressions are left out, so prose such as "tells
 * `'empty'` from `'missing'`" is not mistaken for an import — a JSDoc line
 * starts with `*` and a string literal with a quote.
 *
 * @type {(line: string) => boolean}
 */
const declaration = line => {
    const text = line.trim()
    return text.startsWith('import ') || text.startsWith('import{')
        || text.startsWith('export ') || text.startsWith('export{')
        || text.startsWith('} from ')
}

/**
 * Every static module specifier in `source`. Import declarations are the only
 * thing the browser links eagerly, so a dynamic `import(...)` is left out: it
 * fails inside the test that reaches it rather than while the page loads.
 *
 * @type {(source: string) => readonly string[]}
 */
export const specifiers = source => source.split('\n').filter(declaration).flatMap(line =>
    ['\'', '"'].flatMap(quote =>
        ['from ', 'import '].flatMap(prefix => quoted(line, prefix, quote))))

/** @type {(specifier: string) => boolean} */
export const local = specifier => specifier.startsWith('./') || specifier.startsWith('../')
