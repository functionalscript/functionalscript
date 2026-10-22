## GitHub diagram and model fences

**Priority:** P2
**Status:** open

README fences identified as `mermaid`, `geojson`, `topojson`, or `stl` are
accepted as ordinary code blocks. GitHub renders these as diagrams, maps, or
interactive models, so the generated page silently differs from GitHub.

Track these special identifiers and either render equivalent output or refuse
them with an explanatory README fallback. Cover each identifier and preserve
ordinary language-tagged fences. This issue records deferred work; no runtime
change is included in the PR update.

Related: [PR review comment](https://github.com/functionalscript/functionalscript/pull/3138#discussion_r4344579026)
and [GitHub diagram documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams).
