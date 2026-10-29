## Run repository checks on pull requests only

**Priority:** P2
**Status:** wip

The owner requested avoiding repeat tests and website builds in the merge
queue. Run test jobs and preview builds on PRs, and deploy the website on main
pushes. Keep the merge_group trigger so skipped jobs report the required check
names without allocating runners. Combined queue changes are not retested.

### Tasks

- [ ] Gate repository test jobs on pull_request and website on PR or main push.
- [ ] Update proofs, generated workflow and documentation.
