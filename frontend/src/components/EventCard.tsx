export interface Event {
  id: string;
  name: string;
  date: string;
  time: string | null;
  classification: string;
  venueName: string;
  city: string;
  priceRange: { min: number; max: number } | null;
  score?: number;
  rationale?: string;
}

interface EventCardProps {
  event: Event;
  rank?: number;
}

export function EventCard({ event, rank }: EventCardProps) {
  const formatPrice = (range: { min: number; max: number } | null) => {
    if (!range) return 'Price not available';
    return `$${range.min} - $${range.max}`;
  };

  const formatDateTime = (date: string, time: string | null) => {
    if (date === 'TBD') return 'Date TBD';
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return time ? `${dateStr} at ${time}` : dateStr;
  };

  return (
    <div className="event-card">
      {rank && (
        <div className="event-rank">#{rank}</div>
      )}

      <div className="event-header">
        <h3 className="event-name">{event.name}</h3>
        {event.score !== undefined && (
          <div className="event-score">Score: {event.score}</div>
        )}
      </div>

      <div className="event-details">
        <div className="event-detail">
          <span className="detail-label">Venue:</span>
          <span className="detail-value">{event.venueName}</span>
        </div>

        <div className="event-detail">
          <span className="detail-label">Location:</span>
          <span className="detail-value">{event.city}</span>
        </div>

        <div className="event-detail">
          <span className="detail-label">Date:</span>
          <span className="detail-value">{formatDateTime(event.date, event.time)}</span>
        </div>

        <div className="event-detail">
          <span className="detail-label">Type:</span>
          <span className="detail-value">{event.classification}</span>
        </div>

        <div className="event-detail">
          <span className="detail-label">Price Range:</span>
          <span className="detail-value">{formatPrice(event.priceRange)}</span>
        </div>
      </div>

      {event.rationale && (
        <div className="event-rationale">
          <div className="rationale-label">Why this event:</div>
          <div className="rationale-text">{event.rationale}</div>
        </div>
      )}
    </div>
  );
}
