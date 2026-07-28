# Score database (Firebase Firestore) — owner-only

Every completed game gets written to a database that **only you can read**.
Players see their own best score in the game and nothing else: no leaderboard,
no download button, no way to see anyone else's results.

The game works without this. Skip it and players still get their own best
score; you just won't collect the data centrally.

Takes about five minutes. You need a Google account.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it anything (e.g. `slice-sort-3d`). Turn Google Analytics off.

## 2. Create the database

1. Left sidebar: **Build → Firestore Database → Create database**.
2. Choose **Production mode**. Do *not* pick test mode — it expires after 30
   days and then silently stops accepting scores.
3. Pick a location near you — `asia-east2` is Hong Kong. **This cannot be
   changed later.**

## 3. Set the rules — this is the important step

Open the **Rules** tab, replace everything with this, and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{doc} {
      allow create: if request.resource.data.keys().hasOnly(['name','mode','score','at'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 16
        && request.resource.data.mode in ['sort','quiz','tsunami']
        && request.resource.data.score is int
        && request.resource.data.score >= -9999
        && request.resource.data.score <= 100000;
      allow read, update, delete: if false;
    }
  }
}
```

`allow read: if false` is what makes this owner-only. The game can add a
score and can never read one back. A student who opens the browser console
and tries to list the scores gets refused by the server — there is nothing
client-side for them to bypass. You read the data in the Firebase console,
which sits behind your Google login.

`update` and `delete` are also denied, so nobody can alter or wipe results.

## 4. Get your two values

1. Gear icon → **Project settings**.
2. Under **Your apps**, click the web icon `</>`, register an app, skip hosting.
3. From the `firebaseConfig` shown, you need only `projectId` and `apiKey`.

## 5. Put them in the game

Open `js/scores.js` and fill in the two blanks at the top:

```js
var FB={
  projectId:"your-project-id",
  apiKey:"AIzaSy..."
};
```

Deploy. Finish a game, enter a name, and the score appears in Firestore.

## Reading the results

Firebase console → **Firestore Database → Data → `scores`**. Each document is
one completed game:

| Field | |
|---|---|
| `name` | what the player typed, max 16 chars |
| `mode` | `sort`, `quiz` or `tsunami` |
| `score` | final score |
| `at` | when it was played |

To get it into Excel, use the **⋮ menu → Export collection**, or read it with
the Firebase CLI. There is deliberately no export button in the game.

## Two honest limitations

**The API key is visible in your code.** That is normal for Firebase web apps
and is not the leak it looks like — the rules above are the actual protection,
and they permit only creating a score.

**A determined student can still submit a fake score.** Anyone able to send a
request can send a plausible one; the rules reject impossible values but not
implausible-but-legal ones. No browser game without logins can prevent this.
Nobody can edit or delete other people's entries, and nobody can read the
list, so the worst case is one bogus row that you can delete in the console.

## Privacy

Stored: a display name the player types, the mode, the score, and a timestamp.
No accounts, no emails, no device identifiers. Tell students not to enter
their full real name if that matters at your school.
