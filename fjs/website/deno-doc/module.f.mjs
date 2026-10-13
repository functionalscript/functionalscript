/**
 * Public Deno documentation policy. The external generator owns rendering;
 * these decisions select sources and connect its observed pages to the site.
 *
 * @module
 */

import { assert } from '../../asserts/module.f.mjs'
import { percentEncodePath } from '../../text/percent/module.f.mjs'

/** Deno's intermediate output, excluded from uploads with all of target/. */
export const inputDir = 'target/deno-doc'
/** The reserved public reference route. */
export const outputDir = 'deno.doc'
/** A build-time manifest of source files and observed generated pages. */
export const manifestName = '_modules.txt'
/** The bars' scoped stylesheet, copied with Deno's own assets. */
export const stylesheetName = '_functional-script.css'

/**
 * A generated file path as Cloudflare's asset manifest accepts it. Deno uses
 * property names verbatim in symbol-page filenames, including operators and
 * spaces. Encode those UTF-8 bytes while preserving path separators.
 *
 * A slash property is the one ambiguous case: Deno writes `name./.html`, as
 * though the property were a directory. Collapse that observed shape into the
 * single filename `name.%2F.html`; the page's own relative assets were already
 * written for that shallower location.
 *
 * @type {(path: string) => string}
 */
export const publishedPath = path => {
    const slashSuffix = '/.html'
    const slashProperty = path.endsWith(`.${slashSuffix}`)
    const literal = slashProperty ? path.slice(0, -slashSuffix.length) : path
    // `percentEncodePath` keeps existing escapes. These are raw filesystem
    // names, so make every literal percent an escape of percent first.
    const encoded = percentEncodePath(literal.split('%').join('%25'))
    assert(encoded !== null, ['Deno wrote a path that is not UTF-8', path])
    return slashProperty ? `${encoded}%2F.html` : encoded
}

/** Only the paths whose published spelling differs. @type {(paths: readonly string[]) => readonly (readonly [string, string])[]} */
export const publishedRenames = paths => paths
    .map(path => /** @type {const} */ ([path, publishedPath(path)]))
    .filter(([source, target]) => source !== target)

/** Deno HTML spells path separators as entities. @type {(path: string) => string} */
const htmlPath = path => path.split('/').join('&#x2F;')

/**
 * Rewrite Deno's links to renamed assets, both in its JSON search index and
 * in HTML attributes. Full output-relative paths make each replacement
 * unambiguous even when several modules expose the same operator property.
 *
 * @type {(renames: readonly (readonly [string, string])[]) => (text: string) => string}
 */
export const rewritePublishedPaths = renames => text => {
    assert(!text.includes('\0'), ['Deno wrote a null byte in a text asset', text])
    const marked = renames.reduce((result, [source], index) =>
        result.split(source).join(`\0${index}r\0`).split(htmlPath(source)).join(`\0${index}h\0`), text)
    return renames.reduce((result, [, target], index) =>
        result.split(`\0${index}r\0`).join(target).split(`\0${index}h\0`).join(htmlPath(target)), marked)
}

/**
 * Library entrypoints and public type companions, in deterministic order.
 * Build tools, website code, examples, issues and generated files are not API.
 * Host adapters and proofs are not entrypoints. Dependencies remain Deno's
 * responsibility, including imported types and re-exports.
 *
 * @type {(paths: readonly string[]) => readonly string[]}
 */
export const entrypoints = paths => paths.filter(path => {
    const parts = path.split('/')
    const name = parts.at(-1)
    return parts[0] === 'fjs' && parts.length > 2
        && !parts.some(part => part.startsWith('.') || part.startsWith('gen.')
            || ['ci', 'dev', 'website', 'todo', 'examples', 'node_modules', 'target'].includes(part))
        && (name === 'module.f.mjs' || name === 'module.f.js' || name === 'types.ts')
}).toSorted()

/** Decode the entities Deno uses in generated path labels. @type {(text: string) => string} */
const decode = text => text.split('&#x2F;').join('/').split('&quot;').join('"')
    .split('&#x27;').join("'").split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&')

/**
 * Match a generated label to one source, refusing ambiguous matches. There is
 * no assumed output-directory naming rule: the caller keeps the file it read.
 *
 * @type {(label: string) => (sources: readonly string[]) => string | null}
 */
const sourceOf = label => sources => {
    if (label === '') { return null }
    const exact = sources.find(source => source === label || source === `fjs/${label}`)
    if (exact !== undefined) { return exact }
    const found = sources.filter(source => source.endsWith(`/${label}`))
    assert(found.length <= 1, 'ambiguous Deno module label')
    return found[0] ?? null
}

/**
 * The module documented by an actual module index's title, or null for the
 * reference's root index. Checked against pinned Deno output before use.
 *
 * @type {(html: string) => (sources: readonly string[]) => string | null}
 */
export const moduleSource = html => sources => {
    const title = html.split('<title>')[1]?.split('</title>')[0] ?? ''
    const suffix = ' - FunctionalScript documentation'
    return title.endsWith(suffix) ? sourceOf(decode(title.slice(0, -suffix.length)))(sources) : null
}

/**
 * Add the shared site chrome at Deno's document boundaries. Deno has no CLI
 * header/footer hook. Refuse a changed template instead of silently altering
 * its navigation, search, styling or asset references.
 *
 * @type {(chrome: { readonly head: string, readonly header: string, readonly footer: string }) => (html: string) => (source: string | null) => string}
 */
export const withSiteChrome = chrome => html => source => {
    const head = html.split('</head>')
    const bodyOpen = html.split('<body>')
    const bodyClose = html.split('</body>')
    assert(head.length === 2, 'unsupported Deno HTML head')
    assert(bodyOpen.length === 2 && bodyClose.length === 2, 'unsupported Deno HTML body')
    const dir = source === null ? null : source.slice(0, source.lastIndexOf('/'))
    // Symbol pages have the same module label in their metadata; module index
    // pages use their title. The host resolves either to the real source.
    const sourceLink = dir === null ? '' : `\n<nav aria-label="Source"><a href="/${dir.split('/').map(encodeURIComponent).join('/')}/">Source directory</a></nav>`
    const headed = `${head[0]}${chrome.head}</head>${head[1]}`
    const opened = headed.split('<body>')
    const closed = opened[1].split('</body>')
    return `${opened[0]}<body>\n${chrome.header}${sourceLink}${closed[0]}${chrome.footer}</body>${closed[1]}`
}

/** A symbol page's source, from Deno's own metadata. @type {(html: string) => (sources: readonly string[]) => string | null} */
export const symbolSource = html => sources => sourceOf(decode(
    html.split('<meta name="doc-current-file" content="')[1]?.split('"')[0] ?? '',
))(sources)

/**
 * Read the build's source-to-output manifest. Both paths are repository
 * relative; traversal, empty fields and unexpected sources stop the build.
 *
 * @type {(text: string) => readonly (readonly [string, string])[]}
 */
export const readManifest = text => text.split('\n').filter(line => line !== '').map(line => {
    const fields = line.split('\t')
    const [source, page] = fields
    assert(fields.length === 2 && source !== undefined && page !== undefined, 'invalid Deno manifest row')
    assert(entrypoints([source]).length === 1, 'invalid Deno source')
    assert(page.endsWith('/index.html') && page.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'invalid Deno page')
    return /** @type {const} */ ([source, page])
})

/** The actual module page for a source directory, preferring runtime API over types. @type {(modules: readonly (readonly [string, string])[]) => (dir: string) => string | null} */
export const moduleHref = modules => dir => {
    const found = modules.find(([source]) => source === `${dir}/module.f.mjs` || source === `${dir}/module.f.js`)
        ?? modules.find(([source]) => source === `${dir}/types.ts`)
    return found === undefined ? null : `/${outputDir}/${found[1].split('/').map(encodeURIComponent).join('/')}`
}
