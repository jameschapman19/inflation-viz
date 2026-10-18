# Deployment setup

Agriculture Radar uses the same release architecture as Inflation Radar: a public repository (`radar-open`), a private repository (`radar`), and Vercel's native GitHub integration for the visualization.

## Product comparison

| Setting or process | Inflation Radar | Agriculture Radar |
| --- | --- | --- |
| Visualization repository | Public `jameschapman19/radar-open` (repository root) | Same repository, `agriculture/` |
| Forecasting repository | Private `jameschapman19/radar` (repository root) | Same repository, `agriculture/` |
| Vercel team | `jameschapman19s-projects` | Same |
| Framework and build root | Native Next.js, `web` | Native Next.js, `agriculture/web` |
| Install, build, output settings | Vercel's automatic Next.js defaults | Same |
| Production Node.js / web CI | 24.x / 22 | Same |
| Python baseline | 3.12 | Same |
| Python CI | Ruff lint/format, strict mypy, pytest | Same |
| Web CI | `npm ci`, ESLint, production build | Same |
| Observation refresh | Daily 08:00 UTC and manual | Same |
| Forecast release | Manual workflow, output-only PR, merge to `main` | Same |
| Production and previews | GitHub `main`; previews for other branches | Same |

Provider adapters, units, commodity forecasts, and public data paths remain specific to agriculture. Each frontend pins its own tested Next.js and React maintenance versions. Vercel only builds the visualization's committed data and frontend; Python fetches and private modeling run in GitHub Actions.

## Vercel project

- Production: https://agriculture-radar-omega.vercel.app
- Project: `agriculture-radar`
- Team: `jameschapman19s-projects`
- Project ID: `prj_EpgQ9jHBSlfLxVAti7ZdIdGvKNTs`
- Root Directory: `agriculture/web`
- Node.js: 24.x
- Framework: Next.js
- Install, Build, and Output Directory: automatic; leave overrides unset
- Production Branch: `main`

Both repositories are published with the visibility shown above. The Vercel project is connected to `jameschapman19/radar-open`, with `main` as its production branch. Observation commits and merged forecast PRs use Vercel's Git integration, matching Inflation Radar. CLI deployment is available for manual recovery.

For CLI releases, link and deploy from the `agriculture/` directory, as shown in the README. Local `.vercel/project.json` files are ignored by git, and authentication stays outside the source repository. Do not deploy the `web` subdirectory on its own after the project root has been set to `agriculture/web`.

## Forecast publishing access

The private repository's manual **Agriculture publish forecast** workflow needs the Actions secret `RADAR_OPEN_PUSH_TOKEN`, shared with the inflation workflow. It must grant contents and pull-request write access to `jameschapman19/radar-open`. Store it only as an Actions secret; it is not required by the frontend or Vercel. No scheduled forecast publication or separate Vercel CLI deployment workflow is configured.

## Verification

Local Python lint, format, strict typing, and tests pass in both projects. Frontend clean installation, lint, TypeScript checking, and production build pass. All four workflow files pass actionlint validation. GitHub CI has passed for the initial implementation in both repositories.

For each release, verify the production deployment's GitHub commit SHA in Vercel, then check the crop selectors, country values, source drawer, methodology route, forecast toggle, CSV downloads, and mobile layout. Vercel records the exact source commit with each deployment.
