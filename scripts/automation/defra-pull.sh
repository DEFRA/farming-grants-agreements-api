#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Array of repositories to update
repos=(
  "cdp-defra-id-stub"
  "fg-gas-backend"
  "grants-ui"
  "land-grants-api"
  "farming-grants-agreements-pdf"
  "farming-grants-agreements-api"
  "farming-grants-agreements-ui"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color


# Get branch name from parameter, or use empty string if not provided
target_branch="${1:-}"
fallback_branch="main"

echo "Starting repository update process..."
if [ -n "$target_branch" ]; then
  echo -e "Target branch: ${BLUE}$target_branch${NC} (will fallback to ${BLUE}$fallback_branch${NC} if not found)"
else
  echo -e "No branch specified, pulling: ${BLUE}$fallback_branch${NC}"
fi
echo ""

# Iterate through each repository
for repo in "${repos[@]}"; do
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}Processing: $repo${NC}"
  echo -e "${BLUE}========================================${NC}"

  # Check if repository directory exists
  cd "$BASE_DIR/$repo" || {
    echo -e "${RED}❌ Repository directory '$repo' not found. Skipping...${NC}"
    echo ""
    continue
  }

  echo "Fetching latest branches..."
  git fetch --all

  # Set the fallback_branch as the default choice
  branch_to_use="$fallback_branch"

  # Check if target branch was provided and exists
  if [ -n "$target_branch" ]; then
    if git show-ref --verify "refs/heads/$target_branch"; then
      branch_to_use="$target_branch"
      echo -e "${GREEN}✓ Branch '$target_branch' found. Checking out and pulling...${NC}"
    else
      echo -e "${YELLOW}⚠ Branch '$target_branch' not found. Using fallback branch '$fallback_branch'...${NC}"
    fi
  else
    echo "Using default branch '$fallback_branch'..."
  fi

  # Checkout and pull the selected branch
  git checkout "$branch_to_use" && git pull origin "$branch_to_use"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully updated $repo on branch '$branch_to_use'${NC}"
  else
    echo -e "${YELLOW}❌ Failed to update $repo${NC}"
  fi

  echo ""
done

echo -e "${BLUE}Repository update process complete!${NC}"
