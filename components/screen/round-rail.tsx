import { MAX_ROUNDS } from "@/lib/contracts/heist";

type RoundRailProps = {
  currentRound?: number;
  phase: "idle" | "round" | "adapting" | "ended" | "error";
  subtitle?: string;
};

export function RoundRail({ currentRound, phase, subtitle }: RoundRailProps) {
  const intensity = currentRound ?? 0;

  return (
    <div className={`round-rail round-rail-${phase} intensity-${intensity}`}>
      <span className="round-rail-label">Round</span>
      <strong className="round-rail-value">
        {currentRound ?? "–"}
        <span> / {MAX_ROUNDS}</span>
      </strong>
      {subtitle ? <span className="round-rail-subtitle">{subtitle}</span> : null}
      {phase === "adapting" ? <span className="round-rail-status">Learning</span> : null}
      {phase === "ended" ? <span className="round-rail-status">Complete</span> : null}
    </div>
  );
}
