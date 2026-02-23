#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Array of repositories to start
repos=(
  "land-grants-api"
  "farming-grants-agreements-pdf"
  "farming-grants-agreements-ui"
  "farming-grants-agreements-api"
  "grants-payment-service"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Starting Docker Compose services..."
echo ""

# Start services in each repository
for repo in "${repos[@]}"; do
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}Processing: $repo${NC}"
  echo -e "${BLUE}========================================${NC}"

  # Navigate to repository
  cd "$BASE_DIR/$repo" || {
    echo -e "${RED}❌ Repository directory '$repo' not found. Skipping...${NC}"
    echo ""
    continue
  }

  if [ "$repo" = "land-grants-api" ]; then
    # Special handling for land-grants-api - run setup first
    echo "Running: npm run dev:setup"
    npm run dev:setup
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Failed to run setup for $repo${NC}"
      echo ""
      continue
    fi
    echo -e "${GREEN}✓ Setup completed for $repo${NC}"
  elif [ "$repo" = "farming-grants-agreements-api" ]; then
    # Special requirement in order to avoid a race to bake in the test data
    echo "Waiting 10 seconds before building and seeding default test data for $repo..."
    sleep 10
  fi

  # Run docker compose up
  echo "Running: docker compose up -d --build"
  docker compose up -d --build

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully started containers for $repo${NC}"
  else
    echo -e "${RED}❌ Failed to start containers for $repo${NC}"
  fi

  echo ""
done

echo -e "${BLUE}Docker containers status'${NC}"
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
