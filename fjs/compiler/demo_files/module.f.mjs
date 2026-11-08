/**
 * The files of a program the compiler demo links: the main module and every
 * file its imports reach, each in a box of its own
 * ([import-linking-demo](../todo/import-linking-demo.md)).
 *
 * **A file is named by the path the compiler reads it from.** An import opens
 * a box for the file it names: a relative (`./`, `../`) or rooted (`/`)
 * specifier, resolved against the importing file ({@link targetOf}). Any file name will do,
 * `./dep` and `./dep.mjs` as well as `./dep.f.js`, since the compiler reads
 * whatever the path names. A bare specifier opens nothing: the compiler
 * refuses it, and the panes say so.
 *
 * **The program's directory is the root.** The page compiles over an
 * in-memory file system whose root holds the main module, so `/` names the
 * program's directory and nothing is above it. On the command line, `/` is
 * the root of the disk and `../` may leave the main module's directory, so
 * {@link outsideImports} names each import that reads another file there.
 *
 * **The imports decide which files are in the program.** {@link reached}
 * walks the import tree from the main module, each file once, in the order
 * the tree first reaches it. A file the tree does not reach is held, not
 * read: the compiler reads only what is imported.
 *
 * **A shared link carries the files other than the main module as one JSON
 * text** ({@link encode}, {@link decode}): a list of `[name, text]` pairs.
 * Nothing in a module's text is reserved, so every module a box can hold is
 * a module the link can carry.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { File, Files, Imports } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.js'
import { assertNotNullish } from '../../asserts/module.f.js'
import { escapes, normalize, root } from '../../path/module.f.js'
import { resolve, specifierKind } from '../../path/import/module.f.mjs'
import { parse as parseJson, stringifySorted } from '../../media/json/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'

/** The main module's file name: what `fjs compile` reads as its input. */
export const main = 'input.f.js'

/**
 * The file an import of `specifier` in the file `importer` reads, named from
 * the program's directory: `lib/b.f.js` for `../lib/b.f.js` in `a/x.f.js`, and
 * for `/lib/b.f.js` anywhere. `null` for a bare specifier, which the compiler
 * refuses, and for a path it cannot read inside the program's directory.
 *
 * @type {(importer: string) => (specifier: string) => string | null}
 */
export const targetOf = importer => specifier => {
    if (specifierKind(specifier) === 'bare') { return null }
    const path = resolve(importer)(specifier)
    if (path === null) { return null }
    const name = path.startsWith('/') ? path.slice(1) : path
    return name === '' || name.startsWith('/') || escapes(name) ? null : name
}

/**
 * Whether `name` is a file a program other than its main module can hold: a
 * path inside the program's directory, written as {@link targetOf} writes it,
 * normalized and without a root, so one file has one name.
 *
 * It reads `name` as a file's path, not as an import specifier: `targetOf`
 * has already decoded the specifier, so `./dep%3F.f.js` opens the box
 * `dep?.f.js`, and that name is held, and shared, as it is. Read as a
 * specifier again, its `?` would be refused.
 *
 * @type {(name: string) => boolean}
 */
export const isFileName = name => name !== '' && name !== main && root(name) === '' && !escapes(name) && normalize(name) === name

/**
 * The files `text`, the module named `name`, imports, named by
 * {@link targetOf}, each once, in the order it imports them; or the parser's
 * message where it does not parse. A JSON file imports nothing.
 *
 * @type {(name: string) => (text: string) => Result<readonly string[], string>}
 */
export const importsOf = name => text => {
    if (name.endsWith('.json')) { return ok([]) }
    const parsed = parse(name)(text)
    if (parsed[0] === 'error') { return error(parsed[1].message) }
    return ok(parsed[1].imports.reduce(
        /** @type {(found: readonly string[], i: { readonly specifier: string }) => readonly string[]} */
        (found, { specifier }) => {
            const path = targetOf(name)(specifier)
            return path === null || found.includes(path) ? found : [...found, path]
        },
        []))
}

/** @type {(files: Files) => (name: string) => string} */
const textIn = files => name => files.find(([n]) => n === name)?.[1] ?? ''

/**
 * The files the import tree of `files` reaches from the main module, each
 * once, in the order the tree first reaches it, the main module first. A
 * name `files` does not hold is reached as an empty module, a box to write.
 * A module that does not parse adds what `previous` gives for it: the imports
 * it had when it last parsed, so a box does not vanish while its importer is
 * half-typed.
 *
 * @type {(previous: (name: string) => readonly string[]) => (files: Files) => readonly string[]}
 */
export const reached = previous => files => {
    const textOf = textIn(files)
    /** @type {readonly string[]} */
    let order = [main]
    for (let i = 0; i < order.length; i += 1) {
        const name = order[i]
        const imports = importsOf(name)(textOf(name))
        const paths = imports[0] === 'ok' ? imports[1] : previous(name)
        order = [...order, ...paths.filter(p => !order.includes(p))]
    }
    return order
}

/**
 * Each file the import tree of `files` reaches, with the files it imports:
 * as it imports them now where it parses, as `previous` held them where it
 * does not, and none where `previous` holds nothing for it. It is the
 * `previous` of the next edit's {@link reached}, so a page keeps it between
 * edits.
 *
 * @type {(previous: Imports) => (files: Files) => Imports}
 */
export const lastImports = previous => files => {
    /** @type {(name: string) => readonly string[]} */
    const before = name => previous.find(([n]) => n === name)?.[1] ?? []
    const textOf = textIn(files)
    return reached(before)(files).map(name => {
        const imports = importsOf(name)(textOf(name))
        return /** @type {const} */ ([name, imports[0] === 'ok' ? imports[1] : before(name)])
    })
}

/**
 * The first import cycle of `files`, walking the tree from the main module
 * depth first: each file of the cycle, the first written again at the end
 * (`input.f.js → m.f.js → input.f.js`), or `null` where the imports form
 * none. A module that does not parse imports nothing here. The compiler
 * refuses a cycle in its own words, `circular dependency`; this names every
 * file the cycle passes through, which its message does not.
 *
 * Each file is parsed once, and a file the walk has left without finding a
 * cycle under it is not walked again, so a graph whose files share their
 * imports, a diamond on a diamond, takes time in proportion to its imports,
 * not to its paths.
 *
 * @type {(files: Files) => readonly string[] | null}
 */
export const cycleOf = files => {
    const textOf = textIn(files)
    const table = reached(() => [])(files).map(name => {
        const imports = importsOf(name)(textOf(name))
        return /** @type {const} */ ([name, imports[0] === 'ok' ? imports[1] : []])
    })
    // every file the walk visits is one the tree reaches, so it is in the table
    /** @type {(name: string) => readonly string[]} */
    const importsAt = name => assertNotNullish(table.find(([n]) => n === name))[1]
    /**
     * The cycle under the last file of `path`, or `null`, and the files known
     * to have none under them, `done` with this one added.
     *
     * @type {(path: readonly string[], done: readonly string[]) => readonly [readonly string[] | null, readonly string[]]}
     */
    const from = (path, done) => {
        const last = path[path.length - 1]
        let known = done
        for (const next of importsAt(last)) {
            if (path.includes(next)) { return [[...path.slice(path.indexOf(next)), next], known] }
            if (!known.includes(next)) {
                const [cycle, after] = from([...path, next], known)
                if (cycle !== null) { return [cycle, after] }
                known = after
            }
        }
        return [null, [...known, last]]
    }
    return from([main], [])[0]
}

/**
 * `files` as an in-memory file system's directory, each name's `/` a
 * directory of its own, so a module resolves its imports as it would on
 * disk. Where a name is a file and a directory both, the later file wins.
 *
 * @type {(files: Files) => Dir}
 */
export const dirOf = files => files.reduce(
    /** @type {(dir: Dir, file: File) => Dir} */
    (dir, [name, text]) => {
        /** @type {(d: Dir, path: readonly string[]) => Dir} */
        const put = (d, [first, ...rest]) => {
            const sub = d[first]
            return { ...d, [first]: rest.length === 0 ? [utf8(text)] : put(typeof sub === 'object' && !(sub instanceof Array) ? sub : {}, rest) }
        }
        return put(dir, name.split('/'))
    },
    {})

/**
 * The files of a program other than its main module, as the text a shared
 * link carries: a JSON list of `[name, text]` pairs, in order.
 *
 * @type {(files: Files) => string}
 */
export const encode = files => stringifySorted(files)

/**
 * The files a shared link's text carries, or why it carries none: the text
 * {@link encode} writes, each name a file a program can hold, none twice.
 *
 * @type {(text: string) => Result<Files, string>}
 */
export const decode = text => {
    const parsed = parseJson(text)
    if (parsed[0] === 'error') { return error(`files: ${parsed[1]}`) }
    const value = parsed[1]
    if (!(value instanceof Array)) { return error('files: not a list') }
    /** @type {Files} */
    let files = []
    for (const file of value) {
        if (!(file instanceof Array) || file.length !== 2) { return error('files: an entry is not a [name, text] pair') }
        const [name, fileText] = file
        if (typeof name !== 'string' || typeof fileText !== 'string') { return error('files: an entry is not a [name, text] pair') }
        if (!isFileName(name)) { return error(`files: ${name} is not a file name a program can hold`) }
        if (files.some(([n]) => n === name)) { return error(`files: ${name} is written twice`) }
        files = [...files, [name, fileText]]
    }
    return ok(files)
}

/**
 * Each import in a file `files`' import tree reaches whose meaning on the
 * command line differs from the page's: a rooted specifier, which there names
 * a path from the root of the disk, and a relative one that climbs above the
 * program's directory, which there may name a file outside it. A specifier
 * the compiler refuses (`//host/a.f.js`, `/bad%`) reads no file on either, so
 * it is left to the panes' `invalid module specifier`. Each is the
 * importing file and the specifier as written, in the order the tree reaches
 * them.
 *
 * @type {(files: Files) => readonly (readonly [file: string, specifier: string])[]}
 */
export const outsideImports = files => {
    const textOf = textIn(files)
    return reached(() => [])(files).flatMap(name => {
        if (name.endsWith('.json')) { return [] }
        const parsed = parse(name)(textOf(name))
        return parsed[0] === 'error' ? [] : parsed[1].imports
            .filter(({ specifier }) => {
                const kind = specifierKind(specifier)
                // a specifier the compiler refuses reads no file anywhere
                if (kind === 'bare' || resolve(name)(specifier) === null) { return false }
                return kind === 'rooted' || targetOf(name)(specifier) === null
            })
            .map(({ specifier }) => /** @type {const} */ ([name, specifier]))
    })
}

/**
 * Each file `files`' import tree reaches under more than one module identity,
 * in the order the tree first reaches it. The in-memory resolver's identity
 * of a module is its importer's identity with the specifier resolved against
 * it, leading `/` and all, and the main module's is `input.f.js`; so a file is
 * `/lib/d.mjs` where a rooted import, or any import inside a file reached that
 * way, reads it, and `lib/d.mjs` where a relative one from a relatively reached
 * file does. One stored file under two identities is two modules to the
 * compiler, so the two are not shared
 * ([rooted-module-identity](../../effects/node/virtual/todo/rooted-module-identity.md)).
 *
 * @type {(files: Files) => readonly string[]}
 */
export const twiceLoaded = files => {
    const textOf = textIn(files)
    /** @type {(id: string) => string} */
    const fileOf = id => id.startsWith('/') ? id.slice(1) : id
    /** @type {readonly string[]} */
    let ids = [main]
    for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i]
        const name = fileOf(id)
        const parsed = name.endsWith('.json') ? null : parse(name)(textOf(name))
        /** @type {readonly string[]} */
        const next = parsed === null || parsed[0] === 'error' ? [] : parsed[1].imports.flatMap(({ specifier }) => {
            // a specifier that opens no box is the compiler's to refuse
            const read = targetOf(name)(specifier) === null ? null : resolve(id)(specifier)
            return read === null ? [] : [normalize(read)]
        })
        ids = next.reduce((all, n) => all.includes(n) ? all : [...all, n], ids)
    }
    const names = ids.map(fileOf)
    return names.filter((n, i) => names.indexOf(n) === i && names.lastIndexOf(n) !== i)
}
