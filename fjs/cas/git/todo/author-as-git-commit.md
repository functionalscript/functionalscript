## The author is read from less than `git commit` reads

**Priority:** P4
**Status:** open

### Problem

`configuredAuthor` in [`fjs/cas/git`](../module.f.mjs) reads `user.name` and
`user.email` from the repository's `config` and then `~/.gitconfig`, and
refuses a `config` holding an `[include]` or `[includeIf]`. `git commit`
reads more, and strips more:

- `$GIT_DIR/config.worktree`, where `extensions.worktreeConfig` is set and
  the identity was given with `git config --worktree`; this reads the
  common directory's `config` and not the worktree's, so such an identity
  is not seen, and `~/.gitconfig`'s is used where it names one;
- the system file and `$XDG_CONFIG_HOME/git/config`, which an identity set
  only there lives in;
- leading and trailing characters Git calls crud — whitespace, `.`, `,`,
  `:`, `;`, `"`, `'`, `\` — which `fmt_ident` strips from the name and the
  email, so a quoted `user.name = " A "` commits as `A` under Git and as
  ` A ` here.

Each is a commit by a different author than `git commit` would write from
the same configuration, or a refusal where `git commit` would commit.

### Proposal

Read what Git reads, in Git's order, or refuse what is not read as the
includes are refused: `extensions.worktreeConfig` set in the repository's
`config` is a refusal the same two lines make. Stripping the crud
characters as `fmt_ident` does is a few lines in `configuredAuthor`, with a
proof per character. The system and XDG files need the environment
(`XDG_CONFIG_HOME`, `GIT_CONFIG_SYSTEM`) that
[DESIGN.md §7](../../../../doc/DESIGN.md#7-cli-parameters-over-environment-variables)
keeps out of this backend; they stay unread unless a consumer needs them.

### Tasks

- [ ] Refuse `extensions.worktreeConfig` in the repository's `config`, or
      read `config.worktree` where the `Branch` carries the worktree's
      directory.
- [ ] Strip the crud characters from both ends of each value as `fmt_ident`
      does, and refuse a value that is empty once stripped.
