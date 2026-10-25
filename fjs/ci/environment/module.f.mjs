/** Tool-independent command assembly before manager selection. @module
 * @import { MetaStep } from '../common/types.ts'
 */
import { test } from '../common/module.f.mjs'
/** Internal argv boundary replaced by the manager adapter. */
export const commandPrefix = 'env '
/** @type {(command: string) => string} */
export const environmentCommand = command => `${commandPrefix}${command}`
/** @type {(commands: readonly string[]) => readonly MetaStep[]} */
export const environmentSteps = commands => commands.map(command => test({ run: environmentCommand(command) }))
/** @type {(command: string, expected: string) => MetaStep} */
export const environmentVersionStep = (command, expected) => test({ run: `test "$(${environmentCommand(command)})" = "${expected}"` })
