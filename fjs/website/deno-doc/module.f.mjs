/**
 * Public Deno documentation policy. The external generator owns rendering;
 * these decisions select sources and connect its observed pages to the site.
 *
 * @module
 */

import { assert } from '../../asserts/module.f.mjs'

/** Deno's intermediate output, excluded from uploads with all of target/. */
export const inputDir = 'target/deno-doc'
/** The reserved public reference route. */
export const outputDir = 'deno.doc'
/** A build-time manifest of source files and observed generated pages. */
export const manifestName = '_modules.txt'

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
 * Add only a small, independent return link at the body boundary. Deno has no
 * CLI header/footer hook. Refuse a changed template instead of silently
 * altering its navigation, search, styling or asset references.
 *
 * @type {(html: string) => (source: string | null) => string}
 */
export const withReturnLink = html => source => {
    const body = html.split('<body>')
    assert(body.length === 2, 'unsupported Deno HTML body')
    const dir = source === null ? null : source.slice(0, source.lastIndexOf('/'))
    // Symbol pages have the same module label in their metadata; module index
    // pages use their title. The host resolves either to the real source.
    const sourceLink = dir === null ? '' : ` · <a href="/${dir.split('/').map(encodeURIComponent).join('/')}/">Source directory</a>`
    return `${body[0]}<body>\n<nav aria-label="FunctionalScript site"><a href="/">FunctionalScript site</a>${sourceLink}</nav>${body[1]}`
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
