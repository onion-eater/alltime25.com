# Private beta deployment

Blind 50 ships as one container. FastAPI serves the API, immutable player
assets, and the React application on one origin. PostgreSQL is external and
managed.

## Release blockers

Do not deploy the private beta until all of these are true:

- SportsDataIO has confirmed historical-data display, image caching, and beta
  display rights in writing.
- The licensed import covers exactly the frozen 100-player pool.
- `manifest.json`, `review.csv`, and all 100 image hashes pass review.
- The selected catalog is not the checked-in development fixture.
- The edge password, rate limits, database backups, alerts, and restore test
  are active.
- Every CI job is green.

The provider API key is import-only. It must never exist in the application
image or runtime environment.

## Runtime configuration

Set only these application variables:

```text
BLIND50_DATABASE_URL
BLIND50_CURRENT_CATALOG_ID
BLIND50_ALLOWED_ORIGIN
BLIND50_LOG_LEVEL
BLIND50_ENVIRONMENT_NAME=beta
```

`BLIND50_ALLOWED_ORIGIN` is the exact public HTTPS origin. The database URL
uses `postgresql+psycopg://`.

## Deploy

1. Verify the licensed catalog before building:

   ```bash
   uv run --project apps/api python scripts/catalog/verify_catalog.py \
     --catalog-id <catalog-id>
   ```

2. Build the immutable image:

   ```bash
   docker build --pull -t blind50:<release> .
   ```

3. Run database migrations as a one-off command using the release image:

   ```bash
   docker run --rm --entrypoint python <runtime-options> \
     blind50:<release> -m blind50.cli.migrate
   ```

4. Deploy two application workers from that exact image.
5. Require a shared password at the hosting edge. Do not add application
   accounts.
6. At the edge, rate-limit session creation separately from vote, undo, and
   delete mutations.
7. Verify `/api/v1/health`, `/api/v1/ready`, the root page, and a complete
   throwaway ranking.

The container entrypoint also applies idempotent Alembic migrations before
starting workers. The one-off migration is retained as the controlled release
gate.

## Scheduled cleanup

Run this once per day from the deployed image with the production database
configuration:

```bash
python -m blind50.cli.cleanup
```

The command deletes expired sessions and their related votes and operations in
one database transaction.

## Backups and restore

- Take managed PostgreSQL backups daily.
- Retain at least seven daily restore points.
- Encrypt backups and restrict restore access to the deployment operators.
- Test a restore before beta invitations and after material schema changes.

Restore drill:

1. Restore the latest backup into an isolated PostgreSQL instance.
2. Point the same release image at the restored instance.
3. Run `python -m blind50.cli.migrate`.
4. Verify readiness, aggregate session counts, one resumable session, and one
   completed result.
5. Record recovery time, recovery point, release image, and operator.
6. Destroy the isolated restored database after the drill.

Never log restored ranking contents or full session identifiers.

## Monitoring and rollback

Alert on readiness failures, elevated 5xx responses, mutation conflicts above
the expected baseline, database connection failures, and sharp drops in
ranking completion. Retain aggregate counts only: created, active, completed,
expired, conflicts, and request failures.

Application request logs are structured and replace session identifiers with
`{session_id}`. Uvicorn access logs are disabled to prevent raw URLs from
duplicating identifiers.

Rollback uses the prior immutable image and its compatible catalog files. Do
not delete old catalogs while retained sessions reference them. Database
rollback is restore-based; never downgrade or rewrite production state in
place without a tested migration plan.
