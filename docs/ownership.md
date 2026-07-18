# Ownership map

Fill in the names and GitHub usernames before hacking starts.

| Responsibility | Person | GitHub username |
| --- | --- | --- |
| Engine lead | _assign_ | `@assign` |
| Screen lead | _assign_ | `@assign` |
| Integration/deploy owner | _assign_ | `@km31-code` |

## Path ownership

| Path | Owner | Review needed from |
| --- | --- | --- |
| `app/api/**` | Engine | Engine lead |
| `lib/engine/**` | Engine | Engine lead |
| `app/page.tsx` | Screen | Screen lead |
| `app/globals.css` | Screen | Screen lead |
| `components/screen/**` | Screen | Screen lead |
| `lib/contracts/**` | Shared contract | Both builders |
| `lib/mock.ts` | Shared fixture | Both builders |
| `.github/**`, root config, dependencies | Integration | Both builders |
| `expense-heist-spec.md`, `docs/**` | Shared documentation | Either builder |

## Update CODEOWNERS

GitHub only recognizes real usernames in `.github/CODEOWNERS`. Once the teammate accepts the invitation, replace the temporary owner-only rules with the actual assignment, for example:

```text
/app/api/ @ENGINE_USERNAME
/lib/engine/ @ENGINE_USERNAME
/app/page.tsx @SCREEN_USERNAME
/app/globals.css @SCREEN_USERNAME
/components/screen/ @SCREEN_USERNAME
/lib/contracts/ @ENGINE_USERNAME @SCREEN_USERNAME
/lib/mock.ts @ENGINE_USERNAME @SCREEN_USERNAME
/.github/ @km31-code @TEAMMATE_USERNAME
```

Do this in one small integration PR before feature work starts.
