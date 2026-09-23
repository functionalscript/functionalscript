/**
 * The directory page: what one directory of the repository looks like as
 * HTML.
 *
 * **Every link is root-relative.** A page at `fjs/types/list/index.html` and
 * the root page write the same href for the same target, so a link is built
 * from the repository path alone and never from where the page happens to
 * sit. The stylesheet is already linked this way, and the demo runtime will
 * be for the same reason: a relative specifier is resolved against something,
 * and the page is not always that something.
 *
 * **Except a file a reader opens, when the build knows its commit.** The site
 * serves every file raw, which is right for a module a page imports and wrong
 * for one a person reads: no highlighting, and Markdown shown as its source.
 * Until this site has a source view of its own, GitHub is that view, so a
 * listed file links to it — at the commit the site was built from, not at a
 * branch, because a preview outlives its branch and a page's proofs ran that
 * exact commit. A build that does not know its commit keeps the raw link,
 * since a GitHub link to a commit nobody pushed opens nothing.
 *
 * The builder is split in two because the root page is not built here. It
 * carries the site's own heading and the browser test runner, so it takes
 * {@link sections} and keeps its own frame, while every other directory gets
 * the whole page from {@link page}. Both write the same three sections, which
 * is the property that matters — a reader moving between them sees one
 * catalogue, not two.
 *
 * @module
 *
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Dir, Proof } from './types.ts'
 */

import { htmlUtf8 } from '../../media/html/module.f.mjs'
import { faviconLinks, stylesheetLink } from '../style/module.f.mjs'

/**
 * The repository the site is built from, which is where a file is read when
 * the site cannot show it itself.
 *
 * @type {string}
 */
export const repository = 'https://github.com/functionalscript/functionalscript'

/**
 * The site's name, which the root page's title is on its own.
 *
 * @type {string}
 */
export const siteName = 'FunctionalScript'

/**
 * A page's `<title>`: what the page is, then the site it belongs to.
 *
 * **The site's name, because a title travels without the page.** It is the
 * headline of a search result, the label of a bookmark and of a link pasted
 * into a chat, and what a browser's history matches a search against. A
 * directory's path alone — `fjs/types` — says nothing there about which
 * project it belongs to.
 *
 * **The page first and the site last.** A browser narrows a tab by cutting
 * its title from the right, so with the site first every tab of this site
 * would read the same few letters; with it last, what is cut is the part
 * that is the same on every tab.
 *
 * @type {(page: string) => Element}
 */
export const pageTitle = page => ['title', `${page} · ${siteName}`]

/**
 * Where a run's results go: an empty container the runner fills with one
 * foldable group per module.
 *
 * **No longer a `pre` around one list.** Six thousand rows in one list gave a
 * reader no way to find the one that failed, and the `pre` was only there so a
 * failure's stack kept its lines — so the runner now gives each failure its own
 * `pre`, and every other row is ordinary text.
 *
 * @type {Element}
 */
const report = ['div', { 'data-test-results': '' }]

/**
 * The proofs of `dir`'s subtree, named the way a page at `dir` loads them.
 *
 * **A subtree is a prefix, and the test is on the separator** — `fjs/types/`
 * and not `fjs/types` — so `fjs/types_old/` is a different subtree rather
 * than a longer spelling of this one.
 *
 * **The name is page-relative, and that is the point.** A proof under
 * `fjs/types/list/` is `./proof.f.mjs` on that directory's page and
 * `./fjs/types/list/proof.f.mjs` at the root, which is exactly what `fjs t`
 * calls it when run from either place. Three spellings of one test is the
 * problem this repository has been removing, so a page's shorter list is the
 * same list said from where the page stands.
 *
 * @type {(dir: string) => (all: readonly Proof[]) => readonly Proof[]}
 */
export const subtree = dir => all => {
    const prefix = dir === '.' ? '' : `${dir}/`
    return all.flatMap(proof => proof.name.startsWith(prefix)
        ? [{ name: `./${proof.name.slice(prefix.length)}`, blockers: proof.blockers }]
        : [])
}

/**
 * The script that runs this page's proofs, with its own sources written into
 * it.
 *
 * **Each page carries its list rather than slicing a shared one.** Which
 * proofs belong to a subtree, and what they are called from here, is decided
 * by {@link subtree} — pure, and proven — so what reaches the browser is an
 * answer rather than the question. The alternative was one manifest module
 * every page fetched and filtered at run time, which puts that rule in a
 * string of impure JavaScript no proof can reach.
 *
 * Nothing starts on load: the runner is bound to the button, as
 * [browser-test-controls](../../emergent_testing/todo/browser-test-controls.md)
 * requires.
 *
 * @type {(sources: readonly string[]) => Element}
 */
const runner = sources => ['script', { type: 'module' },
    `import { startBrowserTestSources } from '/fjs/emergent_testing/browser/module.mjs'

const root = document.querySelector('[data-browser-tests]')
const sources = [
${sources.map(source => `    '${source}',`).join('\n')}
]
document.querySelector('[data-test-run]').addEventListener(
    'click',
    () => startBrowserTestSources(root, sources))
`]

/**
 * One proof in the section's list: its name, or its name and what stops a
 * browser linking it.
 *
 * **A blocked proof is marked**, because it is the one entry a run cannot
 * repeat. Once a run has results, every runnable entry is a group in the report
 * above and the stylesheet hides it; a blocked proof never produces a group, so
 * it stays — otherwise a green count would read as the whole subtree passing.
 *
 * **A runnable entry names its source in `data-source`**, for the same reason
 * one step later: a proof with no tests in it runs and produces no group
 * either. The runner reads these names after a run and marks the entries that
 * reported nothing, so they stay listed rather than vanish with the rest.
 *
 * @type {(proof: Proof) => Element}
 */
const proofItem = proof => proof.blockers.length === 0
    ? ['li', { 'data-source': proof.name }, proof.name]
    : ['li', { 'data-blocked': '' }, `${proof.name} — not linkable in a browser: ${proof.blockers.join(', ')}`]

/**
 * The demo section: what this module *does*, if it says.
 *
 * Two elements and nothing else. The section is the demo's own root, so the
 * runtime replaces its contents wholesale on every state; the script is the
 * page's half of the wiring, naming the module in `data-demo` so the runtime
 * never guesses a filename.
 *
 * @type {(path: string) => readonly Node[]}
 */
export const demoSection = path => [['details', { 'data-section': '', open: '' },
    ['summary', 'Demo'],
    ['div', { 'data-demo': path }],
    ['script', { type: 'module' },
        `import { startDemo } from '/fjs/website/demo-runtime.mjs'

startDemo(document.querySelector('[data-demo]'))
`],
]]

/**
 * The suite section: what this subtree proves, and the control that runs it.
 *
 * Omitted where the subtree has no proofs, like every other empty section — a
 * `Run` button over nothing is a control that lies about what it will do.
 *
 * **A proof a browser cannot link is named, not hidden**, with what stops it.
 * Dropping it would leave an empty list ambiguous between "nothing here" and
 * "nothing that runs here", and those are different facts about a directory.
 *
 * **The control follows what can run, not what exists.** Where every proof of
 * a subtree is blocked, the section keeps its list and its reasons and loses
 * the button: a run over an empty source list loads nothing, finds no
 * failures, and is reported `passed` — a plausible wrong value for a subtree
 * where nothing ran at all, which is the one answer this repository refuses
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * Reporting such a run as not-passing was the alternative; it is a change to
 * `reportOf`, which decides `fjs t`'s verdict too, for a case the command line
 * does not have.
 *
 * @type {(dir: Dir) => (intro: readonly Node[]) => readonly Node[]}
 */
export const testSection = dir => intro => {
    if (dir.proofs.length === 0) { return [] }
    /** @type {(title: Element) => (rest: readonly Node[]) => readonly Node[]} */
    const section = title => rest => [['details', { 'data-section': '', open: '' },
        title,
        ...intro,
        ...rest,
        // After the report, and marked, so the stylesheet can hide it once the
        // report has anything in it: from then on every source it names is a
        // group above it, and the list is the same names a second time.
        ['ul', { 'data-test-sources': '' }, ...dir.proofs.map(proofItem)],
    ]]
    const linkable = dir.proofs.filter(proof => proof.blockers.length === 0)
    if (linkable.length === 0) { return section(['summary', 'Emergent Testing'])([]) }
    // **The run's counts go in the title**, so they stay in sight with the
    // section folded. The slot is there only where something can run: a title
    // waiting for counts over a suite with no control would wait for ever.
    return section(['summary', 'Emergent Testing', ['span', { 'data-test-counts': '' }]])([
        ['p', { 'data-test-summary': '' }, 'Idle. Press Run to start the suite.'],
        ['button', { type: 'button', 'data-test-run': '' }, 'Run'],
        report,
        runner(linkable.map(proof => proof.name)),
    ])
}

/**
 * A repository path as a URL path: each segment percent-encoded, the
 * separators kept.
 *
 * **A file name is not a URL.** A space, `#`, `?` or `%` in one would end the
 * path, start a fragment or a query, or read as an escape, and the link would
 * go somewhere else without anything saying so. None of the tree's paths has
 * such a character today, which is exactly when a rule is cheap to have: the
 * first one to arrive would otherwise be a broken link on its page.
 *
 * Segment by segment rather than the path whole, because `/` is the one
 * character that must survive, and `encodeURIComponent` encodes it.
 *
 * @type {(path: string) => string}
 */
const urlPath = path => path.split('/').map(encodeURIComponent).join('/')

/**
 * The page for a directory path, as a root-relative URL.
 *
 * The root's page is `/index.html` rather than `/./index.html`: `'.'` is the
 * path of the repository root, and a URL says that by having no segments at
 * all.
 *
 * @type {(path: string) => string}
 */
export const pageHref = path => path === '.' ? '/index.html' : `/${urlPath(path)}/index.html`

/**
 * A file in a directory, as a reader opens it: on GitHub at `commit`, or
 * root-relative on this site when there is no commit to link.
 *
 * Only the links a person follows go through here. A page's proofs and its
 * demo are imported by the browser from this site, and pointing those at
 * GitHub would not load them.
 *
 * @type {(commit: string | null) => (path: string) => (name: string) => string}
 */
const fileHref = commit => path => name => {
    const file = urlPath(path === '.' ? name : `${path}/${name}`)
    return commit === null ? `/${file}` : `${repository}/blob/${commit}/${file}`
}

/**
 * One section of a page: a heading a reader can fold the section away under,
 * or nothing at all when the list is empty.
 *
 * **A disclosure rather than a heading and a list.** `details` and `summary`
 * are the collapsible the platform already has, so folding a long list away
 * costs the page no script — which matters here, where the whole site is
 * static files served from the repository folder.
 *
 * An empty section is omitted rather than rendered collapsed, so a page says
 * only what is true of its directory: no "Files" to open on a directory that
 * groups others, and no "Issues" where none are filed.
 *
 * @type {(heading: string) => (open: boolean) => (items: readonly Element[]) => readonly Node[]}
 */
const section = heading => open => items =>
    items.length === 0
        ? []
        : [['details', { 'data-section': '', open: open ? '' : undefined },
            ['summary', heading],
            ['ul', ...items]]]

/** @type {(href: string) => (text: string) => Element} */
const item = href => text => ['li', ['a', { href }, text]]

/**
 * The catalogue of one directory: its subdirectories, its files, and the
 * issues filed against it.
 *
 * **Directories come before files**, as GitHub and a file manager list
 * them: a directory is where a reader goes next, and a file is where the
 * reading stops, so the way deeper is what the page leads with.
 *
 * **Directories and files are open, issues are closed.** The first two are
 * what the directory *is* and are bounded by it; the issue list is not — the
 * repository root has fifty — and a page that opened it would push whatever
 * follows off the screen. That is a judgement per section and not a length
 * threshold, so it holds for every directory rather than switching at some
 * size.
 *
 * The root page inserts these into its own frame; {@link page} wraps them in
 * one. Nothing here depends on which of the two is calling.
 *
 * `commit` is where files are read — see {@link fileHref}.
 *
 * @type {(commit: string | null) => (dir: Dir) => readonly Node[]}
 */
export const sections = commit => dir => [
    ...section('Directories')(true)(dir.dirs.map(name =>
        item(pageHref(dir.path === '.' ? name : `${dir.path}/${name}`))(`${name}/`))),
    ...section('Files')(true)(dir.files.map(name =>
        item(fileHref(commit)(dir.path)(name))(name))),
    ...section('Issues')(false)(dir.todo.map(name =>
        item(fileHref(commit)(dir.path)(`todo/${name}`))(name))),
]

/**
 * The path to each ancestor of `path`, root first, paired with the name to
 * show for it. The directory itself is not included: a page does not link to
 * itself.
 *
 * @type {(path: string) => readonly (readonly [string, string])[]}
 */
const ancestors = path => {
    const segments = path.split('/')
    return [
        /** @type {const} */ (['.', 'root']),
        ...segments.slice(0, -1).map((name, at) =>
            /** @type {const} */ ([segments.slice(0, at + 1).join('/'), name])),
    ]
}

/**
 * The whole page for a directory below the root: where it sits, what it
 * holds, and what is open against it.
 *
 * @type {(commit: string | null) => (dir: Dir) => Vec}
 */
export const page = commit => dir => htmlUtf8(
    pageTitle(dir.path),
    stylesheetLink,
    ...faviconLinks,
)(
    ['main', { 'data-browser-tests': '', 'data-state': 'idle' },
        ['nav', ...ancestors(dir.path).flatMap(([path, name], at) => {
            /** @type {Element} */
            const link = ['a', { href: pageHref(path) }, name]
            return at === 0 ? [link] : [' / ', link]
        })],
        ['h1', dir.path],
        ...sections(commit)(dir),
        ...(dir.demo === null ? [] : demoSection(dir.demo)),
        ...testSection(dir)([]),
    ],
)
