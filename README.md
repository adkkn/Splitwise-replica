# Evenly

A free bill splitting app for you and your friends, in the spirit of Splitwise.
Android (APK), iPhone (home screen web app) and browser, all from one codebase.

## Features

- Sign up with email, add friends by email (they can join later and see everything)
- Groups (trips, home, couple, anything) and expenses outside groups
- Split equally, by exact amounts, by percentages or by shares
- One payer or several people paying for the same expense
- Any currency per expense (AED, EUR, USD, GBP and more), balances kept per currency
- Simplify debts per group (fewest payments to settle everyone)
- Settle up with suggested payments, record any payment
- Balances per friend (with a per group breakdown) and per group, group totals
- Activity feed, edit and delete anything, live updates across phones
- Category auto detection ("Taxi" gets the transport icon), light and dark mode

## One time setup (about 5 minutes)

### 1. Create the database (free)

1. Go to [supabase.com](https://supabase.com), sign up (the GitHub login is quickest) and click **New project**.
   Name it `evenly`, pick any password, and choose a region close to you (for example West EU (Ireland)).
2. When it is ready, open **SQL Editor**, click **New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. You should see "Success".
3. Open **Authentication > Sign In / Providers > Email** and turn **off** "Confirm email", then save.
   (Otherwise every friend has to click an email link, and the free email sender only sends a few per hour.)
4. Open **Project Settings > API Keys** (and **Data API** for the URL) and copy:
   - the **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - the **publishable key** (or the legacy **anon public** key)

   These two values are safe to share: the database rules only ever show people their own data.

### 2. Connect the app to it

In GitHub, open the repository's **Settings > Secrets and variables > Actions > Variables** tab and add two
repository variables:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_KEY` | your publishable / anon key |

Then go to **Actions > Build apps > Run workflow**. (Or just paste both values to Claude and it will do this part.)

### 3. Get the apps

**Android:** when the build finishes (about 10 minutes), open the repository's **Releases** and download
`Evenly.apk`. Send that file to your friends (WhatsApp, Drive, anything). On the phone, open it and allow
"install unknown apps" when asked. New builds install over the old one and keep you logged in.

**iPhone:** Apple does not allow installing app files without a paid developer account, so iPhone users get
the web version, which looks and works the same:

1. In GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
   (GitHub Pages needs the repository to be public, or a GitHub Pro account. The code contains no secrets.)
2. Merge this work into `main`. Every push to `main` publishes the site.
3. Your friends open `https://<your-github-username>.github.io/<repository-name>/` in **Safari**, tap
   **Share**, then **Add to Home Screen**. It gets its own icon and opens full screen like a normal app.

If the repository stays private, friends cannot download from Releases themselves, so just share the APK
file directly.

## Developing

```bash
npm install
npm run web        # run in the browser
npm test           # money math tests
npm run typecheck
```

Create a `.env.local` file with `EXPO_PUBLIC_SUPABASE_URL=...` and `EXPO_PUBLIC_SUPABASE_KEY=...` to run it
against your database locally.

## How it works

- `src/lib/money.ts`: all the money math, in integer cents (splits, balances, debt simplification)
- `src/lib/data.tsx`: login, loading data and live updates from Supabase
- `src/app/`: the screens (Expo Router)
- `supabase/schema.sql`: tables, security rules and the functions the app calls
- `.github/workflows/build.yml`: builds the APK and the web app on every push
