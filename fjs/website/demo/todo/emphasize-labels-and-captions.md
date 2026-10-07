## Emphasize demo labels and output captions

**Priority:** P3
**Status:** open

### Problem

The HMAC and PoW demos emphasize input labels and output captions, while
other demos do not share that presentation. The demo specification does not
yet establish a common rule, and the stylesheet uses demo-specific selectors.

### Proposal

Use bold input labels and output captions at the existing font size across
all demos, so readers can distinguish controls and results from surrounding
prose. Keep leads, explanatory text, progress summaries, and disclosure titles
regular. These labels and captions remain labels and paragraphs, not headings.

Document the rule in the demo README and implement it with shared styling for
labels and a common marker for output captions. Preserve meaningful exceptions,
such as controls embedded in prose, and explain them in the demo's JSDoc.

### Tasks

- [ ] Update the input and output rules in the demo README with the shared
      emphasis policy.
- [ ] Add shared label and caption styling, update all demos to use it, and
      remove the HMAC/PoW-specific bold rules and obsolete exception notes.
- [ ] Update affected view proofs, run the required checks, and verify the
      demos in light/dark themes and mobile layouts. Include affected preview
      links in the implementation PR.

### Related

- [Demo presentation specification](https://github.com/functionalscript/functionalscript/blob/main/fjs/website/demo/README.md)
  — the common input and output rules to update.
- [Website stylesheet](../../style/module.f.mjs) — the existing scoped emphasis
  rules to replace.
- [HMAC demo PR](https://github.com/functionalscript/functionalscript/pull/2617)
  and [PoW demo PR](https://github.com/functionalscript/functionalscript/pull/2621)
  — the presentation to generalize.
