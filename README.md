# Combat Sports Live Feed (with AdSense)

A simple Next.js site that pulls MMA/boxing/combat news from NewsData.io and shows Google AdSense ads (top, in-feed, sidebar, bottom).

## One-time setup
1. Install Node.js (LTS) from https://nodejs.org
2. Create a free account at https://newsdata.io and copy your API key.
3. (Optional) Create a free account at https://vercel.com to deploy the site.
4. (Optional) Apply for Google AdSense at https://www.google.com/adsense

## Run locally
1. In this folder, create a file named `.env.local` and paste:
   ```
   NEWSDATA_API_KEY=PASTE_YOUR_KEY_HERE
   NEWSDATA_BASE=https://newsdata.io/api/1/latest
   NEWSDATA_COUNTRY=us,ca
   NEWSDATA_LANGUAGE=en
   ```
2. Replace `YOUR-CLIENT-ID` and the slot IDs in `app/layout.tsx` and `app/page.tsx` after AdSense approval.
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

## Deploy
- Import this repo into Vercel and set the same environment variables in Project Settings → Environment Variables.
- Deploy. Ads will show after AdSense approval and once the site is on a public URL.
