# Firebase setup for online tables

The free **Spark** plan is enough; no billing account is needed. You do this once, as the GM.

1. **Create a project** at https://console.firebase.google.com. You can leave Google Analytics off.
2. **Authentication → Get started → Sign-in method**:
   - Enable **Anonymous**. Players join with no account.
   - Enable **Google**. This is optional, so people can keep their tables across devices.
3. **Authentication → Settings → Authorized domains → Add domain:** `nixxengs.github.io`
4. **Firestore Database → Create database.** Choose production mode and a location near your group.
5. **Firestore Database → Rules:** replace everything with the contents of [`firestore.rules`](firestore.rules), then press **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`):** register an app. Put its `firebaseConfig` values into `firebase-config.js`, which is already done for this site.

## Free plan limits

The free Spark plan includes 50,000 document reads and 20,000 writes per day, and 1 GiB of storage. A group of five playing for an evening uses a small fraction of that.

- Edits are batched about once a second while someone types.
- Each roll is one write.

## Troubleshooting

| You see | Fix |
| - | - |
| "Anonymous sign-in is turned off" | Step 2 |
| "Firebase refused it. Did you paste the security rules?" | Step 5, and make sure you pressed **Publish** |
| Google sign-in says the domain isn't authorized | Step 3 |
| "Your GM has closed this table to new players" | The GM ticks **Let new players join** on the Online tab |
