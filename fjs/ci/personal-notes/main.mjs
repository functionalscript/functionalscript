/** GitHub Actions process boundary for the personal-notes approval. */

import { reviewPersonalNotes } from './github.mjs'

try {
    const done = await reviewPersonalNotes({
        token: process.env.GITHUB_TOKEN ?? '',
        eventPath: process.env.GITHUB_EVENT_PATH ?? '',
    })
    console.log(`Personal notes: ${done}.`)
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
}
