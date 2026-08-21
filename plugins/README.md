# dsh plugins

Third-party DeepSeek Harness plugin sources, tracked as regular directories in this repository's `master` branch.
Each plugin directory is installed into `~/.dsh/profiles/web` via pnpm `link:`.

## Layout

| directory | package name | upstream |
| --- | --- | --- |
| `dsh-mobile-nav` | `@dsh-external/dsh-mobile-nav` | https://github.com/mexiaosqwq/dsh-web-mobile |
| `dsh-better-sidebar` | `dsh-better-sidebar` | https://github.com/omdsh-dev/DSH-better-sidebar |
| `dsh-client-auto-continue` | `dsh-client-auto-continue` | https://github.com/HsiangNianian/dsh-auto-continue |
| `dsh-codex-auth` | `dsh-codex-auth` | https://github.com/suntianc/dsh-codex-auth |
| `dsh-cot-profile` | `dsh-cot-profile` | https://github.com/Chloride233/dsh-cot-profile |
| `dsh-mobile-back` | `dsh-mobile-back` | local source (no upstream) |
| `dsh-passwords` | `dsh-passwords` | https://github.com/slywalker2006/dsh-passwords |
| `dsh-worktree-panel` | `dsh-worktree-panel` | https://github.com/HeathHe/dsh-worktree-panel |

## Runtime module resolution

`plugins/node_modules` is a symlink to `~/.dsh/profiles/node_modules`
(the dsh-healed module fallback). It is git-ignored; recreate it on a new machine:

```bash
ln -s ~/.dsh/profiles/node_modules node_modules
```

## Upstream sync

Each upstream is a `git subtree` (squashed) at the paths above. Remotes use the
`upstream-<name>` convention; prefix paths are relative to this repository root.

```bash
GIT_EDITOR=true git subtree pull -P plugins/dsh-mobile-nav upstream-mobile-nav main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-better-sidebar upstream-better-sidebar main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-client-auto-continue upstream-auto-continue main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-codex-auth upstream-codex-auth main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-cot-profile upstream-cot-profile main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-passwords upstream-passwords main --squash
GIT_EDITOR=true git subtree pull -P plugins/dsh-worktree-panel upstream-worktree-panel main --squash
```

## Build after editing

```bash
# per-plugin, when it has a build script
cd ~/i/dsh/plugins/<plugin>
pnpm install   # or npm install for npm-based plugins
pnpm run build # or npm run build

# dsh-passwords is npm-based; this shell exports NODE_ENV=production,
# so dev dependencies need an explicit development install:
cd ~/i/dsh/plugins/dsh-passwords
NODE_ENV=development npm install
NODE_ENV=development npm run build

# reload the dsh web profile
systemctl --user restart dsh-web.service
```

## dsh-passwords local state

`dsh-passwords/.env` and `dsh-passwords/data/` are git-ignored. They are copied
from `~/dsh-passwords` and must never be committed. Refresh the database with
`node:sqlite` `backup()` while the old gateway is still live before restarting dsh.
