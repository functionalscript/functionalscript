import { runEffect } from '../effects/node/module.ts'
import { register } from './module.f.ts'

// we need `await` for Playwright.
await runEffect(register)
