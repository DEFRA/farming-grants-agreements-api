#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Array of repositories to stop
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

# Parse command line arguments
REMOVE_VOLUMES=false
if [[ "$1" == "-rm" ]] || [[ "$1" == "--remove" ]]; then
  REMOVE_VOLUMES=true
fi

echo "Stopping Docker Compose services..."
if [ "$REMOVE_VOLUMES" = true ]; then
  echo -e "${YELLOW}⚠ Will remove containers and volumes${NC}"
else
  echo -e "${BLUE}ℹ Will stop containers only (use -rm to remove containers and volumes)${NC}"
fi
echo ""

# Stop services in each repository
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

  # Run docker compose down with or without volumes flag
  if [ "$REMOVE_VOLUMES" = true ]; then
    echo "Running: docker compose down -v"
    docker compose down -v
  else
    echo "Running: docker compose stop"
    docker compose stop
  fi

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully stopped containers for $repo${NC}"
  else
    echo -e "${RED}❌ Failed to stop containers for $repo${NC}"
  fi

  echo ""
done

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Shutdown complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Remaining Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}"
