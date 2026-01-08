# Defra Automation Scripts

This directory contains automation scripts to manage the Defra Farming Grants development environment.

## Available Scripts

### `defra-up.sh`

Starts all Defra services in the correct order.

**Usage:**

```bash
./scripts/automation/defra-up.sh
# or using the alias:
defra-up
```

**What it does:**

- Starts services for: `land-grants-api`, `farming-grants-agreements-pdf`, `farming-grants-agreements-ui`, `farming-grants-agreements-api`
- Runs setup steps for `land-grants-api` (migrations, data seeding)
- Waits 10 seconds before starting `farming-grants-agreements-api` to avoid race conditions
- Shows status of all containers when complete

---

### `defra-pull.sh`

Updates all repositories to the latest code.

**Usage:**

```bash
./scripts/automation/defra-pull.sh [branch-name]
# or using the alias:
defra-pull [branch-name]
```

**Parameters:**

- `branch-name` (optional): Target branch to checkout. Falls back to `main` if not found.

**What it does:**

- Fetches latest changes from all repositories
- Checks out the specified branch (or `main` by default)
- Pulls latest changes for each repository

---

### `defra-down.sh`

Stops all Defra services.

**Usage:**

```bash
./scripts/automation/defra-down.sh [-rm|--remove]
# or using the alias:
defra-down [-rm|--remove]
```

**Parameters:**

- `-rm` or `--remove`: Removes containers AND volumes (deletes all data)

**What it does:**

- Stops and removes all Defra containers
- Optionally removes volumes when `-rm` flag is used
- Shows remaining containers when complete

**Examples:**

```bash
# Stop containers only (preserves data)
defra-down

# Stop containers and remove all data
defra-down -rm
```

---

### `setup-aliases.sh`

Sets up shell aliases for convenient access to the automation scripts.

**Usage:**

```bash
./scripts/automation/setup-aliases.sh
```

**What it does:**

- Adds aliases to `~/.bashrc` and/or `~/.zshrc`
- Creates convenient shortcuts: `defra-up`, `defra-pull`, `defra-down`

**After running, reload your shell:**

```bash
source ~/.bashrc  # for bash
source ~/.zshrc   # for zsh
```

---

## Quick Start

1. Run the setup script to create aliases:

   ```bash
   ./scripts/automation/setup-aliases.sh
   source ~/.bashrc  # or ~/.zshrc
   ```

2. Update all repositories:

   ```bash
   defra-pull
   ```

3. Start all services:

   ```bash
   defra-up
   ```

4. When done, stop services:
   ```bash
   defra-down
   # or to remove data:
   defra-down -rm
   ```

---

## Repositories Managed

- `land-grants-api` - Land grants backend API
- `farming-grants-agreements-pdf` - PDF generation service
- `farming-grants-agreements-ui` - Frontend application
- `farming-grants-agreements-api` - Agreements backend API

All repositories should be located in the same parent directory for the scripts to work correctly.
