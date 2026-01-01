'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { askCFO, type ForecastContext } from '@/lib/ai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your CFO assistant. I can answer questions about your 13-week cash forecast, runway, risks, and recommendations. What would you like to know?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mock forecast context (in production, fetch from API/state)
  const forecastContext: ForecastContext = {
    forecast: [],
    kpis: {
      lowestCash: 120000,
      lowestWeek: 7,
      runway: 12,
      burnRate: 30000,
      belowThreshold: 2,
      payrollRisk: 1,
      volatility: 'Medium',
      volatilityScore: 25000,
    },
  }

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUser(user)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await askCFO(input, forecastContext)

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="h-[calc(100vh-250px)] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Chat with your AI CFO Assistant</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ask about cash forecast, runway, risks, or get recommendations
            </p>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your cash forecast..."
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggested Questions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground w-full">Suggested questions:</p>
              {[
                "What's the lowest cash point?",
                'How many weeks of runway do we have?',
                'Which weeks are highest risk?',
                'What should we focus on this month?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  disabled={loading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-900">✅ I can help with:</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• Cash forecast analysis</li>
                  <li>• Runway calculations</li>
                  <li>• Risk identification</li>
                  <li>• Strategic recommendations</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900">📊 Data I use:</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• 13-week forecast</li>
                  <li>• KPI metrics</li>
                  <li>• Anomaly detection</li>
                  <li>• Historical trends</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900">🎯 Example questions:</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• "When do we hit low cash?"</li>
                  <li>• "What are the biggest risks?"</li>
                  <li>• "Should we delay expenses?"</li>
                  <li>• "How to improve runway?"</li>
                </ul>
              </div>
            </div>
          </CardContent>
      </Card>
    </div>
  )
}
