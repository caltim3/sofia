# Sofia — AI-Powered Knowledge System

Sofia is a self-organizing AI knowledge system. You submit raw thoughts, questions, and ideas. Sofia processes them through Claude AI, classifies them, and stores them in categorized spaces you can search and browse.

---

## What You Need

Before starting, you'll create free accounts on three services:

| Service | What It Does | Link |
|---------|-------------|------|
| **Supabase** | Stores your data (database + user login) | https://supabase.com |
| **Anthropic** | Powers the AI (Claude) | https://console.anthropic.com |
| **Vercel** | Hosts your app on the web | https://vercel.com |

You'll also need **Node.js** installed on your computer for local testing (optional but recommended).

- Download Node.js: https://nodejs.org (choose the LTS version)

---

## Step-by-Step Setup

### STEP 1: Set Up Supabase (Your Database)

1. Go to https://supabase.com and sign up (free).
2. Click **"New Project"**.
3. Give it a name like `sofia`, choose a strong database password (save it somewhere), and pick a region close to you.
4. Wait ~2 minutes for it to provision.

**Create the database tables:**

5. In the left sidebar, click **SQL Editor**.
6. Click **"New Query"**.
7. Open the file `supabase/schema.sql` from this project folder.
8. Copy ALL the text from that file and paste it into the SQL Editor.
9. Click **"Run"** (the green play button).
10. You should see "Success" messages. Your database is ready.

**Get your Supabase credentials:**

11. In the left sidebar, click **Settings** (gear icon) → **API**.
12. Copy these two values (you'll need them soon):
    - **Project URL** — looks like `https://abc123xyz.supabase.co`
    - **anon public key** — a long string starting with `eyJ...`

**Enable email authentication:**

13. In the left sidebar, click **Authentication** → **Providers**.
14. Make sure **Email** is enabled (it usually is by default).
15. For testing, go to **Authentication** → **Settings** and turn OFF "Confirm email" (you can turn it back on later).

---

### STEP 2: Get Your Anthropic API Key

1. Go to https://console.anthropic.com and sign up or log in.
2. Go to **Settings** → **API Keys**.
3. Click **"Create Key"**.
4. Copy the key — it looks like `sk-ant-api03-...`
5. Save it somewhere safe. You'll need it in the next step.

> Note: Anthropic charges per API call. The cost is very small (~$0.01–0.05 per prompt). You'll need to add a payment method and some credits.

---

### STEP 3: Deploy to Vercel (Your Web Host)

**Option A: Deploy directly from GitHub (Recommended)**

1. Create a GitHub account if you don't have one: https://github.com
2. Upload this entire `sofia` folder to a new GitHub repository:
   - Go to https://github.com/new
   - Name it `sofia`
   - Upload all the files from this folder
3. Go to https://vercel.com and sign up with your GitHub account.
4. Click **"Add New..."** → **"Project"**
5. Import your `sofia` repository from GitHub.
6. Before clicking Deploy, click **"Environment Variables"** and add these three:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1 |
| `ANTHROPIC_API_KEY` | Your Anthropic API key from Step 2 |

7. Click **"Deploy"**.
8. Wait 1-2 minutes. Vercel will give you a URL like `sofia-abc123.vercel.app`.
9. That's your app! Open it in a browser.

**Option B: Run locally first (for testing)**

1. Open Terminal (Mac) or Command Prompt (Windows).
2. Navigate to this folder: `cd path/to/sofia`
3. Create a file called `.env.local` by copying the example:
   ```
   cp .env.local.example .env.local
   ```
4. Open `.env.local` in a text editor and fill in your three values.
5. Install dependencies: `npm install`
6. Start the app: `npm run dev`
7. Open http://localhost:3000 in your browser.

---

### STEP 4: Configure Supabase for your deploy URL

After deploying to Vercel:

1. Go back to your Supabase project.
2. Go to **Authentication** → **URL Configuration**.
3. Set the **Site URL** to your Vercel URL (e.g., `https://sofia-abc123.vercel.app`).
4. Add your Vercel URL to **Redirect URLs** as well.

---

## How to Use Sofia

1. **Create an account** — Open your app URL, click "Sign Up", enter an email and password.
2. **Submit a prompt** — Click "+ New Prompt" in the top bar. Type any question, idea, or thought.
3. **Watch it process** — Sofia sends it to Claude AI, which classifies it and returns a structured response.
4. **Browse your knowledge** — Use the sidebar to view entries by category: Decisions, Brainstorms, Shopping, Observations, Drafts.
5. **Search** — Use the search bar to find entries by keyword.
6. **Edit** — Open any entry to edit its content, change its category, or regenerate the AI response.

---

## Project Structure

```
sofia/
├── app/
│   ├── api/process/route.js   ← Server-side AI processing (keeps API key safe)
│   ├── globals.css             ← Styles
│   ├── layout.js               ← Root HTML layout
│   └── page.js                 ← Auth screen + main entry point
├── components/
│   ├── Markdown.jsx            ← Renders Markdown as rich text
│   └── Sofia.jsx               ← Main dashboard (all the UI logic)
├── lib/
│   └── supabase-browser.js     ← Supabase client for the browser
├── supabase/
│   └── schema.sql              ← Database schema (run once in Supabase)
├── .env.local.example          ← Template for your secret keys
├── package.json                ← Project dependencies
├── tailwind.config.js          ← Styling config
└── README.md                   ← This file
```

---

## Data Flow

```
You type a prompt
    ↓
Saved to Supabase "prompts" table (status: New)
    ↓
Sent to /api/process (server-side)
    ↓
Claude AI classifies + responds
    ↓
Response parsed → category extracted
    ↓
New "entry" created in Supabase
    ↓
Prompt marked as Completed
    ↓
Entry appears in the correct category
```

---

## Troubleshooting

**"Unauthorized" errors:**
- Make sure your Supabase URL and anon key are correct in your environment variables.
- Make sure you're logged in.

**AI processing fails:**
- Check that your `ANTHROPIC_API_KEY` is correct and has credits.
- Check the Vercel deployment logs (Vercel dashboard → your project → Deployments → click the latest → Logs).

**Can't sign up:**
- Make sure Email auth is enabled in Supabase → Authentication → Providers.
- If you have "Confirm email" on, check your email for the confirmation link.

**Entries not showing:**
- Make sure the database tables were created correctly (Step 1, items 5-9).
- Check that Row Level Security policies were created (the SQL script handles this).

---

## Costs

- **Supabase**: Free tier gives you 500MB database, 50,000 monthly active users, and more. You won't hit limits for a long time.
- **Anthropic**: ~$0.01–0.05 per prompt processed. $5 in credits lasts hundreds of prompts.
- **Vercel**: Free tier includes unlimited deployments, custom domains, and more.

**Total cost to run Sofia: effectively $0/month** plus a few cents per prompt.

---

## Future Enhancements

The current version covers the core system. Future additions could include:
- Weekly AI digest of all entries
- Cross-entry linking (detect similar entries)
- PDF export
- Voice input
- Shared workspaces
- Custom categories
