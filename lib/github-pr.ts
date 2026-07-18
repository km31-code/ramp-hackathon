import { getPatchPayload } from "@/lib/mock";

export type PrResult =
  | { status: "opened"; title: string; url: string; body: string }
  | { status: "preview"; title: string; body: string };

/**
 * Best-effort GitHub PR. Never throws to the caller — returns preview on any failure.
 */
export async function tryOpenLearnedPatternsPr(): Promise<PrResult> {
  const patch = getPatchPayload();
  const title = "feat: lock in learned spend-attack patterns";
  const body = [
    "## Summary",
    "- Encode Attack Memory patterns from the Expense Heist demo as permanent rules.",
    "",
    "## Test plan",
    "- [ ] Confirm learned patterns match Round 1 breaches",
    "- [ ] Confirm policy engine can import the new module",
  ].join("\n");

  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim() || "km31-code/ramp-hackathon";

  if (!token) {
    return {
      status: "preview",
      title,
      body: `${body}\n\n_Preview only — set GITHUB_TOKEN to open a real PR._`,
    };
  }

  try {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
      return { status: "preview", title, body: `${body}\n\n_Invalid GITHUB_REPO._` };
    }

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "expense-heist-demo",
    };

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers,
    });
    if (!repoRes.ok) {
      return {
        status: "preview",
        title,
        body: `${body}\n\n_Could not read repo (${repoRes.status})._`,
      };
    }
    const repoJson = (await repoRes.json()) as { default_branch: string };
    const base = repoJson.default_branch || "main";

    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${name}/git/ref/heads/${base}`,
      { headers },
    );
    if (!refRes.ok) {
      return {
        status: "preview",
        title,
        body: `${body}\n\n_Could not read base ref (${refRes.status})._`,
      };
    }
    const refJson = (await refRes.json()) as { object: { sha: string } };
    const baseSha = refJson.object.sha;
    const branch = `demo/learned-patterns-${Date.now().toString(36)}`;

    const createRef = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (!createRef.ok) {
      return {
        status: "preview",
        title,
        body: `${body}\n\n_Could not create branch (${createRef.status})._`,
      };
    }

    const content = Buffer.from(
      `export const LEARNED_PATTERNS = [
  {
    id: "structuring",
    rule: "MEMORY_STRUCTURING",
    detect: "multiple sub-limit charges reconstituting one purchase",
  },
  {
    id: "invisible_ink",
    rule: "MEMORY_INVISIBLE_INK",
    detect: "concealed white-text instructions in invoice notes",
  },
  {
    id: "vendor_laundering",
    rule: "MEMORY_VENDOR_LAUNDERING",
    detect: "approved vendor used outside normal category for evasion",
  },
] as const;
`,
      "utf8",
    ).toString("base64");

    const putFile = await fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/${patch.filename}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: title,
          content,
          branch,
        }),
      },
    );
    if (!putFile.ok) {
      return {
        status: "preview",
        title,
        body: `${body}\n\n_Could not write file (${putFile.status})._`,
      };
    }

    const prRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        head: branch,
        base,
        body,
      }),
    });
    if (!prRes.ok) {
      return {
        status: "preview",
        title,
        body: `${body}\n\n_Could not open PR (${prRes.status})._`,
      };
    }

    const prJson = (await prRes.json()) as { html_url: string };
    return {
      status: "opened",
      title,
      url: prJson.html_url,
      body,
    };
  } catch {
    return {
      status: "preview",
      title,
      body: `${body}\n\n_Network or auth failed — showing preview instead._`,
    };
  }
}
