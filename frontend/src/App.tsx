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

  // Simulate pipeline progression
  const simulatePipeline = async () => {
    // Reset pipeline
    setPipeline(initialPipelineState);

    // Step 1: Search events
    setPipeline((prev) => ({
      ...prev,
      search: { status: 'running', details: 'Ticketmaster API • Searching...' },
    }));

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setPipeline((prev) => ({
      ...prev,
      search: { status: 'done', details: 'Ticketmaster API • 10 results' },
      baseline: { status: 'running', details: 'Deterministic • Calculating...' },
    }));

    // Step 2: Baseline scoring
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setPipeline((prev) => ({
      ...prev,
      baseline: { status: 'done', details: 'Deterministic • 135pt max' },
      reasoning: { status: 'running', details: 'Context-aware adjustment' },
    }));

    // Step 3: LLM reasoning
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setPipeline((prev) => ({
      ...prev,
      reasoning: { status: 'done', details: 'Context-aware adjustment' },
      guardrail: { status: 'running', details: 'Validate event IDs' },
    }));

    // Step 4: Guardrail check
    await new Promise((resolve) => setTimeout(resolve, 800));

    setPipeline((prev) => ({
      ...prev,
      guardrail: { status: 'done', details: 'Validate event IDs' },
      result: { status: 'running', details: 'Schema-enforced output' },
    }));

    // Step 5: Present result
    await new Promise((resolve) => setTimeout(resolve, 500));

    setPipeline((prev) => ({
      ...prev,
      result: { status: 'done', details: 'Schema-enforced output' },
    }));
  };

  const sendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Start pipeline simulation
    simulatePipeline();

    // Update stats
    setStats((prev) => ({ ...prev, queries: prev.queries + 1 }));

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || data.response,
        recommendations: data.recommendations || null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update current recommendations state
      setRecommendations(data.recommendations || null);

      // Update stats
      if (data.recommendations) {
        setStats((prev) => ({
          ...prev,
          eventsFound: prev.eventsFound + data.recommendations.length,
          guardrailStatus: 'pass',
        }));
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
          <div className="header-content">
            <h1>Event Campaign Advisor</h1>
            <p className="app-subtitle">
              Powered by MCP • Ticketmaster • Claude
            </p>
          </div>
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
