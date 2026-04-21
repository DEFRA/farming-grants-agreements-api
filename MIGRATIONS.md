# Database Migration Setup - Verification Guide

## What Was Set Up

Your migration system is now fully configured to run migrations automatically when the server starts. Here's what was done:

### 1. **Dependencies Added**

- ✅ `migrate-mongo@^11.0.0` - Added to package.json dependencies

### 2. **Files Created/Modified**

#### New Files:

- `migrate-mongo-config.js` - Migration configuration file
- `verify-migrations.sh` - Script to verify migration setup

#### Modified Files:

- `package.json` - Added migration scripts and migrate-mongo dependency
- `migrate-mongo-config.js` - Updated to use MongoDB URI from environment
- `src/api/agreement/index.js` - Integrated migration runner at startup
- `migrations/20260427120000-grant-migration.js` - Added rollback (down) function

### 3. **New NPM Scripts**

```bash
npm run migrate:up      # Manually run migrations up
npm run migrate:down    # Manually rollback migrations
npm run migrate:status  # Check migration status
```

## How to Verify It Works

### Option 1: Run Migration Status Check

```bash
# Set MongoDB connection and check migration status
MONGO_URL=mongodb://localhost:27017/ npm run migrate:status
```

### Option 2: Start the Application (Automatic Migration)

When you run the application normally:

```bash
npm run dev                # Development mode
# OR
npm start                  # Production mode
```

The server will:

1. Load configuration (including MongoDB URI)
2. Automatically run all pending migrations
3. Log migration progress in the console
4. Start the API server

### Option 3: Docker Compose (Full Stack)

```bash
docker compose up mongodb
# Wait for MongoDB to be ready, then:
npm run dev
```

## Expected Output

When migrations run successfully, you should see output similar to:

```
[INFO] Running database migrations...
[INFO] [Migration] UP: 20260427120000-grant-migration.js
[INFO] [Migration] - Found 5 agreements without grants.
[INFO] [Migration] - Created default grant... for agreement...
[INFO] Migrations completed successfully
[INFO] Server started successfully
[INFO] Access your backend on http://localhost:3001
```

## Migration File Details

### Migration: `20260427120000-grant-migration.js`

**Purpose:** Creates default grants for existing agreements in the database

**What It Does (UP):**

- Finds agreements without grants
- Creates a default grant for each agreement
- Updates versions to reference the new grant
- Updates agreements to include the grant ID

**Rollback (DOWN):**

- Removes all grants
- Clears grant references from versions and agreements
- Reverts the database to pre-migration state

## Configuration

The MongoDB connection is configured via:

1. Environment variable: `MONGO_URI`
2. Config file: `src/config/index.js` (line 263)
3. Default fallback: `mongodb://127.0.0.1:27017/`
4. Database name: `farming-grants-agreements-api` (configurable via `MONGO_DATABASE`)

## Troubleshooting

### Migration Not Running

1. **Check MongoDB is running:**

   ```bash
   mongodb://localhost:27017/
   ```

2. **Check MONGO_URI env var:**

   ```bash
   echo $MONGO_URI
   ```

3. **Check migration file exists:**
   ```bash
   ls -la migrations/20260427120000-grant-migration.js
   ```

### Migration Fails

- Check logs in console for detailed error messages
- Verify MongoDB collections exist: `agreements`, `versions`, `grants`
- Check MongoDB permissions/authentication

### Manual Migration Testing

```bash
# View what migrations would run
MONGO_URL=mongodb://localhost:27017/ npm run migrate:status

# Run migrations manually
MONGO_URL=mongodb://localhost:27017/ npm run migrate:up

# Rollback migrations manually
MONGO_URL=mongodb://localhost:27017/ npm run migrate:down
```

## Important Notes

- Migrations run **automatically on server startup** via `src/api/agreement/index.js` (inside the `agreement` plugin)
- Migration files must export both `up` and `down` functions
- Migrations are tracked in MongoDB `changelog` collection
- New migrations should follow the naming pattern: `{TIMESTAMP}-{description}.js`
- All migration files must be in the `migrations/` directory
- The ESM module format is configured in `migrate-mongo-config.js`

## Testing migrations in your workflow

1. **Before deployments:** Run `npm run migrate:status` to verify migrations are ready
2. **During development:** Migrations run automatically on each server restart
3. **For data fixes:** Create new migration files following the naming convention
4. **For reversions:** Use `npm run migrate:down` to rollback if needed
