import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ConfirmModal } from './ConfirmModal';

export interface EventRecommendation {
  eventId: string;
  name: string;
  venue?: string;
  city?: string;
  date?: string;
  time?: string | null;
  score?: number;
  rationale?: string;
  classification?: string;
  priceRange?: { min: number; max: number } | null;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: EventRecommendation[] | null;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatWindow({ messages, onSendMessage, isLoading }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleAddToCalendar = (eventName: string) => {
    setSelectedEvent(eventName);
    setModalOpen(true);
  };

  const handleConfirmAdd = () => {
    // TODO: Implement calendar integration
    console.log('Added to calendar:', selectedEvent);
    setModalOpen(false);
    setSelectedEvent('');
  };

  const handleCancelAdd = () => {
    setModalOpen(false);
    setSelectedEvent('');
  };

  // Render assistant message with event cards
  const renderAssistantMessage = (content: string, recommendations?: EventRecommendation[] | null) => {
    if (!recommendations || recommendations.length === 0) {
      // No event recommendations, render as normal markdown
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }

    // Render markdown content and event cards
    return (
      <>
        <ReactMarkdown>{content}</ReactMarkdown>

        <div className="event-recommendations">
          {recommendations.map((event, index) => {
            const dateTimeStr = event.time
              ? `${event.date} at ${event.time}`
              : event.date;

            const locationStr = event.city
              ? `${event.venue}, ${event.city}`
              : event.venue;

            const scorePercentage = event.score ? (event.score / 135) * 100 : 0;

            return (
              <div key={event.eventId} className="event-recommendation-card">
                <h3 className="event-card-name">{event.name}</h3>

                <div className="event-card-location-date">
                  {locationStr} • {dateTimeStr}
                </div>

                {event.score !== undefined && (
                  <div className="event-card-score">
                    <div className="score-label">Score: {event.score}/135</div>
                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{ width: `${scorePercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {event.rationale && (
                  <div className="event-card-rationale">
                    {event.rationale}
                  </div>
                )}

                <button
                  className="add-to-calendar-button"
                  onClick={() => handleAddToCalendar(event.name)}
                >
                  Add to Campaign Calendar
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <>
      <div className="chat-window">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <h2>Event Campaign Advisor</h2>
              <p>Ask me to find events for your brand's next campaign.</p>
              <div className="example-queries">
                <p><strong>Try asking:</strong></p>
                <ul>
                  <li>"Find music events in Los Angeles for my restaurant brand"</li>
                  <li>"Show me sports events in Chicago for an automotive campaign"</li>
                  <li>"What concerts are happening in NYC for a retail brand?"</li>
                </ul>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.role}`}>
              <div className="message-content">
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  renderAssistantMessage(msg.content, msg.recommendations)
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-bubble assistant">
              <div className="message-content loading">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about events for your campaign..."
            disabled={isLoading}
            className="message-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            Send
          </button>
        </form>
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        title="Add to Campaign Calendar"
        message={`Add ${selectedEvent} to your campaign calendar?`}
        onConfirm={handleConfirmAdd}
        onCancel={handleCancelAdd}
      />
    </>
  );
}
