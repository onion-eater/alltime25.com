# Deploy AllTime 25 to Vercel

AllTime 25 deploys as a static Vite application. It needs no database, Python
runtime, serverless function, cookie, or runtime environment variable.

## First deployment

1. Push the repository to GitHub.
2. In Vercel, select **Add New → Project** and import the repository.
3. Leave the project root at the repository root.
4. Confirm the framework is **Vite** and Node.js is version 22.
5. Deploy.

The checked-in `vercel.json` supplies:

- install command: `npm --prefix apps/web ci`;
- build command: `npm --prefix apps/web run build`;
- output directory: `apps/web/dist`;
- static caching and security headers.

Do not add a database or runtime secrets. Catalog-import credentials and source
files are offline inputs and never belong in Vercel.

## Domain

Add `alltime25.com` under **Project Settings → Domains**. Vercel displays the
DNS records required for the selected registrar. Configure both the apex domain
and `www`, then choose one as the redirect target so the product has one
canonical address.

## Release verification

Run the complete repository gate before deployment:

```bash
uv sync --frozen --group dev
uv run ruff check .
uv run ruff format --check .
uv run python -m pytest
uv run python scripts/check_architecture.py

npm --prefix apps/web ci
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
npm --prefix apps/web run test:e2e
npm --prefix apps/web audit --audit-level=high
```

After Vercel builds, verify:

- the home page loads without an API request;
- `/data/current.json` resolves;
- the current players and pools JSON resolve;
- several current player portraits resolve;
- Normal and Blind rankings can vote, undo, reload, review, and restart;
- a completed ranking shares or downloads one image;
- a hard reload preserves the exact comparison;
- no runtime environment variables are configured.

## Catalog releases

Do not edit a released catalog directory. Build and verify a new catalog with a
new ID, add its static files, and update `catalog/data/current.json` in the same
commit. Old catalog directories stay deployed so saved rankings can resume.

Follow [scripts/catalog/README.md](../../scripts/catalog/README.md) and
[data-provenance.md](../data-provenance.md) for the import and validation
workflow.

## Rollback

Use Vercel's previous deployment promotion to restore the prior static build.
Because saved sessions include their immutable catalog ID, a rollback remains
resumable only while that deployment contains the referenced catalog. Never
remove an old catalog in an emergency rollback.
