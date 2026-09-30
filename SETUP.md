# Quick Setup Guide

## Set Up Supabase First (Required)

The app cannot build or run without a Supabase project — every page needs a
Supabase client to bootstrap a session.

1. Create a free project at https://supabase.com.
2. In the SQL Editor, run `supabase/schema.sql` from this repo.
3. Under Authentication → Providers, enable **anonymous sign-ins** (the app
   creates an anonymous session automatically on first visit).
4. Create `.env.local` in the project root:
```bash
cp env.example .env.local
```
5. Fill in the Supabase values from Project Settings → API:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

6. Start the development server:
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Next Steps

### 1. Configure AI Features (Optional)

To enable AI-powered plant search and camera identification:

1. Get an OpenAI API key from: https://platform.openai.com/api-keys

2. Edit `.env.local` and add your API key:
```
OPENAI_API_KEY=your_actual_api_key_here
```

3. Restart the development server (Ctrl+C and run `npm run dev` again)

**Note**: AI features are optional. You can use manual plant entry without an API key.

### 2. Start Using the App

Open http://localhost:3000 in your browser and:

1. **Add Your First Plant**
   - Click "Add Plant" button
   - Choose from three input methods:
     - ✏️ Manual Entry - Type in plant details
     - 🔍 AI Search - Describe the plant in natural language (requires API key)
     - 📷 Camera - Take/upload a photo to identify (requires API key)

2. **Track Care**
   - View your plants on the Dashboard or My Plants page
   - Click on a plant to see its detail page
   - Mark care events (watering, fertilizing, repotting)
   - View care history and upcoming tasks

3. **Monitor Status**
   - Dashboard shows total plants, upcoming care, and overdue tasks
   - Color-coded status indicators:
     - 🟢 Green = Up to date
     - 🟡 Yellow = Due soon (within 3 days)
     - 🔴 Red = Overdue

## Features Overview

### Pages
- **Dashboard** (`/`) - Overview with stats and upcoming care tasks
- **My Plants** (`/plants`) - Grid or list view of all plants
- **Plant Detail** (`/plants/[id]`) - Individual plant profile with care tracking

### AI Features (with API key)
- Natural language plant search
- Camera-based plant identification
- Automatic care schedule recommendations

### Accounts & Data Storage
- Data lives in your Supabase project's Postgres database, scoped to you via
  Row Level Security
- An anonymous account is created automatically on first visit, so you can
  start adding plants right away
- Sign up from `/account` to turn that anonymous session into a permanent
  account (with email + password) without losing your plants
- Forgot your password? Use the "Forgot password?" link on the sign-in screen

## Development Commands

```bash
# Start development server (already running)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run tests
npm run test
```

## Troubleshooting

### AI Features Not Working?
- Make sure you've added your OpenAI API key to `.env.local`
- Restart the development server after adding the API key
- Check the browser console for error messages

### Data Not Persisting, or Every Page Failing to Load?
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  are set in `.env.local` and the dev server was restarted after adding them
- Make sure you ran `supabase/schema.sql` in your project's SQL Editor
- Make sure anonymous sign-ins are enabled (Authentication → Providers)
- Check the browser console and terminal for Supabase errors

### Port Already in Use?
- Stop other applications using port 3000
- Or change the port: `npm run dev -- -p 3001`

## Need Help?

Check the main README.md for more detailed information about the project structure and features.

Happy plant caring! 🪴
