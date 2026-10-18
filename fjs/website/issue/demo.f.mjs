/**
 * An issue's header, read as the site reads it and drawn as a directory's
 * page lists it: the status as the icon, the priority as a badge after it.
 *
 * **The output is the page's own entry**, `issueItem` in
 * [`../page`](../page/module.f.mjs), drawn by the site's stylesheet, so what
 * the demo shows is what a page shows rather than a picture of it.
 *
 * **Every status and every priority is drawn below the field**, in the order a
 * page lists them. No directory holds an issue of every status — nothing in
 * the tree is `irrelevant` or `won't fix` — so this is the one place a reader
 * sees the whole set, and the one a change to an icon is checked on.
 *
 * **A header that cannot be read is refused**, with the reader's own message,
 * as the build refuses it.
 *
 * **It needs no operations.** Reading a header is a pure function of the
 * text, so `update` declares `never` and returns its next state through
 * `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Issue } from './types.ts'
 */

import { header, priorities, statuses } from './module.f.mjs'
import { caption, refusal, textDemo } from '../demo/module.f.mjs'
import { issueItem, issueOrder } from '../page/module.f.mjs'

/**
 * Issues as a page lists them: in its order, each its own entry. The links go
 * nowhere — none of these issues is a file.
 *
 * @type {(issues: readonly Issue[]) => Element}
 */
const list = issues => ['ul', { 'data-links': '' }, ...issues.toSorted(issueOrder).map(issueItem('#'))]

/** Every status, each at the default priority. */
export const everyStatus = list(statuses.map(status => ({ name: `${status}.md`, status, priority: 'P3' })))

/** Every priority, each open. */
export const everyPriority = list(priorities.map(priority => ({ name: `${priority}.md`, status: 'open', priority })))

/**
 * The typed issue as a page lists it, or the refusal the build would stop on.
 *
 * @type {(text: string) => Element}
 */
export const shown = text => {
    const read = header(text)
    return read[0] === 'error' ? refusal(read[1]) : list([{ name: 'issue.md', ...read[1] }])
}

/**
 * The state is the text itself, not its header: the header is a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    intro: 'Reads the status and the priority from an issue\'s header and shows the issue as a directory\'s page lists it: the status as the icon, the priority as a badge after it. A note after " — " is not read; any other value is refused, as the site build refuses it.',
    name: 'issue',
    label: 'Issue',
    rows: 6,
    init: '## Show issue status and priority\n\n**Priority:** P3\n**Status:** wip — the icons are in review\n',
    examples: [
        ['Work in progress', '## Show issue status and priority\n\n**Priority:** P3\n**Status:** wip — the icons are in review\n'],
        ['Blocked', '## Property accessor\n\n**Priority:** P2\n**Status:** blocked\n**Blocked by:** [Operators](./2340-operators.md)\n'],
        ['Kept as the record', '## Inline type casts\n\n**Priority:** P2\n**Status:** done — kept as the record; cited by eslint.md\n'],
        ['A typo, refused', '## A typo\n\n**Priority:** P3\n**Status:** opne\n'],
    ],
})(text => [
    caption('As a page lists it:'),
    shown(text),
    caption('Every status, in the order a page lists them:'),
    everyStatus,
    caption('Every priority:'),
    everyPriority,
])
