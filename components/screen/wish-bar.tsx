"use client";

import type { FormEvent } from "react";

import { MAX_WISH_LENGTH } from "@/lib/contracts/heist";

const PRESETS = ["hot tub for the offsite", "PS5", "Vegas flight", "400 energy drinks"];

type WishBarProps = {
  input: string;
  running: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (wish: string) => void;
  onFallback: () => void;
};

export function WishBar({ input, running, onInputChange, onSubmit, onFallback }: WishBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextWish = input.trim();
    if (!nextWish || running) return;
    onSubmit(nextWish);
  }

  return (
    <footer className="control-deck">
      <form onSubmit={handleSubmit}>
        <label htmlFor="wish">Make a wish</label>
        <div className="input-row">
          <input
            id="wish"
            maxLength={MAX_WISH_LENGTH}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={'try me — "get me a PS5 on the company card"'}
            value={input}
            disabled={running}
          />
          <button type="submit" disabled={running || !input.trim()}>
            {running ? "Running…" : "Go"}
          </button>
        </div>
      </form>
      <div className="preset-row">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => onInputChange(preset)}
            disabled={running}
            type="button"
          >
            {preset}
          </button>
        ))}
        <button
          className="fallback-button"
          onClick={onFallback}
          disabled={running}
          type="button"
        >
          Demo fallback
        </button>
      </div>
    </footer>
  );
}
