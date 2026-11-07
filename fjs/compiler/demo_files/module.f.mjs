/**
 * The files of a program typed into one box: the compiler demo's text split
 * into modules, and which of them its imports reach
 * ([import-linking-demo](../todo/import-linking-demo.md)).
 *
 * **One text holds every file.** The text before the first marker line is the
 * main module, {@link main}; each line `// @filename: <name>` starts another
 * file, the convention the TypeScript playground uses for several files in one
 * editor. A text with no marker is one module, so every single-module example
 * and shared link reads as before. {@link split} reads the files and
 * {@link join} writes them back: `split(join(files))` is `files`, and
 * `join(split(t))` is `t` but where a file holds one empty line and nothing
 * else: that file is empty, and an empty file has no line.
 *
 * **A marker is a line of its own.** An indented marker would be a comment to
 * the parser and a file boundary to a reader, so {@link split} refuses it
 * rather than guess which was meant, as it refuses a name that is not a
 * module file, a name used twice, and a marker naming the main module.
 *
 * **The imports decide which files are in the program.** {@link reached}
 * walks the import tree from the main module, each file once, in the order
 * the tree first reaches it. A file the tree does not reach is held, not
 * read: the compiler reads only what is imported.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { File, Files } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.js'
import { escapes } from '../../path/module.f.js'
import { resolve, specifierKind } from '../../path/import/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'

/** The main module's file name: what `fjs compile` reads as its input. */
export const main = 'input.f.js'

/** What starts a marker line; the file's name follows it. */
export const marker = '// @filename: '

/**
 * Whether `name` is a module file a box can hold: a relative path ending in
 * `.f.js`, `.f.mjs` or `.json`, written as the program's directory resolves
 * it, so one file has one name.
 *
 * @type {(name: string) => boolean}
 */
export const isModuleFile = name =>
    (name.endsWith('.f.js') || name.endsWith('.f.mjs') || name.endsWith('.json'))
    && specifierKind(name) === 'bare'
    && !escapes(name)
    && resolve(main)(`./${name}`) === name

/**
 * Why a marker's `name` cannot start a file after `files`, or `null` where it
 * can.
 *
 * @type {(files: Files) => (name: string) => string | null}
 */
const nameRefusal = files => name =>
    name === main ? `${main} is the main module, the text before the first marker`
    : !isModuleFile(name) ? `${name} is not a module file name: a relative path ending in .f.js, .f.mjs or .json`
    : files.some(([n]) => n === name) ? `${name} is written twice`
    : null

/**
 * The files `text` holds, or why it holds none.
 *
 * @type {(text: string) => Result<Files, string>}
 */
export const split = text => {
    /** @type {Files} */
    let files = []
    /** @type {File} */
    let current = [main, '']
    let first = true
    for (const line of text.split('\n')) {
        if (line.startsWith(marker)) {
            files = [...files, current]
            const name = line.slice(marker.length)
            const refusal = nameRefusal(files)(name)
            if (refusal !== null) { return error(refusal) }
            current = [name, '']
            first = true
        } else if (line.trimStart().startsWith(marker.trimEnd())) {
            return error(`a marker must start its line: ${line.trim()}`)
        } else {
            current = [current[0], first ? line : `${current[1]}\n${line}`]
            first = false
        }
    }
    return ok([...files, current])
}

/**
 * `files` as one text, the main module first: the text {@link split} reads
 * them from.
 *
 * @type {(files: Files) => string}
 */
export const join = files => {
    /** An empty file has no line, unless it is the whole text. @type {(text: string) => readonly string[]} */
    const lines = text => text === '' && files.length > 1 ? [] : [text]
    const [[, first], ...rest] = files
    return [...lines(first), ...rest.flatMap(([name, text]) => [`${marker}${name}`, ...lines(text)])].join('\n')
}

/**
 * The module files `text`, the module named `name`, imports by a relative
 * path, resolved against `name`, each once, in the order it imports them; or
 * the parser's message where it does not parse. A JSON file imports nothing.
 * A bare or rooted specifier, or a relative one naming no module file, is
 * left to the compiler, which refuses it.
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
            const path = specifierKind(specifier) === 'relative' ? resolve(name)(specifier) : null
            return path === null || !isModuleFile(path) || found.includes(path) ? found : [...found, path]
        },
        []))
}

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
    /** @type {(name: string) => string} */
    const textOf = name => files.find(([n]) => n === name)?.[1] ?? ''
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
