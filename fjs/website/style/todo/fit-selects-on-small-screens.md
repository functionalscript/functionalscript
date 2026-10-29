## Fit selects on small screens

**Priority:** P3
**Status:** wip

### Problem

A native select sizes itself to its longest option. The RTTI demo's
`Compare with` field makes the page scroll horizontally on a phone, even
when the selected option is short.

At `af52cc8c`, Chromium at a 390px viewport measures the comparison select
at 552px and the page at 568px. Open `/fjs/rtti/` to reproduce it. The
initial view and the views after choosing `Absent vs undefined` and
clearing the comparison serialize identically to `442ea8f9`, so this
predates the shared select widgets.

### Proposal

Constrain selects to their containing column in the shared stylesheet,
while preserving the native menu and accessible label. Check long option
labels and option groups in both light and dark modes.

### Tasks

- [ ] Fit the comparison select within the phone viewport.
- [ ] Check the other demo selects at phone and desktop widths.

### Related

- [Widget extraction and browser verification](https://github.com/functionalscript/functionalscript/pull/3299)
