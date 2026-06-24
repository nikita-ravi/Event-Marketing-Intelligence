interface CalendarStripProps {
  savedDates: string[]; // Array of date strings like "2026-08-01"
}

export function CalendarStrip({ savedDates }: CalendarStripProps) {
  // Generate next 14 days
  const getDates = () => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const formatDay = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const dates = getDates();

  return (
    <div className="calendar-strip">
      <div className="calendar-label">Campaign calendar</div>
      <div className="calendar-dates">
        {dates.map((date) => {
          const dateStr = getDateString(date);
          const isHighlighted = savedDates.includes(dateStr);

          return (
            <div
              key={dateStr}
              className={`calendar-date ${isHighlighted ? 'highlighted' : ''}`}
            >
              <div className="date-day">{formatDay(date)}</div>
              <div className="date-number">{formatDate(date)}</div>
              {isHighlighted && <div className="date-indicator" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
