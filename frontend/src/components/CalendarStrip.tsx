import { useRef, useEffect } from 'react';

interface CalendarStripProps {
  savedDates: string[];
}

export function CalendarStrip({ savedDates }: CalendarStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Generate next 6 months of dates
  const getDates = () => {
    const dates = [];
    const today = new Date();
    const end = new Date(today);
    end.setMonth(today.getMonth() + 6);
    const current = new Date(today);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const formatDay = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'short' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Use local date parts to avoid UTC offset shifting the date by a day
  const getDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dates = getDates();

  // When savedDates changes, scroll the most recently added date to center of strip
  useEffect(() => {
    if (savedDates.length === 0) return;
    const mostRecent = savedDates[savedDates.length - 1];
    const el = dateRefs.current.get(mostRecent);
    const container = scrollContainerRef.current;
    if (el && container) {
      const targetLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  }, [savedDates]);

  return (
    <div className="calendar-strip">
      <div className="calendar-label">Campaign calendar</div>
      <div className="calendar-dates" ref={scrollContainerRef}>
        {dates.map((date) => {
          const dateStr = getDateString(date);
          const isHighlighted = savedDates.includes(dateStr);

          return (
            <div
              key={dateStr}
              ref={(el) => {
                if (el) dateRefs.current.set(dateStr, el);
                else dateRefs.current.delete(dateStr);
              }}
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
