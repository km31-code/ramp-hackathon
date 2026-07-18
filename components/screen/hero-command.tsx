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
        <p className="hero-tagline">
          Watch an attacker probe spend policy, learn from every denial, and try again.
        </p>
        <p className="hero-sub">
          Seven different attacks stream in each round. If one breaches, Codex converts the exact
          failure into a validated deterministic rule and installs it immediately.
        </p>

        <div className="powered-by">
          <span>Powered by</span>
          <Image src="/codex-mark.svg" alt="Codex" width={120} height={32} className="codex-mark" />
        </div>

        <ol className="story-flow" aria-label="How a heist works">
          <li><span>01</span><strong>Wish</strong><small>User names the forbidden goal</small></li>
          <li><span>02</span><strong>Attack × 7</strong><small>Schemer tries distinct techniques</small></li>
          <li><span>03</span><strong>Learn + retry</strong><small>Denials drive a smarter round</small></li>
          <li><span>04</span><strong>Codex patches</strong><small>A breach becomes policy</small></li>
        </ol>

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
