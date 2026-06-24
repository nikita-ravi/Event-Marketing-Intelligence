import { useState } from 'react';
import { ChatWindow, type Message, type EventRecommendation } from './components/ChatWindow';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recommendations, setRecommendations] = useState<EventRecommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

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
        content: data.message || data.response, // Support both old and new format
        recommendations: data.recommendations || null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update current recommendations state
      setRecommendations(data.recommendations || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Show error in chat
      const errorResponse: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please make sure the agent backend is running.`,
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Event Campaign Advisor</h1>
        <p className="app-subtitle">
          Find the perfect events to time your marketing campaigns around
        </p>
        {messages.length > 0 && (
          <button className="reset-button" onClick={resetConversation}>
            New Conversation
          </button>
        )}
      </header>

      <main className="app-main">
        <ChatWindow
          messages={messages}
          onSendMessage={sendMessage}
          isLoading={isLoading}
        />
      </main>

      {error && (
        <div className="error-banner">
          Connection issue: {error}
        </div>
      )}

      <footer className="app-footer">
        <p>
          Powered by MCP Tools, Claude, and Ticketmaster Discovery API
        </p>
      </footer>
    </div>
  );
}

export default App;
