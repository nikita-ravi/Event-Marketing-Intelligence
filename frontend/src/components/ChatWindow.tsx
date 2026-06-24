import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ConfirmModal } from './ConfirmModal';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

interface EventRecommendation {
  number: number;
  name: string;
  venue?: string;
  date?: string;
  score?: string;
  rationale?: string;
  fullText: string;
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

  // Parse event recommendations from assistant message
  const parseEventRecommendations = (content: string): EventRecommendation[] => {
    const events: EventRecommendation[] = [];

    // Match numbered recommendations (e.g., "### 1. **Event Name**" or "1. **Event Name**")
    const pattern = /(?:^|\n)(?:###\s+)?(\d+)\.\s+\*\*([^*]+)\*\*/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const number = parseInt(match[1]);
      const name = match[2].trim();
      const startIdx = match.index;

      // Find the end of this recommendation (next number or end of content)
      const nextMatch = pattern.exec(content);
      const endIdx = nextMatch ? nextMatch.index : content.length;
      pattern.lastIndex = nextMatch ? nextMatch.index : content.length;

      const fullText = content.substring(startIdx, endIdx).trim();

      // Extract venue, date, score from the recommendation text
      const venueMatch = fullText.match(/(?:Venue:|📍)\s*\*\*([^*]+)\*\*/);
      const dateMatch = fullText.match(/(?:Date:|📅)\s*([^\n]+)/);
      const scoreMatch = fullText.match(/Score:\s*(\d+(?:\/\d+)?)/i);

      // Extract rationale (text after "Why" or "Rationale")
      const rationaleMatch = fullText.match(/(?:Why[^:]*:|Rationale:)\s*([^\n]+(?:\n(?!###|\d+\.)[^\n]+)*)/i);

      events.push({
        number,
        name,
        venue: venueMatch ? venueMatch[1].trim() : undefined,
        date: dateMatch ? dateMatch[1].trim() : undefined,
        score: scoreMatch ? scoreMatch[1] : undefined,
        rationale: rationaleMatch ? rationaleMatch[1].trim() : undefined,
        fullText
      });
    }

    return events;
  };

  // Render assistant message with event cards
  const renderAssistantMessage = (content: string) => {
    const events = parseEventRecommendations(content);

    if (events.length === 0) {
      // No event recommendations, render as normal markdown
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }

    // Split content into parts: before events, events, after events
    const firstEventIdx = content.indexOf(events[0].fullText);
    const lastEvent = events[events.length - 1];
    const lastEventIdx = content.indexOf(lastEvent.fullText) + lastEvent.fullText.length;

    const beforeEvents = content.substring(0, firstEventIdx);
    const afterEvents = content.substring(lastEventIdx);

    return (
      <>
        {beforeEvents && <ReactMarkdown>{beforeEvents}</ReactMarkdown>}

        <div className="event-recommendations">
          {events.map((event) => (
            <div key={event.number} className="event-recommendation-card">
              <div className="event-card-header">
                <span className="event-number">#{event.number}</span>
                <h3 className="event-card-name">{event.name}</h3>
              </div>

              {event.venue && (
                <div className="event-card-detail">
                  <strong>Venue:</strong> {event.venue}
                </div>
              )}

              {event.date && (
                <div className="event-card-detail">
                  <strong>Date:</strong> {event.date}
                </div>
              )}

              {event.score && (
                <div className="event-card-detail">
                  <strong>Score:</strong> {event.score}
                </div>
              )}

              {event.rationale && (
                <div className="event-card-rationale">
                  <strong>Why:</strong> {event.rationale}
                </div>
              )}

              <button
                className="add-to-calendar-button"
                onClick={() => handleAddToCalendar(event.name)}
              >
                Add to Campaign Calendar
              </button>
            </div>
          ))}
        </div>

        {afterEvents && <ReactMarkdown>{afterEvents}</ReactMarkdown>}
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
                  renderAssistantMessage(msg.content)
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
