#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Checking existing aliases..."
echo "========================================"

# Check current state
bashrc_has_aliases=false
zshrc_has_aliases=false

if [ -f "$HOME/.bashrc" ]; then
  if grep -q "alias defra-up=" "$HOME/.bashrc" 2>/dev/null; then
    bashrc_has_aliases=true
    echo -e "${YELLOW}⚠ Aliases already exist in ~/.bashrc${NC}"
  else
    echo -e "${BLUE}✓ ~/.bashrc found (no aliases)${NC}"
  fi
fi

if [ -f "$HOME/.zshrc" ]; then
  if grep -q "alias defra-up=" "$HOME/.zshrc" 2>/dev/null; then
    zshrc_has_aliases=true
    echo -e "${YELLOW}⚠ Aliases already exist in ~/.zshrc${NC}"
  else
    echo -e "${BLUE}✓ ~/.zshrc found (no aliases)${NC}"
  fi
fi

# Exit if all existing config files already have aliases
if { [ ! -f "$HOME/.bashrc" ] || [ "$bashrc_has_aliases" = true ]; } && \
   { [ ! -f "$HOME/.zshrc" ] || [ "$zshrc_has_aliases" = true ]; } then
  echo ""
  echo "Aliases already configured in all detected shell config files."
  exit 0
fi

echo ""
echo "Adding aliases to config files..."
echo ""

# Alias definitions
ALIAS_BLOCK="
# Defra Farming Grants Scripts
alias defra-up='$SCRIPT_DIR/defra-up.sh'
alias defra-pull='$SCRIPT_DIR/defra-pull.sh'
alias defra-down='$SCRIPT_DIR/defra-down.sh'
"

# Add to .bashrc if it exists and doesn't have aliases
if [ -f "$HOME/.bashrc" ] && [ "$bashrc_has_aliases" = false ]; then
  echo "$ALIAS_BLOCK" >> "$HOME/.bashrc"
  echo -e "${GREEN}✓ Aliases added to ~/.bashrc${NC}"
fi

# Add to .zshrc if it exists and doesn't have aliases
if [ -f "$HOME/.zshrc" ] && [ "$zshrc_has_aliases" = false ]; then
  echo "$ALIAS_BLOCK" >> "$HOME/.zshrc"
  echo -e "${GREEN}✓ Aliases added to ~/.zshrc${NC}"
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo -e "Run ${BLUE}source ~/.bashrc${NC} or ${BLUE}source ~/.zshrc${NC} to use the aliases now."
echo ""
echo "Available aliases:"
echo -e "  ${BLUE}defra-up${NC}       - Start all Defra services"
echo -e "  ${BLUE}defra-pull${NC}     - Update all repositories"
echo -e "  ${BLUE}defra-down${NC}     - Stop all Defra services (use 'defra-down -rm' to remove volumes)"
