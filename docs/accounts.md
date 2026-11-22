# Accounts and profiles

Sign-in uses [Clerk](https://clerk.com) on its free Hobby plan (up to 50,000 people who come back after
their first day). Clerk keeps the accounts: email addresses, Google sign-in and sessions. The Ghost Kitchen
server keeps the rest in its own Postgres: profiles (name, pixel ghost, preferences) and who belongs to
which household.

## Turning it on

1. Create a free app at [dashboard.clerk.com](https://dashboard.clerk.com). Keep it a **development**
   instance to start.
2. **User & authentication**:
   - Turn on **Email address**, with **Email verification code** as the way to sign in.
   - Turn **Password** off. The app signs in with a code, not a password.
   - Don't require a username, name or phone number: the app asks for none of them at sign-up.
3. **SSO connections → Google**: turn it on and leave **Use custom credentials** off. A development
   instance then uses Clerk's shared Google credentials, so there's nothing to set up in Google Cloud.
4. **Native applications**: turn on the **Native API** (needed for the Android app), and add the
   redirect URL `ghostkitchen://sso-callback` to the allowlist.
5. Copy the **publishable key** (`pk_test_…`) from **API keys** into `.env`:
   ```
   CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
   The secret key isn't needed: the server only checks Clerk's signed session tokens, using Clerk's public keys.
6. `docker compose up -d --build api`. The app reads the key from the server's `/v1/status`, so the same
   app build works with any server.

## Going to production

Clerk's shared Google credentials only work on development instances, which also show a "Development
mode" badge and limit how many people can sign up. Before inviting others:

1. In Clerk, create the **production** instance (it needs a domain you own).
2. In Google Cloud, create an OAuth client and paste its client ID and secret into Clerk's Google
   connection (**Use custom credentials** on). Clerk's dashboard links to the steps.
3. Put the `pk_live_…` key in `.env`, and set `CLERK_AUTHORIZED_PARTIES` to your web address.

## How it behaves

- **Required:** on a server with a Clerk key, nobody uses the app before signing in. A server without one
  works as before, with no accounts.
- **Offline after the first sign-in:** the app remembers who signed in on the device. Without signal it
  still opens and the food is there; sync waits. If the session runs out (7 days on the free plan), the
  top bar shows **Sign in to sync** and nothing is locked.
- **Nothing is lost:** the food already on a device stays on it through signing in, signing out, and
  someone else signing in. An old household shared with device keys is linked to the account the first
  time someone signs in on that device; the first person to do so becomes its owner.
- **Households:** made of people. The owner can remove someone; anyone can leave. When the owner leaves,
  the longest-standing member becomes owner. History records who did what ("Sam binned the milk"), and
  the server sets that from the session, so it can't be faked.
- **Your account comes first:** an account is always in exactly one kitchen, and the server decides which.
  Every device signed in with the same email shows that kitchen, so they always show the same food. A
  change made on one device (or by anyone sharing the kitchen) shows on the others within about a second,
  without reloading, even with a fridge, freezer or pantry door open: each open app keeps one request
  waiting at the server, which answers the moment the kitchen changes. Polling every 10 seconds, and a
  sync whenever an app comes back to the foreground, cover the rare case where that request is cut off. The first time an account is used anywhere it gets a kitchen of its own; a device's first
  sign-in adds the food already on it, so nothing is lost.
- **Households sit on top:** invite people into your kitchen, or join someone else's with their code. The
  whole account moves, so all your devices switch with it and your food goes into theirs. Leaving moves the
  account (all its devices) to a kitchen of its own, with a copy of the food; the others keep theirs. If the
  owner removes you, your devices keep their copy the same way. With nobody else in it, your kitchen has
  nothing to leave.
- **Delete all data:** deletes the food on all your devices. In a kitchen shared with other people you
  leave it first, so nothing is deleted for them.
- **Profile:** a name, one of the five pixel ghosts on one of seven colours, and preferences that follow
  you between devices (diets, currencies, larger text, sounds, reduced motion). Notifications and the
  server address stay per device.
- **Your record:** ghosts banished (food used while turning), money saved and lost, quiet weeks in a row,
  and six badges. Only your own actions count; the Ledger keeps the household totals.
- **Deleting an account:** removes the profile, badges and memberships on the server and the Clerk
  account. Shared households and their food stay for the other members, and on the device.
