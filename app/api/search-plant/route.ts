import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a plant care expert. When given a plant description or name, provide seasonal care schedules.
Different seasons require different care frequencies. Provide recommendations for each season.

For watering and fertilizing, use days between care events. Use 0 for fertilizing in winter if the plant should not be fertilized.

Respond ONLY with valid JSON in this exact format:
{
  "name": "string",
  "scientificName": "string",
  "watering": {
    "spring": number,
    "summer": number,
    "fall": number,
    "winter": number
  },
  "fertilizing": {
    "spring": number,
    "summer": number,
    "fall": number,
    "winter": number
  },
  "repotting": {
    "spring": 730,
    "summer": 730,
    "fall": 730,
    "winter": 730
  },
  "careNotes": "string with seasonal care tips"
}

Example for a Monstera:
{
  "name": "Monstera Deliciosa",
  "scientificName": "Monstera deliciosa",
  "watering": {"spring": 7, "summer": 5, "fall": 10, "winter": 14},
  "fertilizing": {"spring": 21, "summer": 21, "fall": 30, "winter": 0},
  "repotting": {"spring": 730, "summer": 730, "fall": 730, "winter": 730},
  "careNotes": "Water when top 2 inches dry. Needs more water in summer growth period. Stop fertilizing in winter."
}`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    let plantData;
    try {
      plantData = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plantData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }

    return NextResponse.json(plantData);
  } catch (error) {
    console.error('Error searching for plant:', error);
    return NextResponse.json(
      { error: 'Failed to search for plant' },
      { status: 500 }
    );
  }
}
