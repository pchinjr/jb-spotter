# Repository Guidelines

## Project Structure & Module Organization
TypeScript source lives in `lambda/` and compiles to deployable JavaScript under `src/` via `tsc`. `lambda/process-image.ts` owns the `/process` pipeline, and `lambda/static.ts` serves the single-page frontend shell. Infrastructure, IAM, and bucket policies are defined in `template.yaml`, while `deploy.sh` wraps the SAM build/deploy path. Keep reference assets (`JEFF_IMAGE_GUIDE.md`, `jeff-barr*.png`) at the repo root and store fixtures in `tests/`.

## Build, Test, and Development Commands
- `npm install` — install root dependencies (run inside `lambda/` only if you add per-function modules).
- `npm run build` — run strict `tsc` per `tsconfig.json` to refresh all JS in `src/`.
- `sam local start-api [--profile dev]` — serve the API locally and drive `/process` via curl or the web UI.
- `npm run deploy` or `./deploy.sh` — wrap `sam build && sam deploy`, pulling stack values from `samconfig.toml`.
Export `BUCKET_NAME` (or set it via `sam local`) before any local execution so Sharp can load `jeff-barr.png`.

## Coding Style & Naming Conventions
Stick to TypeScript strict mode, 2-space indentation, and `async/await` for AWS SDK calls. Files are lowercase kebab-case (`process-image.ts`), functions camelCase, and configuration or environment values SCREAMING_SNAKE_CASE. Keep helpers near their handler, add comments only for non-obvious math (e.g., face positioning), and run `npx tsc --noEmit` before opening a PR.

## Testing Guidelines
Add lightweight Jest or SAM-based checks whenever you touch business logic. Name fixtures after the behavior under test (e.g., `tests/process/oversized-image.json`) and invoke them with `sam local invoke ProcessImageFunction --event tests/process/<case>.json`. Cover validation, Rekognition fallbacks, and presigned URL generation before you consider a change done.

## Commit & Pull Request Guidelines
History shows short, imperative subjects (“Add working Jeff Barr selfie superimposer”), so keep commits ≤72 characters and reserve the body for nuance or rollouts. Pull requests should include a summary, linked issue or TODO, screenshots or sample URLs for UI/image tweaks, and the commands you ran (`npm run build`, `sam local start-api`). Request review only when the SAM template, compiled JS, and assets are all updated together.

## Security & Configuration Notes
The SAM template already enforces encrypted private S3 buckets and scoped Rekognition permissions—keep those guardrails in place. Never commit selfies, secrets, or `.aws` credentials; store env-specific data in Parameter Store or `samconfig`. When rotating the overlay, upload the new transparent `<10 MB jeff-barr.png` to the bucket before merging code that expects it, and double-check `BUCKET_NAME`/`LOG_LEVEL` locally.
