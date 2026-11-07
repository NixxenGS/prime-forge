# Prime Forge (GitHub Pages site + source)

Prime Forge is a single-file vanilla JS companion app for **Cortex Prime**. It is built for NixxenGM, who runs and designs TTRPGs. The site is served from this repo's root by GitHub Pages at https://nixxengs.github.io/prime-forge/.

## Layout
- `index.html` is the published app. **Never edit it by hand.** It is written by `dev/build.py`.
- `firebase-config.js` holds the Firebase project settings (`prime-forge-15bde`). `firestore.rules` holds the security rules, which have to be pasted into the Firebase console by hand.
- `vendor/` contains the Firebase compat SDK 10.12.2 (app, auth, firestore), copied unchanged from npm.
- `dev/` is the source:
  - `src/index.html`, `src/styles.css` and `src/js/*.js`, concatenated in filename order
  - `fonts/`, inlined as base64

## Build and test
```
cd dev
python build.py        # writes dev/dist/prime-forge.html and refreshes ../index.html
python test/t1.py      # ... t6.py; each should end with "no errors"
```
- `t1`–`t4` test the offline app.
- `t5` runs a GM and several players in separate browsers against `test/fake/server.js`. That fake mirrors Firebase Auth, Firestore and `firestore.rules`, so if you change the rules, change the fake to match.
- `t6` serves the site over http and checks that the real SDK loads from `vendor/`.
- Setup: `pip install playwright`, then `playwright install chromium`. `t5` also needs Node.

## Online layer (`src/js/19-online.js`)
- A table is a normal setting plus characters in `DB`, marked with `S.table` / `c.table`, so every existing view keeps working.
- `save()` calls `netAfterSave()`. `netScan` then pushes changed JSON for the setting (GM only) and for characters the current user can write.
- Snapshots apply remote changes. Conflicts are last-write-wins by `updated`.
- Firestore docs:
  - `tables/{tid}` holds `gm`, `name`, `open`, `closed` and `settingJson`.
  - Its subcollections are `members/{uid}`, `chars/{cid}` (`owner`, `hidden`, `json`) and `rolls/{id}`.
  - `users/{uid}.tables` is how a Google-linked account finds its tables.
- The table id is the invite capability. Tables can't be listed.
- Viewing another player's character renders read-only (`VIEW_RO` and `RO_OK` in `10-shell.js`).

## Decisions the user made (keep these)
- No presets: settings are built from scratch and can be saved.
- Character creation tracks and warns about budgets but never blocks.
- There is a locked player mode.
- Online play is an always-on Firebase table hosted on GitHub Pages. Players need no accounts.
- Rules text is short paraphrase with handbook page refs, never quotes.

## Conventions
- Light "Handbook" theme and dark "Neon" theme, defined as CSS tokens. Dice are SVG via `dieSvg`.
- Wrap every localStorage access in try/catch. The key is `primeforge.v1`.
- Breakpoints are 1180, 960 and 600px. There must be no horizontal scroll at 390px.
