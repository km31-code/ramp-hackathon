"use client";

import type { FormEvent } from "react";

import { MAX_WISH_LENGTH } from "@/lib/contracts/heist";

const CHIPS = [
  "PS5 on the company card",
  "Hot tub for the offsite",
  "Business‑class to Vegas",
  "400 energy drinks",
];

type HeroCommandProps = {
  input: string;
  running: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (wish: string) => void;
  onFallback: () => void;
};

export function HeroCommand({
  input,
  running,
  onInputChange,
  onSubmit,
  onFallback,
}: HeroCommandProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    if (!next || running) return;
    onSubmit(next);
  }

  return (
    <section className="hero" id="console">
      <div className="hero-gradient" aria-hidden="true" />
      <div className="hero-inner">
        <h1 className="hero-title">Patchline</h1>
        <p className="hero-tagline">
          The authorization layer between agents and the payment rail.
        </p>

        <div className="powered-by">
          <span>Powered by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/codex-mark.svg" alt="Codex" width={120} height={32} className="codex-mark" />
        </div>

        <form className="command-bar" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="probe-input">
            Probe request
          </label>
          <input
            id="probe-input"
            maxLength={MAX_WISH_LENGTH}
            value={input}
            disabled={running}
            placeholder="get me a PS5 on the company card"
            onChange={(event) => onInputChange(event.target.value)}
          />
          <button type="submit" disabled={running || !input.trim()}>
            {running ? "Running…" : "Run probe"}
          </button>
        </form>

        <div className="chip-row">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              className="chip"
              type="button"
              disabled={running}
              onClick={() => {
                onInputChange(chip);
                onSubmit(chip);
              }}
            >
              {chip}
            </button>
          ))}
          <button className="fallback-link" type="button" disabled={running} onClick={onFallback}>
            Demo fallback
          </button>
        </div>
      </div>
    </section>
  );
}
