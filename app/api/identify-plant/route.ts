import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { guard } from '@/lib/api-guard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route Handlers have no default body-size limit, so an unbounded request
// would otherwise forward straight to OpenAI on this key. Client-side
// compression (lib/image.ts) keeps a normal upload well under this; it's a
// backstop against a caller that skips it, not the primary size control.
const MAX_IMAGE_BODY_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Verified session + per-user / per-IP rate limit (see lib/api-guard.ts).
  const guardResult = await guard(request, 'identify-plant', 10, 30);
  if (guardResult.response) return guardResult.response;

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BODY_BYTES) {
    return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
  }

  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a plant identification expert. Analyze the plant image and provide seasonal care schedules.
Different seasons require different care frequencies.

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

If you cannot identify the plant with confidence, use "Unknown Plant" as the name and provide general houseplant care recommendations.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify this plant and provide care recommendations.',
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
          ],
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
    console.error('Error identifying plant:', error);
    return NextResponse.json(
      { error: 'Failed to identify plant' },
      { status: 500 }
    );
  }
}
