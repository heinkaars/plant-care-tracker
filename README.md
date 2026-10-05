# 🪴 Plant Care Tracker

A modern web application to track houseplant care schedules with AI-powered features.

## Features

### Core Functionality
- ✅ **Plant Collection Management** - Add, edit, and remove plants from your collection
- ✅ **Smart Care Tracking** - Track watering, fertilizing, and repotting schedules
- ✅ **Care Status Dashboard** - Overview of total plants, upcoming care tasks, and overdue items
- ✅ **Care History** - Complete history of all care events for each plant
- ✅ **Accounts** - Sign up, sign in, and password reset via Supabase Auth, with an
  anonymous session created automatically on first visit so the app works
  before you have an account

### AI-Powered Features
- 🤖 **AI Plant Search** - Natural language search using ChatGPT API to find plants and get care recommendations
- 📷 **Camera Plant Identification** - Take a photo to identify plants and receive personalized care schedules
- 💡 **Smart Care Recommendations** - AI automatically suggests watering, fertilizing, and repotting frequencies

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Storage & Auth**: Supabase (Postgres with Row Level Security, plus
  Supabase Auth for anonymous/email accounts)
- **AI Integration**: OpenAI API (GPT-4o and GPT-4o Vision)
- **Date Handling**: date-fns
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase project (free tier is fine) - required, the app cannot build or
  run without it
- OpenAI API key (optional, only needed for the AI features)

### Installation

1. Clone the repository:
```bash
cd plant-care-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

4. Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key_here
```

- Supabase values come from Project Settings → API in your Supabase
  dashboard. See `env.example` for what each one is used for.
- Get an OpenAI key from: https://platform.openai.com/api-keys

5. Set up the database: run `supabase/schema.sql` in your Supabase project's
   SQL Editor, and enable **anonymous sign-ins** under Authentication →
   Providers (the app bootstraps an anonymous session on first load).

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Adding Plants

You have three options to add a plant:

1. **Manual Entry** - Manually enter plant details and care schedules
2. **AI Search** - Describe the plant in natural language (e.g., "a succulent with thick leaves" or "Monstera deliciosa") and get AI-powered recommendations
3. **Camera Identification** - Take or upload a photo of your plant for automatic identification and care recommendations

### Tracking Care

- View all plants in your collection with their current care status
- See upcoming and overdue care tasks on the dashboard
- Mark care events (watering, fertilizing, repotting) with optional notes
- View complete care history for each plant

### Care Status Indicators

- 🟢 **Up to date** - No care needed soon
- 🟡 **Due soon** - Care needed within 3 days
- 🔴 **Overdue** - Care is past due

## Pages

- **Dashboard** (`/`) - Overview with stats and upcoming care tasks
- **Plant Collection** (`/plants`) - Grid or list view of all plants
- **Plant Detail** (`/plants/[id]`) - Individual plant page with full profile and care history

## Project Structure

```
plant-care-tracker/
├── app/
│   ├── api/
│   │   ├── search-plant/      # AI plant search endpoint
│   │   └── identify-plant/    # Camera identification endpoint
│   ├── account/                # Sign up / sign in / preferences page
│   ├── plants/
│   │   ├── [id]/              # Plant detail page
│   │   └── page.tsx           # Plant collection page
│   ├── layout.tsx             # Root layout with navigation
│   ├── page.tsx               # Dashboard page
│   ├── error.tsx               # App Router error boundary
│   ├── global-error.tsx        # Root-layout error boundary
│   └── globals.css            # Global styles
├── components/
│   ├── AddPlantModal.tsx      # Modal for adding plants
│   ├── EditPlantModal.tsx      # Modal for editing a plant
│   ├── AuthForm.tsx            # Sign up / sign in / password reset UI
│   └── ...                     # ConfirmDialog, CareNotesModal, Skeletons, etc.
├── lib/
│   ├── supabase/                # Browser/server Supabase clients + middleware helper
│   ├── storage.ts             # Supabase-backed data access
│   ├── auth-context.tsx        # Supabase Auth session/provider
│   ├── api-guard.ts             # Per-user rate limiting for the AI routes
│   ├── careStatus.ts           # Care status utilities
│   └── seasonUtils.ts          # Seasonal frequency utilities
├── proxy.ts                     # Refreshes the Supabase session cookie
├── supabase/
│   └── schema.sql               # Postgres schema + Row Level Security policies
└── types/
    └── plant.ts               # TypeScript type definitions
```

## Data Storage

Plant data lives in a Supabase Postgres database, scoped per-user with Row
Level Security. A session (including an anonymous one, created automatically
on first visit) is required to read or write any data — see `lib/storage.ts`
and `lib/auth-context.tsx`. Signing up turns the anonymous session into a
permanent account without losing its data.

## AI Features Configuration

The AI features require an OpenAI API key. These features are optional - you can still use the app with manual entry only.

- **AI Search**: Uses GPT-4o for natural language plant search
- **Camera Identification**: Uses GPT-4 Vision (gpt-4o) for image analysis

API calls are only made when you use these features, so you won't incur costs for basic manual plant tracking.

## Future Enhancements

Potential features for future development:
- Move plant photos into Supabase Storage instead of a Postgres text column
- Plant photos from device gallery
- Export/import plant data
- Care reminders and notifications
- Plant growth tracking
- Multiple plant collections/rooms
- Sharing care schedules

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.
