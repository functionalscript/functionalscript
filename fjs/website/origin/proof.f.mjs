import { assertEq } from '../../asserts/module.f.js'
import { origin, previewAlias, productionOrigin } from './module.f.js'

export const proof = {
    previewAlias: {
        // Lowercased, punctuation to one hyphen, none at either end.
        normalizes: () => {
            assertEq(previewAlias('codex/cloudflare-deploy-job'), 'codex-cloudflare-deploy-job')
            assertEq(previewAlias('Feature/A_1..B'), 'feature-a-1-b')
            assertEq(previewAlias('--hello--'), 'hello')
            assertEq(previewAlias('你好/world'), 'world')
        },
        // Cut to the label's budget, and no hyphen left at the cut.
        budget: () => assertEq(previewAlias(`${'a'.repeat(45)}-b`), 'a'.repeat(45)),
        // The upload refuses these, so they have no alias.
        startsWithDigit: () => assertEq(previewAlias('123-feature'), null),
        empty: () => assertEq(previewAlias('---'), null),
    },
    origin: {
        production: () => assertEq(origin('main'), productionOrigin),
        // The URL the preview comment links, for the same branch.
        preview: () => assertEq(origin('claude/link-previews-meta'),
            'https://claude-link-previews-meta-functionalscript.functionalscript.workers.dev'),
        local: () => assertEq(origin(null), null),
        noAlias: () => assertEq(origin('123'), null),
    },
}
