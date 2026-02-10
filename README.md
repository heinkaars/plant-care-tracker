# 🪴 Plant Care Tracker

A modern web application to track houseplant care schedules with AI-powered features.

## Features

### Core Functionality
- ✅ **Plant Collection Management** - Add, edit, and remove plants from your collection
- ✅ **Smart Care Tracking** - Track watering, fertilizing, and repotting schedules
- ✅ **Care Status Dashboard** - Overview of total plants, upcoming care tasks, and overdue items
- ✅ **Care History** - Complete history of all care events for each plant

### AI-Powered Features
- 🤖 **AI Plant Search** - Natural language search using ChatGPT API to find plants and get care recommendations
- 📷 **Camera Plant Identification** - Take a photo to identify plants and receive personalized care schedules
- 💡 **Smart Care Recommendations** - AI automatically suggests watering, fertilizing, and repotting frequencies

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Storage**: Local Storage (browser-based)
- **AI Integration**: OpenAI API (GPT-4 and GPT-4 Vision)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ installed
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
cd Plant-Care
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from: https://platform.openai.com/api-keys

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

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
Plant-Care/
├── app/
│   ├── api/
│   │   ├── search-plant/      # AI plant search endpoint
│   │   └── identify-plant/    # Camera identification endpoint
│   ├── plants/
│   │   ├── [id]/              # Plant detail page
│   │   └── page.tsx           # Plant collection page
│   ├── layout.tsx             # Root layout with navigation
│   ├── page.tsx               # Dashboard page
│   └── globals.css            # Global styles
├── components/
│   └── AddPlantModal.tsx      # Modal for adding plants
├── lib/
│   ├── storage.ts             # LocalStorage service
│   └── careStatus.ts          # Care status utilities
└── types/
    └── plant.ts               # TypeScript type definitions
```

## Data Storage

All plant data is stored in the browser's LocalStorage. Data persists across sessions but is specific to each browser/device.

## AI Features Configuration

The AI features require an OpenAI API key. These features are optional - you can still use the app with manual entry only.

- **AI Search**: Uses GPT-4 for natural language plant search
- **Camera Identification**: Uses GPT-4 Vision (gpt-4o) for image analysis

API calls are only made when you use these features, so you won't incur costs for basic manual plant tracking.

## Future Enhancements

Potential features for future development:
- Backend database for data sync across devices
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
