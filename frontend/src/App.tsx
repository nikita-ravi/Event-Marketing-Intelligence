import { useState, useEffect } from 'react';
import { ChatWindow, type Message, type EventRecommendation } from './components/ChatWindow';
import { PipelineSidebar, type PipelineState } from './components/PipelineSidebar';
import { CalendarStrip } from './components/CalendarStrip';
import { SessionStatsComponent, type SessionStats } from './components/SessionStats';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const initialPipelineState: PipelineState = {
  search: { status: 'pending' },
  baseline: { status: 'pending' },
  reasoning: { status: 'pending' },
  guardrail: { status: 'pending' },
  result: { status: 'pending' },
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recommendations, setRecommendations] = useState<EventRecommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for demo features
  const [pipeline, setPipeline] = useState<PipelineState>(initialPipelineState);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    queries: 0,
    eventsFound: 0,
    guardrailStatus: 'pending',
    savedEvents: 0,
  });

  const sendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Reset pipeline
    setPipeline(initialPipelineState);

    // Update stats
    setStats((prev) => ({ ...prev, queries: prev.queries + 1 }));

    // Get last turn only (last user message + last assistant response)
    // This provides context for follow-ups without sending full history
    const lastTurn = messages.length >= 2
      ? messages.slice(-2).map(msg => ({ role: msg.role, content: msg.content }))
      : [];

    try {
      // Use fetch to POST message, then receive SSE stream
      const response = await fetch(`${API_URL}/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          chatHistory: lastTurn
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'final') {
              // Final response with message and recommendations
              const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                recommendations: data.recommendations || null,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setRecommendations(data.recommendations || null);

              // Update stats
              if (data.recommendations) {
                setStats((prev) => ({
                  ...prev,
                  eventsFound: prev.eventsFound + data.recommendations.length,
                  guardrailStatus: 'pass',
                }));
              }
            } else if (data.type === 'error') {
              throw new Error(data.error);
            } else if (data.step) {
              // Pipeline event - update pipeline state
              setPipeline((prev) => ({
                ...prev,
                [data.step]: { status: data.status, details: data.details },
              }));
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Show error in chat
      const errorResponse: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please make sure the agent backend is running.`,
      };
      setMessages((prev) => [...prev, errorResponse]);

      // Mark pipeline as failed
      setPipeline((prev) => ({
        ...prev,
        result: { status: 'failed', details: 'Error occurred' },
      }));

      setStats((prev) => ({ ...prev, guardrailStatus: 'fail' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCalendar = (eventDate: string) => {
    if (!savedDates.includes(eventDate)) {
      setSavedDates((prev) => [...prev, eventDate]);
      setStats((prev) => ({ ...prev, savedEvents: prev.savedEvents + 1 }));
    }
  };

  const resetConversation = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      setMessages([]);
      setError(null);
      setPipeline(initialPipelineState);
      setSavedDates([]);
      setStats({
        queries: 0,
        eventsFound: 0,
        guardrailStatus: 'pending',
        savedEvents: 0,
      });
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  return (
    <div className="app-with-sidebar">
      {/* Left Sidebar */}
      <aside className="sidebar-left">
        <PipelineSidebar pipeline={pipeline} />
        <SessionStatsComponent stats={stats} />
      </aside>

      {/* Main Content */}
      <div className="app-main-content">
        <header className="app-header">
          <h1>Event Campaign Advisor</h1>
          {messages.length > 0 && (
            <button className="reset-button" onClick={resetConversation}>
              New conversation
            </button>
          )}
        </header>

        {/* Campaign Calendar Strip */}
        {messages.length > 0 && <CalendarStrip savedDates={savedDates} />}

        <main className="app-main">
          <ChatWindow
            messages={messages}
            onSendMessage={sendMessage}
            onAddToCalendar={handleAddToCalendar}
            isLoading={isLoading}
          />
        </main>

        {error && (
          <div className="error-banner">
            Connection issue: {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
