interface SuggestionChipsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({
  suggestions,
  onSuggestionClick,
  disabled = false,
}: SuggestionChipsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="suggestion-chips">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          className="suggestion-chip"
          onClick={() => onSuggestionClick(suggestion)}
          disabled={disabled}
        >
          {suggestion}
          <span className="chip-arrow">↗</span>
        </button>
      ))}
    </div>
  );
}
