# Leaderboard setup (Firebase Firestore)

The game works fine without this. Personal best scores are saved in the
browser and need no setup at all. Follow this only if you want the shared
top-10 leaderboard.

Takes about five minutes. You need a Google account.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it anything (e.g. `slice-sort-3d`). Google Analytics is not needed —
   turn it off.
3. Wait for it to finish, then click **Continue**.

## 2. Create the database

1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode** (rules are set in step 3 — do *not* pick test
   mode, it expires after 30 days and then silently stops working).
4. Pick a location near you — `asia-east2` is Hong Kong. **This cannot be
   changed later.**

## 3. Set the security rules

Open the **Rules** tab in Firestore and replace everything with this, then
click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{col}/{doc} {
      allow read: if col.matches('scores_[a-z]+');
      allow create: if col.matches('scores_[a-z]+')
        && request.resource.data.keys().hasOnly(['name','score','at'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 16
        && request.resource.data.score is int
        && request.resource.data.score >= -9999
        && request.resource.data.score <= 100000;
      allow update, delete: if false;
    }
  }
}
```

What these do: anyone may read the boards and add a score, but **nobody can
edit or delete** an existing one, names are capped at 16 characters, and
absurd scores are rejected. That last rule is the only cheat protection
possible here — see "Honesty" below.

## 4. Get your two values

1. Click the **gear icon → Project settings**.
2. Under **Your apps**, click the web icon `</>`. Give it any nickname and
   register it. Skip the hosting offer.
3. You will be shown a `firebaseConfig` block. You need exactly two values
   from it: `projectId` and `apiKey`.

## 5. Put them in the game

Open `js/scores.js` and fill in the two blanks at the top:

```js
var FB={
  projectId:"your-project-id",
  apiKey:"AIzaSy..."
};
```

Save, reload the game, finish a round. The leaderboard appears on the result
screen.

---

## Honesty about what this is

**The API key is visible in your code, and that is normal.** Firebase web keys
are public identifiers, not passwords; the security rules above are what
actually protect the data.

But it does mean **a determined player can send a fake score** — anyone who
opens the browser console can. The rules reject impossible values, and nobody
can delete or alter other people's entries, but a plausible-looking fake will
get through. This is unavoidable for any browser game with no login. Treat the
board as a bit of fun between classmates, not as a competition of record.

If a bad entry does appear, you can delete it by hand in the Firebase console
under Firestore Database → Data.

## Free tier

The Spark (free) plan gives 50,000 reads and 20,000 writes per day, and 1 GB
of storage. A class playing all day will not come close. Unlike some
alternatives, **Firebase does not pause an idle project**, so the leaderboard
still works after weeks of no one touching it.

## Data stored

One document per completed run, in `scores_sort`, `scores_quiz` or
`scores_tsunami`:

| Field | Type | |
|---|---|---|
| `name` | string | whatever the player typed, max 16 chars |
| `score` | integer | final score for that run |
| `at` | timestamp | when it was played |

No accounts, no emails, no device identifiers. Players type a display name,
which is remembered in their own browser so they don't retype it. Tell
students not to enter their full real name if that matters to your school.

Versus mode is not recorded — it is two players on one screen, so a personal
best has no clear meaning.
