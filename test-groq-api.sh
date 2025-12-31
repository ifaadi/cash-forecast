#!/bin/bash
# Test Groq API Key
# Replace YOUR_API_KEY with your actual Groq API key

echo "🧪 Testing Groq API Key..."
echo ""

API_KEY="YOUR_API_KEY_HERE"

curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-70b-versatile",
    "messages": [
      {
        "role": "user",
        "content": "Say hello in 5 words"
      }
    ],
    "max_tokens": 50
  }' | jq '.'

echo ""
echo "If you see a JSON response with 'choices', your API key works! ✅"
echo "If you see error 400/401, your API key may be invalid or inactive. ❌"
