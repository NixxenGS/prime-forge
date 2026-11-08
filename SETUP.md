# Setup

## GitHub Pages
In the repo, go to **Settings → Pages**. Set Source to **Deploy from a branch**, the branch to **main** and the folder to **/ (root)**, then click **Save**. Both apps go live a minute or two later.

## Firebase
The free **Spark** plan is enough; no billing account is needed.

1. **Create a project** at https://console.firebase.google.com.
2. **Authentication → Get started → Sign-in method**:
   - Enable **Google**.
   - Enable **Email/Password**. Leave "Email link" off.
   - Anonymous sign-in isn't used any more, so you can turn it off.
3. **Authentication → Settings → Authorized domains → Add domain:** `nixxengs.github.io`
4. **Firestore Database → Create database.** Choose production mode and a location near your group.
5. **Firestore Database → Rules:** replace everything with [`firestore.rules`](firestore.rules), then press **Publish**. Do this again whenever that file changes.
6. **Project settings (gear) → General → Your apps → Web (`</>`):** register an app, then copy its `firebaseConfig` values into `firebase-config.js`. This is already done for this site.

Optional: **Authentication → Templates → Password reset** lets you change the wording of reset emails.

## Free plan limits

The Spark plan includes 50,000 document reads and 20,000 writes a day, plus 1 GiB of storage. A group of five playing for an evening uses a small fraction of that.

## Troubleshooting

| You see | Fix |
| - | - |
| "That sign-in method is turned off" | Step 2 |
| "This site isn't an authorized domain" (Google sign-in) | Step 3 |
| "Firebase refused it. Did you publish the security rules?" | Step 5. Press **Publish**. |
| "No campaign has that room code" | Check the code with the GM. If the GM pressed **New code**, the old one stops working. |
| "Your GM has closed this campaign to new players" | The GM ticks **Let new players join** |
