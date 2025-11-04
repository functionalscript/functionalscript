import { test } from '@playwright/test'

test('sample test', async () => {
    if (1 + 1 !== 2) {
        throw new Error('Math is broken')
    }
})
