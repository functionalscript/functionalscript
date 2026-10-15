/**
 * The programs every compiler stage's demo offers in its examples drop-down.
 *
 * **One flat list for all six pages**, so a program picked on the
 * tokenizer's page can be found by the same name on the parser's, the EDAG's,
 * the serializer's, the Rust page and the side-by-side page — one program
 * followed down the pipeline, not six unrelated lists. Each demo offers the
 * whole list; none re-spells a program.
 *
 * **The first is the overview, and every page opens on it.** It carries one
 * of everything one program can hold — a `const` referenced six times, once
 * lazily; an unused `const` the compiler anchors; a function with a rest
 * parameter; numbers and `undefined` where a value sits — so each page
 * shows its central property before a reader has picked anything. It has no
 * import, which every output and the serializer would refuse, so no page
 * opens on a refusal.
 *
 * **A refused program is an example too.** `"\x41"` is valid JavaScript the
 * front end refuses today, and an import has no file set in a browser, so
 * the Rust output refuses it. Showing the refusal is the cheapest
 * regression table there is, and a demo's proof walks this list, so one that
 * stops behaving as its name says fails a test. Which stage refuses which
 * program differs — the parser takes an import the Rust output cannot link —
 * so a name says what the program is, and each demo's proof says what its
 * stage refuses.
 *
 * **The list follows the areas of [the specification tree](../../../spec/todo/spec-tree.md)**,
 * each under a numbered comment, so that when a page takes over its examples
 * the move is a cut and paste. A new program joins the area it belongs to.
 *
 * @module
 *
 * @import { Examples } from './types.ts'
 */

import principles from '../../../spec/principles/module.f.js'
import lexical from '../../../spec/lexical/module.f.js'
import values from '../../../spec/values/module.f.js'
import modules from '../../../spec/modules/module.f.js'
import bindings from '../../../spec/bindings/module.f.js'
import operators from '../../../spec/operators/module.f.js'
import conversions from '../../../spec/conversions/module.f.js'
import propertyAccess from '../../../spec/property-access/module.f.js'
import functions from '../../../spec/functions/module.f.js'
import controlFlow from '../../../spec/control-flow/module.f.js'
import builtIns from '../../../spec/built-ins/module.f.js'

/** The programs an area's pages own, in page order. @type {(area: Readonly<Record<string, Examples>>) => Examples} */
const own = area => Object.values(area).flat()

/** @type {Examples} */
export const examples = [
    // 1. Principles
    ...own(principles),
    // 2. Lexical Grammar
    ...own(lexical),
    // 3. Values
    ...own(values),
    // 4. Modules
    ...own(modules),
    // 5. Bindings
    ...own(bindings),
    // 6. Operators
    ...own(operators),
    // 7. Conversions
    ...own(conversions),
    // 8. Property Access
    ...own(propertyAccess),
    // 9. Functions
    ...own(functions),
    // 10. Control Flow
    ...own(controlFlow),
    // 11. Built-ins
    ...own(builtIns),
]
