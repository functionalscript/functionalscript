import { runEffect } from '../io/module.ts'
import { register } from './module.f.ts'

// we need `await` for Playwright.
await runEffect(register)
