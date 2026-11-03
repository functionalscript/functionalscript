import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { readmeSection } from '../readme/module.f.mjs'
import { siteDescription, siteName } from '../page/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { cardContent, cardPage, cardPagePath, cardSize, cardsPath } from './module.f.mjs'

const rendered = readmeSection('README.md')(ok([['h2', 'Crypto'], ['p', 'Hashes.']]))
const refused = readmeSection('README.md')(error('a table'))

export const proof = {
    // Beside the directory's page, and the root's at the root.
    paths: () => {
        assertEq(cardPagePath('fjs/crypto'), 'fjs/crypto/_card.html')
        assertEq(cardPagePath('.'), '_card.html')
        assertEq(cardsPath, '_cards.json')
        assertStructurallySame(cardSize, { width: 1200, height: 630 })
    },
    content: {
        // A rendered README is what the card shows.
        readme: () => assertStructurallySame(cardContent('fjs/crypto')(rendered), [['h2', 'Crypto'], ['p', 'Hashes.']]),
        // A directory without one, or whose README is refused, has no card.
        none: () => {
            assertEq(cardContent('fjs/crypto')([]), null)
            assertEq(cardContent('fjs/crypto')(refused), null)
        },
        // The root always has one, since every other page falls back to it.
        root: () => {
            assertStructurallySame(cardContent('.')(rendered), [['h2', 'Crypto'], ['p', 'Hashes.']])
            assertStructurallySame(cardContent('.')(refused), [['h2', siteName], ['p', siteDescription]])
        },
    },
    // The README in the site's stylesheet, sized, and ready once its images are.
    page: () => {
        const html = cardPage([['h2', 'Crypto']])
        assert(html.includes('<link rel="stylesheet" href="/_main.css">'), html)
        assert(html.includes('<div data-card=""><article data-readme=""><h2>Crypto</h2></article></div>'), html)
        assert(html.includes('height: 630px') && html.includes('width: 1200px'), html)
        assert(html.includes('window.cardReady'), html)
    },
}
