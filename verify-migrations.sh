#!/bin/bash

# Migration verification script
# This script helps verify that the migration system is properly set up

echo "=========================================="
echo "Database Migration System Verification"
echo "=========================================="
echo ""

# Check 1: migrate-mongo is installed
echo "✓ Checking if migrate-mongo is installed..."
if npm list migrate-mongo > /dev/null 2>&1; then
    echo "  ✓ migrate-mongo is installed"
else
    echo "  ✗ migrate-mongo is NOT installed"
    echo "  Run: npm install"
    exit 1
fi
echo ""

# Check 2: Migration file exists
echo "✓ Checking if migration file exists..."
if [ -f "migrations/20260427120000-grant-migration.js" ]; then
    echo "  ✓ Migration file found: migrations/20260427120000-grant-migration.js"
else
    echo "  ✗ Migration file NOT found"
    exit 1
fi
echo ""

# Check 3: Migration config exists
echo "✓ Checking if migrate-mongo config exists..."
if [ -f "migrate-mongo-config.js" ]; then
    echo "  ✓ Config file found: migrate-mongo-config.js"
else
    echo "  ✗ Config file NOT found"
    exit 1
fi
echo ""

# Check 4: Migration logic in agreement plugin exists
echo "✓ Checking if migration logic in agreement plugin exists..."
if grep -q "migrate-mongo" src/api/agreement/index.js; then
    echo "  ✓ Migration logic found in src/api/agreement/index.js"
else
    echo "  ✗ Migration logic NOT found in agreement plugin"
    exit 1
fi
echo ""

# Check 5: agreement plugin includes migrations
echo "✓ Checking if agreement plugin runs migrations..."
if grep -q "up(db, mongoClient)" src/api/agreement/index.js; then
    echo "  ✓ agreement plugin includes migration runner"
else
    echo "  ✗ agreement plugin does NOT include migration runner"
    exit 1
fi
echo ""

# Check 6: npm scripts exist
echo "✓ Checking if npm migration scripts exist..."
if grep -q '"migrate:up"' package.json && grep -q '"migrate:down"' package.json && grep -q '"migrate:status"' package.json; then
    echo "  ✓ All migration npm scripts found (migrate:up, migrate:down, migrate:status)"
else
    echo "  ✗ Some migration npm scripts are missing"
    exit 1
fi
echo ""

# Check 7: Migration has both up and down
echo "✓ Checking if migration has up and down functions..."
if grep -q "export const up" migrations/20260427120000-grant-migration.js && grep -q "export const down" migrations/20260427120000-grant-migration.js; then
    echo "  ✓ Migration has both 'up' and 'down' functions"
else
    echo "  ✗ Migration is missing 'up' or 'down' function"
    exit 1
fi
echo ""

echo "=========================================="
echo "✓ All checks passed!"
echo "=========================================="
echo ""
echo "Migration system is ready to use:"
echo ""
echo "To verify manually with MongoDB running:"
echo "  MONGO_URL=mongodb://localhost:27017/ npm run migrate:status"
echo ""
echo "To run migrations manually:"
echo "  MONGO_URL=mongodb://localhost:27017/ npm run migrate:up"
echo ""
echo "To run the application (migrations run automatically):"
echo "  npm run dev"
echo ""
echo "For detailed documentation, see: MIGRATIONS.md"
echo ""

