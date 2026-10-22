/**
 * The schemas of [`README.md`](./README.md), the files and responses the
 * tooling and the website read, as the page's demo and the module page's demo
 * show them: each imported from the module that declares it, with a value it
 * accepts.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { projectSchema } from '../../../schema-demo/module.f.mjs'
import { gitHubActionSchema } from '../../../../ci/common/module.f.mjs'
import { jobTimeout } from '../../../../ci/config/module.f.js'
import { fundingSchema } from '../../../../website/funding/module.f.mjs'
import { pullsSchema } from '../../../../website/prs/module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'GitHub Actions workflow',
        about: 'A workflow as this repository generates it. Closed: CI reads its own generated workflows back, so a key the schema does not name is generator drift.',
        schemas: projectSchema('gitHubActionSchema', 'ci/common', gitHubActionSchema),
        value: `export default {"name":"CI","on":{"pull_request":{}},"permissions":{"contents":"read"},"jobs":{"test":{"runs-on":"ubuntu-latest","timeout-minutes":${jobTimeout},"steps":[{"uses":"actions/checkout@v5"},{"run":"npm test"}]}}};`,
    },
    {
        name: 'Funding channels',
        about: 'funding.json as the site footer reads it: only the funding channels. open() at every level, because the format carries much more and none of it is the footer\'s business.',
        schemas: projectSchema('fundingSchema', 'website/funding', fundingSchema),
        value: 'export default {"version":"v1.0.0","funding":{"channels":[{"guid":"github","type":"other","address":"https://github.com/sponsors/sergey-shandar","description":"GitHub Sponsors"}]}};',
    },
    {
        name: 'Open pull requests',
        about: 'The open pull requests as the site\'s PR page reads them from the GitHub API. open() at every object, so a field GitHub adds does not change what the page accepts; user is null for a deleted account.',
        schemas: projectSchema('pullsSchema', 'website/prs', pullsSchema),
        value: 'export default [{"number":3174,"user":{"login":"sasha-gil"},"draft":false,"head":{"sha":"bb979ee"},"title":"rtti: review fixes"}];',
    },
]
