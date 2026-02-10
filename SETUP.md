# Quick Setup Guide

## Your Plant Care Tracker is Ready! 🎉

The development server is already running at: **http://localhost:3000**

## Next Steps

### 1. Configure AI Features (Optional)

To enable AI-powered plant search and camera identification:

1. Get an OpenAI API key from: https://platform.openai.com/api-keys

2. Create a `.env.local` file in the project root:
```bash
cp env.example .env.local
```

3. Edit `.env.local` and add your API key:
```
OPENAI_API_KEY=your_actual_api_key_here
```

4. Restart the development server (Ctrl+C and run `npm run dev` again)

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

### Data Storage
- All data is stored in your browser's LocalStorage
- Data persists across sessions
- No account or backend required

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
```

## Troubleshooting

### AI Features Not Working?
- Make sure you've added your OpenAI API key to `.env.local`
- Restart the development server after adding the API key
- Check the browser console for error messages

### Data Not Persisting?
- Make sure you're using the same browser
- Check that LocalStorage is enabled in your browser
- Private/Incognito mode may not persist data

### Port Already in Use?
- Stop other applications using port 3000
- Or change the port: `npm run dev -- -p 3001`

## Need Help?

Check the main README.md for more detailed information about the project structure and features.

Happy plant caring! 🪴
