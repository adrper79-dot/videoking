"use client";

import { useState } from "react";
import type { Poll } from "@nichestream/types";

interface PollWidgetProps {
  poll: Poll | null;
  onVote: (optionId: string) => void;
  onCreatePoll: (question: string, options: string[]) => void;
}

/**
 * Displays an active poll with vote bars, or a creation form if none exists.
 */
export function PollWidget({ poll, onVote, onCreatePoll }: PollWidgetProps) {
  const [userVote, setUserVote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const totalVotes = poll?.votes
    ? Object.values(poll.votes).reduce((a, b) => a + b, 0)
    : 0;

  function handleVote(optionId: string) {
    if (userVote) return;
    setUserVote(optionId);
    onVote(optionId);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!trimmedQuestion || trimmedOptions.length < 2) return;
    onCreatePoll(trimmedQuestion, trimmedOptions);
    setCreating(false);
    setQuestion("");
    setOptions(["", ""]);
  }

  if (poll && poll.status === "active") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <h3 className="font-semibold text-white">{poll.question}</h3>
        <div className="space-y-2" role="radiogroup" aria-label="Poll options">
          {poll.options.map((option) => {
            const voteCount = poll.votes?.[option.id] ?? 0;
            const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isChosen = userVote === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={!!userVote}
                className="relative w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-left text-sm transition hover:border-brand-500 disabled:cursor-default"
                aria-pressed={isChosen}
                aria-label={`${option.text}: ${percent}%`}
              >
                {/* Progress fill */}
                {userVote && (
                  <div
                    className="absolute inset-y-0 left-0 bg-brand-600/30 transition-all"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative flex items-center justify-between">
                  <span className={isChosen ? "font-semibold text-white" : "text-neutral-200"}>
                    {option.text}
                    {isChosen && " ✓"}
                  </span>
                  {userVote && (
                    <span className="text-xs text-neutral-400">{percent}%</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">{totalVotes} votes</p>
      </div>
    );
  }

  if (creating) {
    return (
      <form onSubmit={handleCreate} className="flex flex-col gap-3 p-4">
        <h3 className="font-semibold text-white">Create a Poll</h3>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          maxLength={200}
          required
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
          aria-label="Poll question"
        />
        {options.map((opt, i) => (
          <input
            key={i}
            type="text"
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
            placeholder={`Option ${i + 1}`}
            maxLength={100}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
            aria-label={`Poll option ${i + 1}`}
          />
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="text-sm text-brand-400 hover:underline"
          >
            + Add option
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Launch Poll
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-neutral-400">No active poll.</p>
      <button
        onClick={() => setCreating(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Create a Poll
      </button>
    </div>
  );
}
