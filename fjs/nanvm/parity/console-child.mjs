/**
 * One console parity case, performed by the Node runner in a process of its
 * own, so that the standard streams are the ones the case is about:
 * `console.proof.mjs` writes its input and reads what it writes. The answers
 * go to the file named on the command line, since standard output is the
 * program's.
 *
 * `node console-child.mjs <case> <answers file>`
 */

import { writeFile } from 'node:fs/promises'

import { runNodeEffect } from '../../effects/node/module.mjs'
import * as cases from '../../../nanvm-harness/fixtures/console.mjs'

const [, , name, file] = process.argv
await writeFile(file, JSON.stringify(await runNodeEffect(/** @type {any} */ (cases)[name].run())))
