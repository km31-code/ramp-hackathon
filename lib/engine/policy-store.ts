import type { SynthesizedRule } from "@/lib/contracts/heist";

export class InMemoryPolicyStore {
  private readonly rules = new Map<string, SynthesizedRule>();

  constructor(private readonly capacity = 64) {}

  snapshot(): SynthesizedRule[] {
    return [...this.rules.values()];
  }

  add(rule: SynthesizedRule): void {
    if (this.rules.has(rule.id)) return;
    if (this.rules.size >= this.capacity) {
      const oldest = this.rules.keys().next().value as string | undefined;
      if (oldest) this.rules.delete(oldest);
    }
    this.rules.set(rule.id, rule);
  }

  clear(): void {
    this.rules.clear();
  }
}

export const policyStore = new InMemoryPolicyStore();
