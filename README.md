# Prime Forge

**Open it:** https://nixxengs.github.io/prime-forge/

Prime Forge is a companion app for **Cortex Prime**. Design a character file for any setting, build the characters who live in it, and play from the sheet. It includes dice pools, plot points, stress and a GM table. Everything saves in your browser. It also works offline: save `index.html` and open it from your computer.

## Play online

The **Online** tab runs a live table through this site's Firebase project:

1. **GM:** open the Online tab, add your name, pick a setting and press **Open table**. Copy the invite link and send it to your players, on Discord for example.
2. **Players:** open the link, type a name and press **Join the table**. Players don't need an account. They get a locked copy of your setting and build their characters from it.
3. Everyone's characters save to the table as they're edited.
   - The GM sees every sheet and can edit any of them, hand a character to a player, or hide NPCs from players.
   - Players see the party's characters but can only change their own.
4. Dice rolls show up for the whole table under **Dice → Table rolls**. Each person can switch sharing off.
5. When everyone has joined, the GM can turn off **Let new players join**. **Close table** ends it for everyone. Players keep their own copies.

**Tips**
- On the Online tab, **Link a Google account** keeps your tables if your browser data is cleared. To get your tables on another device, sign in with Google there. This matters most for the GM.
- If a player loses their browser data without linking Google, they rejoin with the invite link. The GM then uses **More… → Hand to a player** to give their character back.

## Files

| Path | What it is |
| - | - |
| `index.html` | The app itself (built from `dev/`) |
| `firebase-config.js` | This site's Firebase project settings. These aren't secret. |
| `firestore.rules` | The security rules to paste into Firebase |
| `vendor/` | Firebase's browser SDK (Apache 2.0), served from this site |
| `SETUP.md` | Firebase setup steps |
| `dev/` | Source, build script and tests |
