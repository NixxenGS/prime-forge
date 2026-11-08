# Prime Forge

Two web apps for **Cortex Prime** that share one campaign server:

| App | Link | Who it's for |
| - | - | - |
| **Prime Forge** (GM app) | https://nixxengs.github.io/prime-forge/ | GMs. Design a setting's character file, build characters, run the GM table, and put settings online as campaigns. Works offline too. |
| **Prime Forge Players** | https://nixxengs.github.io/prime-forge/play/ | Players. Sign in, join campaigns with a room code, then build and play characters on any device. |

## How a campaign works

1. **GM:** in Prime Forge, open the **Online** tab and sign in with Google or an email and password. Pick a setting and press **Put it online**. You get a **room code**, for example `K7Q-M2X`.
2. **Players:** open the player app and sign in with Google or an email and password. On **Your campaigns**, type the room code and press **Join**. You can also send them the **join link**, which fills in the code.
3. Players build their characters from the GM's setting. The rules are locked for them, and anything the GM changes reaches them live.
   - Characters save to the campaign as people type and stay with each player's account. Signing in on another phone or computer brings everything back.
   - The GM sees every sheet live. The GM can edit any sheet, hand a character to a player, or hide NPCs from players.
   - Players see the party's sheets but can only change their own.
4. **Dice room:** while a campaign is online, the Dice tab becomes a shared room.
   - The GM taps a player and asks for a **Test**, a **Contest** or **Other**:
     - **Test:** the GM sets the difficulty by rolling difficulty dice or picking a static number. The player has to beat it.
     - **Contest:** whoever starts rolls first. Each side then has to beat the last total until someone fails or gives in. A player who gives in earns 1 plot point.
     - **Other:** a plain roll call, from the player alone or from both sides.
   - Each side builds and rolls their own pool on their own device, then presses **Lock in**. The app compares the totals and shows who won, including heroic successes.
   - A **Your roll** button lights up in the top bar for whoever has to roll next.
   - Only the GM rolls opposition. The player app has no opposition dice.
   - Every roll also appears under **Campaign rolls**. Each player can switch sharing off on the **Campaign** page.
5. GM tools:
   - **Let new players join** switches joining by code on or off.
   - **New code** retires the old code.
   - **Remove** takes a player out of the campaign.
   - **Close campaign** ends it for everyone. The GM keeps the setting and all characters in the vault.

**Accounts:** sign in the same way, with Google or the same email, on every device. If someone forgot their password, they can use **Forgot password?** on the sign-in screen.

## Files

| Path | What it is |
| - | - |
| `index.html` | The GM app, built from `dev/` |
| `play/index.html` | The player app, built from the same source |
| `firebase-config.js` | Firebase project settings (they aren't secret) |
| `firestore.rules` | Security rules to publish in Firebase |
| `vendor/` | Firebase's browser SDK (Apache 2.0) |
| `SETUP.md` | Firebase setup steps |
| `dev/` | Source, build script and tests |
