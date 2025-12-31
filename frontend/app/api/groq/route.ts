import { NextRequest, NextResponse } from 'next/server'

// Use server-side env var (more secure than NEXT_PUBLIC_)
// Falls back to NEXT_PUBLIC_ for backward compatibility
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || 'gsk_qvP9xH7KcW9YFzJ3vN2FWGdyb3FYZ8mK5nL4pR6tS7uV8wX9yA0bC1dE2fG3h'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Call Groq API from server-side (avoids CORS issues)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a seasoned CFO providing clear, actionable financial insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API Error:', response.status, errorText)
      return NextResponse.json(
        {
          error: `Groq API error: ${response.status} ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'No response generated'

    return NextResponse.json({ response: aiResponse })

  } catch (error: any) {
    console.error('API Route Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
