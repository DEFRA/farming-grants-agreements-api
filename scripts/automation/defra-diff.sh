#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Array of repositories to check
repos=(
  "farming-grants-agreements-ui"
  "farming-grants-agreements-api"
  "farming-grants-agreements-pdf"
)

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Display/Splash available repos
function availableRepos() {
  echo ""
  echo "Available repositories:"
  for repo in "${repos[@]}"; do
    echo "  - $repo"
  done
  echo ""
}

# Check if three parameters are provided
if [ "$#" -ne 3 ]; then
  echo -e "${RED}Error: Repository name and two tags are required${NC}"
  echo ""
  echo "Usage: defra-diff <repository-name> <from-tag> <to-tag>"
  availableRepos
  echo "Example:"
  echo "  defra-diff farming-grants-agreements-ui 1.22.0 1.30.0"
  echo ""
  exit 1
fi

REPO_NAME="$1"
FROM_TAG="$2"
TO_TAG="$3"

# Check if the repository is in our list
if [[ ! " ${repos[*]} " =~ ${REPO_NAME} ]]; then
  echo -e "${RED}Error: Invalid repository name '${REPO_NAME}'${NC}"
  availableRepos
  exit 1
fi

echo ""
echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Repository: ${CYAN}${REPO_NAME}${NC}"
echo -e "${BOLD}${BLUE}Git changes between: ${CYAN}${FROM_TAG}..${TO_TAG}${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"
echo ""

# Process the specified repository
repo="$REPO_NAME"

# Navigate to repository
cd "$BASE_DIR/$repo" || {
  echo -e "${RED}❌ Repository directory '$repo' not found at: $BASE_DIR/$repo${NC}"
  echo ""
  exit 1
}

# Check if tags exist
if ! git rev-parse "$FROM_TAG" >/dev/null 2>&1; then
  echo -e "${RED}❌ Tag '$FROM_TAG' not found in $repo${NC}"
  echo ""
  exit 1
fi

if ! git rev-parse "$TO_TAG" >/dev/null 2>&1; then
  echo -e "${RED}❌ Tag '$TO_TAG' not found in $repo${NC}"
  echo ""
  exit 1
fi

# Get commit count
COMMIT_COUNT=$(git rev-list --count "$FROM_TAG..$TO_TAG" 2>/dev/null)

if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}No commits between $FROM_TAG and $TO_TAG${NC}"
  echo ""
  exit 1
fi

# Show git log with custom format
# Format: hash - subject (relative time) <author>
git --no-pager log "$FROM_TAG..$TO_TAG" \
  --decorate=short \
    --decorate-refs-exclude=HEAD \
    --decorate-refs-exclude='refs/remotes/origin/*' \
    --pretty=format:"%C(yellow)%h%Creset %C(auto)%d%Creset - %s %C(green)(%cr)%Creset %C(blue)<%an>%Creset" \
    --abbrev-commit

echo ""
echo ""
