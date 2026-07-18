"use client";

import Image from "next/image";
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
  targetWish: string;
  statusLabel: string;
  onInputChange: (value: string) => void;
  onSubmit: (wish: string) => void;
  onFallback: () => void;
};

export function HeroCommand({
  input,
  running,
  targetWish,
  statusLabel,
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
        <p className="hero-eyebrow">Live adaptive policy red team</p>
        <h1 className="hero-title">Patchline</h1>
        <p className="hero-tagline">The authorization layer between agents and the payment rail.</p>

        <div className="powered-by">
          <Image src="/codex-app-icon.png" alt="" width={40} height={40} className="codex-mark" />
          <p><span>Powered by</span><strong>Codex</strong></p>
        </div>

        <div className="active-target" aria-live="polite">
          <span>{statusLabel}</span>
          <strong>“{targetWish}”</strong>
        </div>

        <form className="command-bar" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="probe-input">
            Adversary wish
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
            {running ? "Attacker running…" : "Launch attacker"}
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
