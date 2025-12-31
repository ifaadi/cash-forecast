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

    // Try multiple models in case one doesn't work
    const models = [
      'llama-3.1-70b-versatile',
      'llama-3.3-70b-versatile',
      'llama3-70b-8192',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ]

    let lastError: any = null

    for (const model of models) {
      try {
        console.log(`🔄 Trying model: ${model}`)

        // Call Groq API from server-side (avoids CORS issues)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
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
          console.error(`❌ Model ${model} failed:`, response.status, errorText)
          lastError = {
            model,
            status: response.status,
            details: errorText
          }
          continue // Try next model
        }

        const data = await response.json()
        const aiResponse = data.choices[0]?.message?.content || 'No response generated'

        console.log(`✅ Success with model: ${model}`)
        return NextResponse.json({
          response: aiResponse,
          model: model // Include which model worked
        })

      } catch (modelError: any) {
        console.error(`❌ Model ${model} error:`, modelError.message)
        lastError = { model, error: modelError.message }
        continue // Try next model
      }
    }

    // If we get here, all models failed
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ ALL MODELS FAILED')
    console.error('Last error:', JSON.stringify(lastError, null, 2))
    console.error('API Key (first 10 chars):', GROQ_API_KEY.substring(0, 10) + '...')
    console.error('API Key length:', GROQ_API_KEY.length)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      {
        error: `All models failed. Last error: ${lastError?.status || lastError?.error}`,
        details: lastError?.details || lastError?.error,
        debug: {
          lastError,
          apiKeyPrefix: GROQ_API_KEY.substring(0, 10),
          apiKeyLength: GROQ_API_KEY.length,
          triedModels: models
        }
      },
      { status: lastError?.status || 500 }
    )

  } catch (error: any) {
    console.error('API Route Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
