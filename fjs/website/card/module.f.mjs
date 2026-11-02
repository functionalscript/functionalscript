/**
 * A directory's card page: its README alone, laid out at the size of the
 * card image a shared link shows, for a browser to screenshot.
 *
 * **The README as its page shows it**, in the site's own stylesheet, so the
 * card cannot drift from the page. The header, the catalogue, the breadcrumb
 * and the footer are not on it; nor are the permalinks and buttons, which a
 * picture cannot use.
 *
 * **The whole README, faded at the bottom.** A card that stopped at the first
 * heading would be empty for a README whose intro is a line or none, so it
 * runs on, and what does not fit fades into the background rather than being
 * cut mid-line. The fade is always drawn: over a README that fits, it fades
 * the background into itself.
 *
 * **An image from another site gets five seconds.** One that has not loaded
 * by then, or fails, is removed before the picture is taken, so a slow badge
 * server costs the card its badge, never a broken image. The page says it is
 * ready through `window.cardReady`, which the screenshot step
 * ([`../cards.mjs`](../cards.mjs)) waits for.
 *
 * @module
 *
 * @import { Element, Node } from '../../media/html/types.ts'
 */

import { htmlDocument } from '../../media/html/module.f.mjs'
import { concat as pathConcat } from '../../path/module.f.js'
import { lang, readmeArticle, siteDescription, siteName } from '../page/module.f.mjs'
import { stylesheetLink } from '../style/module.f.js'

/**
 * The card's size in CSS pixels, at which it is also screenshot: 1200×630,
 * which the large cards of Facebook, X and LinkedIn show uncropped.
 */
export const cardSize = /** @type {const} */ ({ width: 1200, height: 630 })

/**
 * Where a directory's card page is written, beside its `index.html`.
 * Generated, so `_`-prefixed, as the card image beside it is.
 *
 * @type {(path: string) => string}
 */
export const cardPagePath = path => pathConcat(path)('_card.html')

/**
 * Where the generator lists the directories it wrote a card page for, as a
 * JSON array of their paths, which is what the screenshot step reads.
 *
 * @type {string}
 */
export const cardsPath = '_cards.json'

/**
 * The card's own rules, over the site's stylesheet: the card's size, the
 * margins trimmed to 40px above and 48px beside the text, the README's
 * reading width lifted so the two margins are even, and the fade.
 *
 * @type {string}
 */
const style = `body { margin: 0 }
[data-card] { box-sizing: border-box; height: ${cardSize.height}px; overflow: hidden; padding: 40px 48px 0; position: relative; width: ${cardSize.width}px }
[data-card]::after { background: linear-gradient(transparent, var(--bg)); bottom: 0; content: ""; height: 140px; left: 0; position: absolute; right: 0 }
[data-card] > [data-readme] { margin: 0; max-width: none }
[data-card] > [data-readme] > :first-child > :first-child { margin-top: 0 }
[data-card] :is([data-permalink], button) { display: none }`

/**
 * Waits for every image, five seconds at most, and removes one that did not
 * load; then for the fonts.
 *
 * @type {string}
 */
const script = `window.cardReady = Promise.all([...document.images].map(image =>
    Promise.race([image.decode(), new Promise((_, reject) => setTimeout(reject, 5000))])
        .catch(() => image.remove())))
    .then(() => document.fonts.ready)`

/**
 * What a directory's card shows, or `null` where it has no card: its
 * rendered README; at the root, which every other page's card falls back
 * to, the site's name and description where the README is not rendered.
 *
 * @type {(path: string) => (readme: readonly Element[]) => readonly Node[] | null}
 */
export const cardContent = path => readme => readmeArticle(readme)
    ?? (path === '.' ? [['h2', siteName], ['p', siteDescription]] : null)

/**
 * The card page showing `content`.
 *
 * @type {(content: readonly Node[]) => string}
 */
export const cardPage = content => htmlDocument(lang)(
    ['title', siteName],
    stylesheetLink,
    ['style', style],
)(
    ['div', { 'data-card': '' }, ['article', { 'data-readme': '' }, ...content]],
    ['script', script],
)
