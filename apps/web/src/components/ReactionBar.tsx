"use client";

const EMOJI_OPTIONS = ["❤️", "😂", "😮", "👏", "🔥", "💯", "😢", "👎"] as const;

interface ReactionBarProps {
  counts: Record<string, number>;
  onReact: (emoji: string) => void;
}

/**
 * Horizontal emoji reaction bar with live counts from the Durable Object.
 */
export function ReactionBar({ counts, onReact }: ReactionBarProps) {
  return (
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label="Video reactions"
    >
      {EMOJI_OPTIONS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className="flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm transition hover:border-brand-500 hover:bg-neutral-700 active:scale-90"
            aria-label={`React with ${emoji}${count > 0 ? `, ${count} reactions` : ""}`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && (
              <span className="text-xs tabular-nums text-neutral-300">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
