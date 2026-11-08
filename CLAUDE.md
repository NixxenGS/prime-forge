# Prime Forge (GitHub Pages site + source)

Prime Forge is a pair of single-file vanilla JS apps for **Cortex Prime**, built for NixxenGM, who runs and designs TTRPGs. GitHub Pages serves them from this repo:
- **GM app** at https://nixxengs.github.io/prime-forge/ (`index.html`). It holds the vault, designer, characters, GM table and the Online tab.
- **Player app** at https://nixxengs.github.io/prime-forge/play/ (`play/index.html`). Players sign in with Google or email and password, then join campaigns by room code. It has a dashboard of joined campaigns, plus Characters, Dice, Setting guide and Campaign pages. It has no vault and no designer.

Both apps are the same source built twice with `const APP_MODE = 'gm' | 'play'`.

## Layout
- `index.html` and `play/index.html` are the published apps. **Never edit them by hand.** They are written by `dev/build.py`.
- `firebase-config.js` holds the Firebase project settings (`prime-forge-15bde`). `firestore.rules` holds the security rules, which have to be pasted into the Firebase console by hand.
- `vendor/` contains the Firebase compat SDK 10.12.2 (app, auth, firestore), copied unchanged from npm.
- `dev/` is the source:
  - `src/index.html`, `src/styles.css` and `src/js/*.js`, concatenated in filename order
  - `fonts/`, inlined as base64

## Build and test
```
cd dev
python build.py        # writes dev/dist/prime-forge.html + play.html and refreshes ../index.html + ../play/index.html
python test/t1.py      # ... t6.py; each should end with "no errors"
```
- `t1`–`t4` test the offline app.
- `t5` runs the GM app and several player-app browsers over http against `test/fake/server.js`. It covers sign-up, Google, room codes, a second device, sign-out wipe and permissions. That fake mirrors Firebase Auth, Firestore and `firestore.rules`, so if you change the rules, change the fake to match.
- `t6` serves the site over http and checks that the real SDK loads from `vendor/` in both apps.
- Setup: `pip install playwright`, then `playwright install chromium`. `t5` also needs Node.

## Online layer (`src/js/19-online.js`, player shell in `20-play.js`)
- Accounts are Google or email and password only. Anonymous sessions are signed out, and the rules refuse them.
- On sign-out or account switch, the player app wipes its local copy (`netWipeLocal`). Its storage key is `primeforge.play.v1`.
- Room codes live at `codes/{CODE}` (6 chars from `CODE_AL`) → `{ table, gm }`. They are get-only, so codes can't be listed.
- The GM app only watches campaigns where the user is GM. The player app watches only campaigns where they are a player.
- A table is a normal setting plus characters in `DB`, marked with `S.table` / `c.table`, so every existing view keeps working.
- `save()` calls `netAfterSave()`. `netScan` then pushes changed JSON for the setting (GM only) and for characters the current user can write.
- Snapshots apply remote changes. Conflicts are last-write-wins by `updated`.
- Firestore docs:
  - `tables/{tid}` holds `gm`, `name`, `open`, `closed` and `settingJson`.
  - Its subcollections are `members/{uid}`, `chars/{cid}` (`owner`, `hidden`, `json`) and `rolls/{id}`.
  - `users/{uid}` holds `{ name, tables }`, which is how an account finds its campaigns on any device.
- Tables can't be listed. Players reach a table through its room code.
- Viewing another player's character renders read-only (`VIEW_RO` and `RO_OK` in `10-shell.js`).

## Decisions the user made (keep these)
- No presets: settings are built from scratch and can be saved.
- Character creation tracks and warns about budgets but never blocks.
- There is a locked player mode.
- Online play is an always-on Firebase campaign hosted on GitHub Pages.
- There are separate GM and player apps. Players sign in with Google or email and password, and their characters stay with their account across devices.
- Rules text is short paraphrase with handbook page refs, never quotes.

## Conventions
- Light "Handbook" theme and dark "Neon" theme, defined as CSS tokens. Dice are SVG via `dieSvg`.
- Wrap every localStorage access in try/catch. The key is `primeforge.v1`.
- Breakpoints are 1180, 960 and 600px. There must be no horizontal scroll at 390px.
