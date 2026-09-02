## GitHub color modes

**Priority:** P3
**Status:** blocked
**Blocked by:** [Command output: one design for every destination](../../todo/command-output.md)

> **Why blocked.** These are three cells of one product — transport, annotation
> style and colour — named as three modes. The first of them, a *coloured* log
> on GitHub's non-TTY stream, is the case that forces those to be separate
> axes, so this issue is an input to the epic rather than a task under it.

Support at least three output modes:

- [ ] GitHub CI: colored log
- [ ] non-GitHub, `isTTY`: colored progress bar
- [ ] non-GitHub, non-`isTTY`: non-colored log
