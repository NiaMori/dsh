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

Each upstream is fetched through the `upstream-<name>` remotes. To vendor-sync
one plugin, overlay the upstream tree onto the tracked directory, review the
diff, re-apply any local modifications, and commit:

```bash
git fetch upstream-better-sidebar main
mkdir -p /tmp/upstream-better-sidebar
git archive FETCH_HEAD | tar -x -C /tmp/upstream-better-sidebar
rsync -a --delete /tmp/upstream-better-sidebar/ plugins/dsh-better-sidebar/
git diff --stat plugins/dsh-better-sidebar
git add plugins/dsh-better-sidebar
git commit -m "chore(plugins): sync dsh-better-sidebar with upstream main"
```

`rsync --delete` removes plugin-local files that upstream deleted; review
`git status` and restore any intentional local files before committing.

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
