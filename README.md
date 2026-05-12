# PayRound

Subscription cost-sharing tracker. Share Netflix, Spotify, and other subscriptions with friends — track who paid, collect proof screenshots, and close months with confidence.

## Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth + Firestore + Storage + Cloud Functions)
- **Email**: Resend
- **Deploy**: Vercel

## Setup

### Auth routes (`payrounds-v2` merged)

- `/` — redirects by role (owner → `/dashboard`, member → `/pay`, signed out → `/login`)
- `/login` — Google (owner) + email & password for members (Sign in / Create account tabs). Optional `?invite=TOKEN` completes joining after sign-in.
- `/invite/confirm` — redirects to `/login` (legacy magic-link URL)
- `/invite/[token]` — invite landing: create account with name, email, password → join subscription
- `/invite/[token]/confirm` — redirects to `/invite/[token]`
- `/dashboard` — owner shell + live subscription cards
- `/subscriptions/*`, `/notifications` — same owner shell (`OwnerAppShell`)

Add your app domain under Firebase Auth → **Authorized domains** (for Google sign-in and hosted URLs).

For **friend lookup by email** on “New subscription”, add a single-field index on **`users`** → **`email`** (Firestore may prompt when you first run a `where("email", "==", …)` query).

### If you have a `payround-with-env` zip from Claude

Use the **existing** app in this repo (`payround/`), not a second folder like `payrounds`. Copy **only** `.env.local` from the zip to the project root (Firebase keys + `NEXT_PUBLIC_APP_URL`). Keep **`lib/` from this repo** — it includes Firestore fixes (transactions, `collectionGroup` for members) that older zip drops may omit. Then add `RESEND_API_KEY` from [resend.com](https://resend.com) and run `npm install` / `npm run dev` here.

### 1. Install

```bash
cd payround
npm install
```

### 2. Firebase project

1. [Firebase Console](https://console.firebase.google.com) → new project
2. **Authentication**: enable **Google** (owners) and **Email/Password** (first toggle — members sign in with email + password, not magic link). Disable email link / passwordless if you are not using it.
3. **Firestore** (production mode to start)
4. **Storage**
5. Project settings → Web app → copy config into `.env.local`

### 3. Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_FIREBASE_*`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)

**Vercel:** add the same `NEXT_PUBLIC_FIREBASE_*` (and `NEXT_PUBLIC_APP_URL` for invite links and emails) under **Project → Settings → Environment Variables** for **Production**. The production build can finish without them, but the deployed app needs real Firebase values to work.

### 4. Firestore indexes

The owner dashboard queries **`subscriptions`** with **`ownerId` only** (no composite index). Cancelled subs are filtered and sorted in the client.

**Collection group** index (still required for members):

| Collection group ID | Field paths | Order |
|---------------------|-------------|-------|
| `members`           | `uid`       | ASC   |

### 5. Security rules (required before the app works end-to-end)

Deploy rules from this repo:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Source files: `firestore.rules`, `storage.rules`. You can paste their contents in the Firebase console instead if you prefer.

### 6. Run locally

```bash
npm run dev
```

## Cloud Functions

Scheduled jobs live under `functions/`. Deploy:

```bash
cd functions
npm install
firebase deploy --only functions
```

| Function           | Schedule        | Purpose                          |
|--------------------|-----------------|----------------------------------|
| `openCycle`        | 1st of month    | Open new cycle per active sub    |
| `deadlineReminder` | Daily           | Remind before due date           |
| `cleanupProofs`    | Daily           | Delete old proof images          |

## Project structure

```
payround/
├── .cursor/rules/project.mdc
├── app/
├── components/
├── lib/
│   ├── firebase.ts
│   ├── types.ts
│   └── firestore/       ← import from @/lib/firestore
├── functions/
├── firestore.rules
└── storage.rules
```

## Cursor + Claude “foundation”

The `payround-foundation/` folder was a drop-in bundle; it has been **merged into `lib/`**, `firestore.rules`, `storage.rules`, and this README. You can delete `payround-foundation/` if it is still present.
