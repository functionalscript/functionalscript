## Pull requests page

**Priority:** P2
**Status:** wip

Add a page to functionalscript.com displaying current pull requests from
`functionalscript/functionalscript`.

The requested columns are PR number linked to GitHub, author, and status.
Status includes open/draft state and CI/check results. Load on opening; use a
Refresh button and no timer.

## Tasks

- [ ] Add the page and navigation using the existing website generator.
- [ ] Fetch public GitHub PRs and checks, with explicit loading and failures.
- [ ] Prove the new logic and run the repository check set.
