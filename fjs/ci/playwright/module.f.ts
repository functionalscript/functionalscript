/**
 * CI job that runs the Playwright suite against Chromium, Firefox, and WebKit
 * inside an OCI image built from the job's generated Nix flake.
 *
 * @module
 */
import { node, playwright } from '../config/module.f.ts'
import { type Job, type MetaStep, test, ubuntuArm } from '../common/module.f.ts'
import { major, nixSystem } from '../node/module.f.ts'
import { nixInstall, nodeVersionCommand, ociLoad, ociRunAll, type NixJob, type NixOci } from '../nix/module.f.ts'

const browsers = ['chromium', 'firefox', 'webkit'] as const

/**
 * The image the job's commands run in.
 *
 * A development shell borrows the runner's shell, its core utilities, and its
 * certificate bundle; an image starts empty, so the environment declares them.
 * The Node the job uses is not repeated here — the generator copies the shell's
 * `packages` into the image as well, so both entry points provide the same
 * runtime.
 */
const playwrightOci: NixOci = {
    name: 'functionalscript-playwright',
    contents: [
        ['bashInteractive'],
        ['coreutils'],
        // `/bin/sh` for the shells `npm` starts for lifecycle scripts, and
        // `/usr/bin/env` for `#!` lines.
        ['dockerTools', 'binSh'],
        ['dockerTools', 'usrBinEnv'],
        // `npm` reaches the registry over TLS, and Chromium, Firefox, and
        // WebKit load pages the same way.
        ['dockerTools', 'caCertificates'],
        // `/etc/passwd` and `/etc/group`, which the browsers read at startup.
        ['dockerTools', 'fakeNss'],
    ],
    workDirectory: 'workspace',
}

/**
 * The Playwright job's environment: the same Node the other jobs use, plus
 * Nixpkgs' prebuilt browser bundle.
 *
 * `pkgs.playwright-driver.browsers` is a link farm of Chromium, Firefox, and
 * WebKit builds already patched for the Nix store, so pointing Playwright at it
 * replaces both `playwright install` (the browser download) and
 * `playwright install-deps` (the `apt-get` run for their shared libraries) —
 * the two steps that made this the slowest job in the matrix.
 *
 * It only works because `../config/module.f.ts` pins `playwright` to the exact
 * version `playwright-driver` carries at the pinned Nixpkgs commit: Playwright
 * refuses browsers whose revision does not match its own.
 */
export const playwrightNixJob: NixJob = {
    id: 'playwright',
    system: nixSystem,
    packages: [`nodejs_${major(node.default)}`],
    oci: playwrightOci,
    env: {
        PLAYWRIGHT_BROWSERS_PATH: ['pkgs', 'playwright-driver', 'browsers'],
        // `@playwright/test`'s postinstall would otherwise download a second
        // copy of the browsers the store path above already provides.
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: ['string', '1'],
        // Nixpkgs' WebKit build is the one published for Ubuntu 24.04; without
        // this, Playwright looks up a revision for the runner's own newer
        // release and finds nothing.
        PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: ['string', 'ubuntu-24.04'],
    },
}

// `npx` runs the `@playwright/test` version `package.json` pins, rather than
// whatever else may be on `PATH`.
const playwrightVersionCommand =
    `test "$(npx playwright --version)" = "Version ${playwright}"`

const commands: readonly string[] = [
    // The image supplies its own Node, so the job states the version
    // expectation the shared `nix-flakes` job states for the others.
    nodeVersionCommand(node.default),
    'npm ci',
    // The browsers come from the pinned Nixpkgs commit while `@playwright/test`
    // comes from `package.json`. They are pinned to the same version by hand, so
    // this is where the two are actually tied together.
    playwrightVersionCommand,
    ...browsers.map(browser => `npx playwright test --browser=${browser}`),
]

// Building and loading the image is its own step so the workflow log times it
// separately from the browser runs it wraps.
const steps: readonly MetaStep[] = [
    nixInstall,
    test({ run: ociLoad(playwrightNixJob.id) }),
    test({ run: ociRunAll(playwrightOci, commands) }),
]

export const playwrightJob: Job = ubuntuArm(steps)
