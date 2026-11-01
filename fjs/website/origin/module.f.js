/**
 * Where a build of the site is published: production, a branch's preview,
 * or nowhere a link can reach.
 *
 * **One home for the preview alias**, because two readers need it to agree:
 * the upload names the preview by it (`--preview-alias` in
 * [`../cloudflare`](../cloudflare/module.f.mjs)), and a page gives its own
 * URL by it. A second spelling of the rule would let a page point at a
 * preview the upload never made.
 *
 * @module
 */

/** The Worker name in `wrangler.jsonc`, which shares the alias's DNS label. */
const workerName = /** @type {const} */ ('functionalscript')

/** The account's `workers.dev` subdomain, under which every preview is published. */
const workersSubdomain = /** @type {const} */ ('functionalscript.workers.dev')

/** The alias's budget: a DNS label is 63 characters, shared with a dash and the Worker name. */
const aliasBudget = 63 - 1 - workerName.length

/** The characters an alias keeps; every run of others becomes one hyphen. */
const aliasCharacters = /** @type {const} */ ('abcdefghijklmnopqrstuvwxyz0123456789')

/** A string's hyphen-separated parts, without empty ones, rejoined. */
const trimHyphens = (/** @type {string} */ s) => s.split('-').filter(part => part !== '').join('-')

/**
 * Where production is published: the origin of every absolute URL a build
 * of `main` gives of itself.
 *
 * @type {string}
 */
export const productionOrigin = 'https://functionalscript.com'

/**
 * A branch's preview alias, as the upload names it: lowercased, every run of
 * other characters a hyphen, cut to the DNS label's budget, with no hyphen at
 * either end. `null` for a branch with no usable alias, one that is empty or
 * does not begin with a letter, which the upload refuses.
 *
 * Different branch names can normalize to the same alias, as Workers Builds
 * aliases can; name preview branches distinctly.
 *
 * @type {(branch: string) => string | null}
 */
export const previewAlias = branch => {
    const alias = trimHyphens(trimHyphens(branch.toLowerCase().split('')
        .map(c => aliasCharacters.includes(c) ? c : '-')
        .join('')).slice(0, aliasBudget))
    return alias !== '' && aliasCharacters.slice(0, 26).includes(alias.slice(0, 1)) ? alias : null
}

/**
 * The origin a build of `branch` is published at, or `null` where nothing a
 * link can reach is.
 *
 * - `main` is production: the website workflow deploys production from a
 *   push to `main` alone.
 * - Any other branch is its preview, at its {@link previewAlias}. A fork's
 *   pull request uploads none, so its URL names a preview that does not
 *   exist; that is harmless, since nothing links it.
 * - A local build, which names no branch, and a branch with no alias have no
 *   origin.
 *
 * @type {(branch: string | null) => string | null}
 */
export const origin = branch => {
    if (branch === null) { return null }
    if (branch === 'main') { return productionOrigin }
    const alias = previewAlias(branch)
    return alias === null ? null : `https://${alias}-${workerName}.${workersSubdomain}`
}
