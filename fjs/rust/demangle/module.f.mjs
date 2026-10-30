/**
 * Demangles Rust symbols in the v0 mangling (`_R…`), printing them as the
 * `rustc-demangle` crate prints them with `{:#}`: without the crates'
 * disambiguating hashes or the type suffixes of integer constants, so
 * `_RNvNtCs1234_11nanvm_demos7samples5hello` is
 * `nanvm_demos::samples::hello`.
 *
 * **A name that is no v0 symbol is answered as it is**, as the crate answers
 * it: a WebAssembly module's names include C symbols such as `memcpy`, which
 * no Rust mangling made. So is a v0 symbol this cannot read, rather than a
 * part of it: the crate answers the same for any symbol its first pass
 * refuses. Legacy symbols (`_ZN…`) are among the names left as they are:
 * the pinned Rust mangles every Rust symbol of the demo module in v0.
 *
 * Like the crate, it drops a trailing `.llvm.<hex>` that ThinLTO appends, and
 * keeps any other suffix of dot-separated ASCII after the path.
 *
 * One divergence, in what no demo symbol holds: a `char` or `&str` constant
 * prints a non-ASCII character as itself, where the crate escapes those
 * Unicode deems unprintable.
 *
 * @module
 *
 * @import { _Read } from './private.ts'
 */

/** The deepest a symbol may nest, the crate's own limit. */
const maxDepth = 500

/** @type {Readonly<Record<string, string>>} */
const basicTypes = {
    b: 'bool', c: 'char', e: 'str', u: '()', a: 'i8', s: 'i16', l: 'i32', x: 'i64', n: 'i128',
    i: 'isize', h: 'u8', t: 'u16', m: 'u32', y: 'u64', o: 'u128', j: 'usize', f: 'f32', d: 'f64',
    z: '!', p: '_', v: '...',
}

/** @type {(c: string | undefined) => boolean} */
const isUpper = c => c !== undefined && c >= 'A' && c <= 'Z'

/** @type {(c: string | undefined) => boolean} */
const isDigit = c => c !== undefined && c >= '0' && c <= '9'

/** @type {(c: string | undefined) => boolean} */
const isLower = c => c !== undefined && c >= 'a' && c <= 'z'

/**
 * Decodes Punycode's insertions into `ascii`, answering `null` where they
 * are malformed or the result is longer than the crate decodes, 128
 * characters.
 *
 * @type {(ascii: string, punycode: string) => string | null}
 */
const punycodeDecode = (ascii, punycode) => {
    const base = 36
    const tMin = 1
    const tMax = 26
    let output = Array.from(ascii)
    if (output.length > 128) { return null }
    let damp = 700
    let bias = 72
    let i = 0
    let n = 0x80
    let at = 0
    while (true) {
        let delta = 0
        let w = 1
        let k = 0
        while (true) {
            k = k + base
            const t = Math.min(Math.max(k - bias, tMin), tMax)
            const c = punycode[at]
            at = at + 1
            const d = isLower(c) ? c.charCodeAt(0) - 0x61 : isDigit(c) ? 26 + c.charCodeAt(0) - 0x30 : -1
            if (d < 0) { return null }
            delta = delta + d * w
            if (d < t) { break }
            w = w * (base - t)
        }
        const length = output.length + 1
        i = i + delta
        n = n + Math.floor(i / length)
        i = i % length
        if (n > 0x10_ffff || (n >= 0xd800 && n <= 0xdfff) || length > 128) { return null }
        output = [...output.slice(0, i), String.fromCodePoint(n), ...output.slice(i)]
        i = i + 1
        if (at === punycode.length) { return output.join('') }
        delta = Math.floor(delta / damp)
        damp = 2
        delta = delta + Math.floor(delta / length)
        let kk = 0
        while (delta > ((base - tMin) * tMax) / 2) {
            delta = Math.floor(delta / (base - tMin))
            kk = kk + base
        }
        bias = kk + Math.floor(((base - tMin + 1) * delta) / (delta + 38))
    }
}

/**
 * A character of a `char` or `&str` constant inside `quote`: escaped as Rust's
 * `escape_debug` escapes ASCII, the other quote left bare.
 *
 * @type {(quote: string) => (c: string) => string}
 */
const escapeChar = quote => c => {
    const v = /** @type {number} */ (c.codePointAt(0))
    return c === quote || c === '\\' ? `\\${c}`
        : c === '\n' ? '\\n'
        : c === '\r' ? '\\r'
        : c === '\t' ? '\\t'
        : c === '\0' ? '\\0'
        : v < 0x20 || v === 0x7f ? `\\u{${v.toString(16)}}`
        : c
}

/**
 * The bytes the hex nibbles spell, as UTF-8 text, or `null` where they are
 * odd in number or no UTF-8.
 *
 * @type {(nibbles: string) => string | null}
 */
const utf8Nibbles = nibbles => {
    if (nibbles.length % 2 !== 0) { return null }
    const bytes = Array.from({ length: nibbles.length / 2 }, (_, k) => parseInt(nibbles.slice(2 * k, 2 * k + 2), 16))
    /** @type {readonly string[]} */
    let chars = []
    let k = 0
    while (k < bytes.length) {
        const b = bytes[k]
        const size = b < 0x80 ? 1 : b < 0xc0 ? 0 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : b < 0xf8 ? 4 : 0
        if (size === 0 || k + size > bytes.length) { return null }
        const rest = bytes.slice(k + 1, k + size)
        if (rest.some(x => (x & 0xc0) !== 0x80)) { return null }
        const lead = size === 1 ? b : b & (0xff >> (size + 1))
        const v = rest.reduce((v, x) => (v << 6) | (x & 0x3f), lead)
        const least = [0, 0, 0x80, 0x800, 0x1_0000][size]
        if (v < least || v > 0x10_ffff || (v >= 0xd800 && v <= 0xdfff)) { return null }
        chars = [...chars, String.fromCodePoint(v)]
        k = k + size
    }
    return chars.join('')
}

/**
 * The reader of one symbol: each function reads the production its name says
 * at offset `i`, printing it with `bound` lifetimes bound around it, `depth`
 * deep.
 *
 * @type {(s: string) => (i: number) => _Read<string>}
 */
const demangler = s => {
    /**
     * A base-62 integer closed by `_`, one more than its digits spell, so
     * that a lone `_` is 0; `null` past `u64`, as the crate refuses it.
     *
     * @type {(i: number) => _Read<bigint>}
     */
    const integer62 = i => {
        if (s[i] === '_') { return [0n, i + 1] }
        let x = 0n
        let j = i
        while (s[j] !== '_') {
            const c = s[j]
            const d = isDigit(c) ? c.charCodeAt(0) - 0x30
                : isLower(c) ? 10 + c.charCodeAt(0) - 0x61
                : isUpper(c) ? 36 + c.charCodeAt(0) - 0x41
                : -1
            if (d < 0) { return null }
            x = x * 62n + BigInt(d)
            j = j + 1
        }
        return x + 1n > 0xffff_ffff_ffff_ffffn ? null : [x + 1n, j + 1]
    }

    /** @type {(tag: string) => (i: number) => _Read<bigint>} */
    const optInteger62 = tag => i => {
        if (s[i] !== tag) { return [0n, i] }
        const r = integer62(i + 1)
        return r === null || r[0] + 1n > 0xffff_ffff_ffff_ffffn ? null : [r[0] + 1n, r[1]]
    }

    const disambiguator = optInteger62('s')

    /** @type {(i: number) => _Read<string>} */
    const hexNibbles = i => {
        let j = i
        while (s[j] !== '_') {
            const c = s[j]
            if (!(isDigit(c) || (c >= 'a' && c <= 'f'))) { return null }
            j = j + 1
        }
        return [s.slice(i, j), j + 1]
    }

    /**
     * An identifier: its ASCII part and its Punycode, apart.
     *
     * @type {(i: number) => _Read<readonly [string, string]>}
     */
    const ident = i => {
        const punycode = s[i] === 'u'
        const start = punycode ? i + 1 : i
        if (!isDigit(s[start])) { return null }
        let j = start + 1
        if (s[start] !== '0') {
            while (isDigit(s[j])) { j = j + 1 }
        }
        const length = Number(s.slice(start, j))
        const from = s[j] === '_' ? j + 1 : j
        const end = from + length
        if (end > s.length) { return null }
        const text = s.slice(from, end)
        if (!punycode) { return [[text, ''], end] }
        const split = text.lastIndexOf('_')
        /** @type {readonly [string, string]} */
        const parts = split < 0 ? ['', text] : [text.slice(0, split), text.slice(split + 1)]
        return parts[1] === '' ? null : [parts, end]
    }

    /** @type {(id: readonly [string, string]) => string} */
    const identText = ([ascii, punycode]) => {
        if (punycode === '') { return ascii }
        const decoded = punycodeDecode(ascii, punycode)
        return decoded !== null ? decoded : `punycode{${ascii === '' ? '' : `${ascii}-`}${punycode}}`
    }

    /**
     * A backref's target, read by `f` from where it points, and where the
     * symbol goes on after it.
     *
     * @type {<T>(i: number, depth: number, f: (j: number, depth: number) => _Read<T>) => _Read<T>}
     */
    const backref = (i, depth, f) => {
        const r = integer62(i + 1)
        if (r === null || r[0] >= BigInt(i) || depth + 1 > maxDepth) { return null }
        const target = f(Number(r[0]), depth + 1)
        return target === null ? null : [target[0], r[1]]
    }

    /**
     * A lifetime by its index: 0 is `'_`, and the rest count back through the
     * `bound` lifetimes the binders around it introduce, `'a` the outermost.
     *
     * @type {(lt: bigint, bound: number) => string | null}
     */
    const lifetime = (lt, bound) => {
        if (lt === 0n) { return "'_" }
        const depth = BigInt(bound) - lt
        return depth < 0n ? null : depth < 26n ? `'${String.fromCharCode(0x61 + Number(depth))}` : `'_${depth}`
    }

    /**
     * Items read by `f` until an `E`, joined by `sep`, and how many there were.
     *
     * @type {(i: number, sep: string, f: (j: number) => _Read<string>) => _Read<readonly [string, number]>}
     */
    const list = (i, sep, f) => {
        /** @type {readonly string[]} */
        let items = []
        let j = i
        while (s[j] !== 'E') {
            if (j >= s.length) { return null }
            const r = f(j)
            if (r === null) { return null }
            items = [...items, r[0]]
            j = r[1]
        }
        return [[items.join(sep), items.length], j + 1]
    }

    /**
     * `f` inside a binder of `G` lifetimes, printed `for<'a, 'b> ` before it.
     *
     * @type {(i: number, bound: number, f: (j: number, bound: number) => _Read<string>) => _Read<string>}
     */
    const binder = (i, bound, f) => {
        const g = optInteger62('G')(i)
        if (g === null || g[0] > 0xffff_ffffn) { return null }
        const count = Number(g[0])
        const j = g[1]
        const names = Array.from({ length: count }, (_, k) => lifetime(1n, bound + k + 1))
        const r = f(j, bound + count)
        return r === null ? null
            : [`${count === 0 ? '' : `for<${names.join(', ')}> `}${r[0]}`, r[1]]
    }

    /** @type {(i: number, inValue: boolean, bound: number, depth: number) => _Read<string>} */
    const path = (i, inValue, bound, depth) => {
        if (depth + 1 > maxDepth) { return null }
        const d = depth + 1
        const tag = s[i]
        if (tag === 'C') {
            const dis = disambiguator(i + 1)
            const name = dis === null ? null : ident(dis[1])
            return name === null ? null : [identText(name[0]), name[1]]
        }
        if (tag === 'N') {
            const ns = s[i + 1]
            if (!(isUpper(ns) || isLower(ns))) { return null }
            const prefix = path(i + 2, inValue, bound, d)
            const dis = prefix === null ? null : disambiguator(prefix[1])
            const name = dis === null ? null : ident(dis[1])
            if (prefix === null || dis === null || name === null) { return null }
            const text = identText(name[0])
            const empty = name[0][0] === '' && name[0][1] === ''
            const suffix = isLower(ns) ? (empty ? '' : `::${text}`)
                : `::{${ns === 'C' ? 'closure' : ns === 'S' ? 'shim' : ns}${empty ? '' : `:${text}`}#${dis[0]}}`
            return [`${prefix[0]}${suffix}`, name[1]]
        }
        if (tag === 'M' || tag === 'X' || tag === 'Y') {
            // An inherent or trait impl's own path, which is not printed.
            const dis = tag === 'Y' ? null : disambiguator(i + 1)
            const own = tag === 'Y' || dis === null ? null : path(dis[1], false, bound, d)
            const selfAt = tag === 'Y' ? i + 1 : own === null ? -1 : own[1]
            if (selfAt < 0) { return null }
            const self = type(selfAt, bound, d)
            if (self === null) { return null }
            if (tag === 'M') { return [`<${self[0]}>`, self[1]] }
            const trait = path(self[1], false, bound, d)
            return trait === null ? null : [`<${self[0]} as ${trait[0]}>`, trait[1]]
        }
        if (tag === 'I') {
            const prefix = path(i + 1, inValue, bound, d)
            const args = prefix === null ? null : list(prefix[1], ', ', j => genericArg(j, bound, d))
            return prefix === null || args === null ? null
                : [`${prefix[0]}${inValue ? '::' : ''}<${args[0][0]}>`, args[1]]
        }
        if (tag === 'B') {
            return backref(i, d, (j, depth) => path(j, inValue, bound, depth))
        }
        return null
    }

    /** @type {(i: number, bound: number, depth: number) => _Read<string>} */
    const genericArg = (i, bound, depth) => {
        if (s[i] === 'L') {
            const lt = integer62(i + 1)
            const text = lt === null ? null : lifetime(lt[0], bound)
            return lt === null || text === null ? null : [text, lt[1]]
        }
        return s[i] === 'K' ? constant(i + 1, false, bound, depth) : type(i, bound, depth)
    }

    /** @type {(i: number, bound: number, depth: number) => _Read<string>} */
    const type = (i, bound, depth) => {
        const splat = s[i] === 'w'
        const j = splat ? i + 1 : i
        const r = typeBody(j, bound, depth)
        return r === null ? null : [`${splat ? '#[splat] ' : ''}${r[0]}`, r[1]]
    }

    /** @type {(i: number, bound: number, depth: number) => _Read<string>} */
    const typeBody = (i, bound, depth) => {
        const tag = s[i]
        if (tag === undefined) { return null }
        const basic = basicTypes[tag]
        if (basic !== undefined) { return [basic, i + 1] }
        if (depth + 1 > maxDepth) { return null }
        const d = depth + 1
        /** @type {(prefix: string, r: _Read<string>, suffix?: string) => _Read<string>} */
        const wrap = (prefix, r, suffix = '') => r === null ? null : [`${prefix}${r[0]}${suffix}`, r[1]]
        if (tag === 'R' || tag === 'Q') {
            const lt = s[i + 1] === 'L' ? integer62(i + 2) : /** @type {const} */ ([0n, i + 1])
            if (lt === null) { return null }
            const ltText = lt[0] === 0n ? '' : lifetime(lt[0], bound)
            return ltText === null ? null
                : wrap(`&${ltText === '' ? '' : `${ltText} `}${tag === 'Q' ? 'mut ' : ''}`, type(lt[1], bound, d))
        }
        if (tag === 'P' || tag === 'O') { return wrap(tag === 'P' ? '*const ' : '*mut ', type(i + 1, bound, d)) }
        if (tag === 'S') { return wrap('[', type(i + 1, bound, d), ']') }
        if (tag === 'A') {
            const element = type(i + 1, bound, d)
            const size = element === null ? null : constant(element[1], true, bound, d)
            return element === null || size === null ? null : [`[${element[0]}; ${size[0]}]`, size[1]]
        }
        if (tag === 'T') {
            const items = list(i + 1, ', ', j => type(j, bound, d))
            return items === null ? null : [`(${items[0][0]}${items[0][1] === 1 ? ',' : ''})`, items[1]]
        }
        if (tag === 'F') { return binder(i + 1, bound, (j, bound) => fnSig(j, bound, d)) }
        if (tag === 'D') {
            const traits = binder(i + 1, bound, (j, bound) => {
                const r = list(j, ' + ', k => dynTrait(k, bound, d))
                return r === null ? null : [r[0][0], r[1]]
            })
            if (traits === null || s[traits[1]] !== 'L') { return null }
            const lt = integer62(traits[1] + 1)
            if (lt === null) { return null }
            const ltText = lt[0] === 0n ? '' : lifetime(lt[0], bound)
            return ltText === null ? null : [`dyn ${traits[0]}${ltText === '' ? '' : ` + ${ltText}`}`, lt[1]]
        }
        if (tag === 'B') { return backref(i, d, (j, depth) => type(j, bound, depth)) }
        if (tag === 'W') {
            const base = type(i + 1, bound, d)
            const p = base === null ? null : pattern(base[1], bound, d)
            return base === null || p === null ? null : [`${base[0]} is ${p[0]}`, p[1]]
        }
        return path(i, false, bound, d)
    }

    /** @type {(i: number, bound: number, depth: number) => _Read<string>} */
    const fnSig = (i, bound, depth) => {
        const isUnsafe = s[i] === 'U'
        const j = isUnsafe ? i + 1 : i
        /** @type {_Read<string | null>} */
        const abi = s[j] !== 'K' ? [null, j]
            : s[j + 1] === 'C' ? ['C', j + 2]
            : (() => {
                const id = ident(j + 1)
                return id === null || id[0][0] === '' || id[0][1] !== '' ? null : [id[0][0], id[1]]
            })()
        if (abi === null) { return null }
        const params = list(abi[1], ', ', k => type(k, bound, depth))
        if (params === null) { return null }
        /** @type {_Read<string>} */
        const result = s[params[1]] === 'u' ? ['', params[1] + 1] : type(params[1], bound, depth)
        if (result === null) { return null }
        const abiText = abi[0] === null ? '' : `extern "${abi[0].split('_').join('-')}" `
        return [
            `${isUnsafe ? 'unsafe ' : ''}${abiText}fn(${params[0][0]})${s[params[1]] === 'u' ? '' : ` -> ${result[0]}`}`,
            result[1],
        ]
    }

    /**
     * A trait of a trait object, with its associated type bindings inside
     * its generics.
     *
     * @type {(i: number, bound: number, depth: number) => _Read<string>}
     */
    const dynTrait = (i, bound, depth) => {
        /** @type {(i: number, depth: number) => _Read<readonly [string, boolean]>} */
        const openPath = (i, depth) => {
            if (s[i] === 'B') { return backref(i, depth, openPath) }
            if (s[i] === 'I') {
                const prefix = path(i + 1, false, bound, depth)
                const args = prefix === null ? null : list(prefix[1], ', ', j => genericArg(j, bound, depth))
                return prefix === null || args === null ? null : [[`${prefix[0]}<${args[0][0]}`, true], args[1]]
            }
            const p = path(i, false, bound, depth)
            return p === null ? null : [[p[0], false], p[1]]
        }
        const head = openPath(i, depth)
        if (head === null) { return null }
        let [[text, open], j] = head
        while (s[j] === 'p') {
            const name = ident(j + 1)
            if (name === null) { return null }
            const value = s[name[1]] === 'K' ? constant(name[1] + 1, false, bound, depth) : type(name[1], bound, depth)
            if (value === null) { return null }
            text = `${text}${open ? ', ' : '<'}${identText(name[0])} = ${value[0]}`
            open = true
            j = value[1]
        }
        return [`${text}${open ? '>' : ''}`, j]
    }

    /** @type {(i: number, bound: number, depth: number) => _Read<string>} */
    const pattern = (i, bound, depth) => {
        const tag = s[i]
        if (tag === 'R') {
            const low = constant(i + 1, false, bound, depth)
            const high = low === null ? null : constant(low[1], false, bound, depth)
            return low === null || high === null ? null : [`${low[0]}..=${high[0]}`, high[1]]
        }
        if (tag === 'O') {
            if (depth + 1 > maxDepth) { return null }
            const first = pattern(i + 1, bound, depth + 1)
            if (first === null) { return null }
            let text = first[0]
            let j = first[1]
            while (s[j] !== 'E') {
                if (j >= s.length) { return null }
                const next = pattern(j, bound, depth + 1)
                if (next === null) { return null }
                text = `${text} | ${next[0]}`
                j = next[1]
            }
            return [text, j + 1]
        }
        return tag === 'N' ? ['!null', i + 1] : null
    }

    /** @type {(i: number) => _Read<string>} */
    const uint = i => {
        const hex = hexNibbles(i)
        if (hex === null) { return null }
        const first = Array.from(hex[0]).findIndex(c => c !== '0')
        const significant = first < 0 ? '' : hex[0].slice(first)
        return [significant.length > 16 ? `0x${hex[0]}` : BigInt(`0x0${significant}`).toString(), hex[1]]
    }

    /** @type {(i: number, inValue: boolean, bound: number, depth: number) => _Read<string>} */
    const constant = (i, inValue, bound, depth) => {
        const tag = s[i]
        if (tag === undefined || depth + 1 > maxDepth) { return null }
        const d = depth + 1
        /** @type {(r: _Read<string>) => _Read<string>} */
        const braced = r => r === null ? null : inValue ? r : [`{${r[0]}}`, r[1]]
        /** @type {(j: number) => _Read<string>} */
        const element = j => constant(j, true, bound, d)
        if (tag === 'p') { return ['_', i + 1] }
        if ('htmyoj'.includes(tag)) { return uint(i + 1) }
        if ('aslxni'.includes(tag)) {
            const negative = s[i + 1] === 'n'
            const r = uint(negative ? i + 2 : i + 1)
            return r === null ? null : [`${negative ? '-' : ''}${r[0]}`, r[1]]
        }
        if (tag === 'b') {
            const r = uint(i + 1)
            return r === null || (r[0] !== '0' && r[0] !== '1') ? null : [r[0] === '0' ? 'false' : 'true', r[1]]
        }
        if (tag === 'c') {
            const r = uint(i + 1)
            const v = r === null || r[0].startsWith('0x') ? -1 : Number(r[0])
            return r === null || v < 0 || v > 0x10_ffff || (v >= 0xd800 && v <= 0xdfff) ? null
                : [`'${escapeChar("'")(String.fromCodePoint(v))}'`, r[1]]
        }
        /** @type {(j: number) => _Read<string>} */
        const strLiteral = j => {
            const hex = hexNibbles(j)
            const text = hex === null ? null : utf8Nibbles(hex[0])
            return hex === null || text === null ? null : [`"${Array.from(text, escapeChar('"')).join('')}"`, hex[1]]
        }
        if (tag === 'e') {
            const r = strLiteral(i + 1)
            return braced(r === null ? null : [`*${r[0]}`, r[1]])
        }
        if (tag === 'R' && s[i + 1] === 'e') { return strLiteral(i + 2) }
        if (tag === 'R' || tag === 'Q') {
            const r = constant(i + 1, true, bound, d)
            return braced(r === null ? null : [`&${tag === 'Q' ? 'mut ' : ''}${r[0]}`, r[1]])
        }
        if (tag === 'A') {
            const r = list(i + 1, ', ', element)
            return braced(r === null ? null : [`[${r[0][0]}]`, r[1]])
        }
        if (tag === 'T') {
            const r = list(i + 1, ', ', element)
            return braced(r === null ? null : [`(${r[0][0]}${r[0][1] === 1 ? ',' : ''})`, r[1]])
        }
        if (tag === 'V') {
            const p = path(i + 1, true, bound, d)
            if (p === null) { return null }
            const kind = s[p[1]]
            if (kind === 'U') { return braced([p[0], p[1] + 1]) }
            if (kind === 'T') {
                const r = list(p[1] + 1, ', ', element)
                return braced(r === null ? null : [`${p[0]}(${r[0][0]})`, r[1]])
            }
            if (kind === 'S') {
                const r = list(p[1] + 1, ', ', j => {
                    const dis = disambiguator(j)
                    const name = dis === null ? null : ident(dis[1])
                    const value = name === null ? null : element(name[1])
                    return name === null || value === null ? null : [`${identText(name[0])}: ${value[0]}`, value[1]]
                })
                return braced(r === null ? null : [`${p[0]} { ${r[0][0]} }`, r[1]])
            }
            return null
        }
        if (tag === 'B') { return backref(i, d, (j, depth) => constant(j, inValue, bound, depth)) }
        return null
    }

    return i => {
        const r = path(i, true, 0, 0)
        if (r === null) { return null }
        // The instantiating crate, which the crate reads and does not print.
        const end = isUpper(s[r[1]]) ? path(r[1], false, 0, 0) : r
        return end === null ? null : [r[0], end[1]]
    }
}

/** @type {(c: string) => boolean} */
const isSymbolChar = c => c >= '!' && c <= '~'

/**
 * `name` demangled, or `name` itself where it is no v0 symbol.
 *
 * @type {(name: string) => string}
 */
export const demangle = name => {
    const llvm = name.indexOf('.llvm.')
    const hash = llvm < 0 ? '' : name.slice(llvm + 6)
    const s = llvm >= 0 && Array.from(hash).every(c => (c >= 'A' && c <= 'F') || isDigit(c) || c === '@')
        ? name.slice(0, llvm)
        : name
    const start = s.length > 2 && s.startsWith('_R') ? 2
        : s.length > 3 && s.startsWith('__R') ? 3
        : s.length > 1 && s.startsWith('R') ? 1
        : -1
    if (start < 0 || !isUpper(s[start]) || Array.from(s).some(c => c > '\x7f')) { return name }
    // Backrefs count from the start of the path, after the prefix.
    const r = demangler(s.slice(start))(0)
    if (r === null) { return name }
    const suffix = s.slice(start + r[1])
    return suffix === '' || (suffix.startsWith('.') && Array.from(suffix).every(isSymbolChar))
        ? `${r[0]}${suffix}`
        : name
}
