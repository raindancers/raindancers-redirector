# CDK Development Container Template

A template repository for CDK-based projects using VS Code devcontainers with Kiro CLI for AI-assisted development.

## What You Get

- **VS Code** as the editor with devcontainer support
- **Kiro CLI** as the AI coding agent (terminal-based)
- **AWS CLI** with interactive SSO configuration on first run
- **Azure CLI** for Microsoft Graph / Entra ID operations
- **12 MCP servers** pre-configured for AWS, GitHub, and Microsoft services
- **Steering files** for consistent AI behaviour across the team
- **Auth persistence** — Kiro and AWS credentials survive container rebuilds

## Quick Start

1. Create a new repo from this template
2. Clone it in WSL2 (recommended) or locally
3. Open in VS Code → "Reopen in Container"
4. On first run, the setup will prompt you for AWS SSO details
5. Authenticate Kiro CLI:
   ```bash
   kiro-cli login --use-device-flow
   ```
6. Start coding:
   ```bash
   kiro-cli
   ```

## Project Structure

```
.devcontainer/
├── devcontainer.json          # Container config, extensions, volume mounts
├── setup.sh                   # Setup orchestrator
└── scripts/
    ├── git-setup.sh           # Auto-configures git identity from GitHub
    ├── aws-setup.sh           # Interactive AWS SSO config (first-run only)
    ├── uvx-setup.sh           # Installs uv/uvx for Python MCP servers
    ├── kiro-setup.sh          # Installs Kiro CLI
    └── mcp-setup.sh           # Configures all MCP servers
.kiro/
└── steering/                  # Project guidelines for Kiro
    ├── security-architecture-principles.md
    ├── DonotchangeCodeWithoutAsking.md
    ├── documentation.md
    ├── bicep-validation.md
    ├── propertyshorthand.md
    └── Imports.md
```

## MCP Servers

The following MCP servers are pre-configured in `~/.kiro/settings/mcp.json`:

### Remote (no local process, instant)

| Server | Purpose |
|--------|---------|
| GitHub | PRs, issues, Actions, code search (OAuth on first use) |
| AWS Knowledge | AWS docs and knowledge base |
| Microsoft Learn | Entra ID / Azure / M365 documentation |
| Microsoft Enterprise | Read-only Microsoft Graph queries (OAuth on first use) |

### Local (uvx, spin up on demand)

| Server | Purpose |
|--------|---------|
| AWS MCP (managed, preview) | Combined API + docs + Agent SOPs with CloudTrail audit |
| CDK | Construct patterns, best practices, CDK Nag compliance |
| AWS Documentation | Full AWS docs search and recommendations |
| AWS API | Execute AWS CLI commands via the agent |
| IAM | Manage users, roles, policies with security best practices |
| CloudWatch | Query logs, metrics, and alarms |
| CloudTrail | API activity audit trail |
| AWS Pricing | Cost estimation and pricing lookups |

## AWS Configuration

The AWS setup (`scripts/aws-setup.sh`) is interactive on first run:

- Prompts for your SSO start URL, region, and profiles
- Generates `~/.aws/config` with a unique session name per user/repo/branch
- Skips automatically on subsequent container rebuilds
- In headless environments (CI, prebuilds), writes a placeholder config

To reconfigure:
```bash
rm ~/.aws/config
.devcontainer/scripts/aws-setup.sh
```

## Kiro CLI

### Authentication

First time only (persisted across rebuilds via named Docker volumes):
```bash
kiro-cli login --use-device-flow
```

### Persistence

The devcontainer mounts two named volumes:
- `kiro-config` → `~/.kiro` (settings, steering, MCP config)
- `kiro-cli-data` → `~/.local/share/kiro-cli` (auth tokens, session data)

### Steering Files

Project-level steering files in `.kiro/steering/` are automatically picked up by Kiro CLI. These define non-negotiable conventions (security architecture, documentation standards, etc.) that the AI follows in every session.

## VS Code Extensions

- TypeScript language support
- AWS Toolkit
- GitHub Actions
- JSON language support
- Python + pylint

## Base Image Features

- TypeScript/Node.js 22
- AWS CLI
- Azure CLI
- Docker-in-Docker
- Python + uv/uvx
- GitHub CLI

## WSL2 Setup (Windows)

**This is the recommended way to use this template on Windows.** Working directly on the Windows filesystem is significantly slower (5-10x) for Node.js operations like `npm install`.

### Prerequisites

- Windows 10/11 with WSL2 enabled
- Docker Desktop for Windows with the **WSL2 backend** enabled
- VS Code with the **Dev Containers** extension installed
- A WSL2 distro (e.g., Ubuntu) from the Microsoft Store

### Step-by-Step

1. **Open a WSL2 terminal** (e.g., Ubuntu from Windows Terminal)

2. **Clone the repo in the WSL2 filesystem** (not `/mnt/c/`):
   ```bash
   cd ~
   git clone <repository-url>
   cd <project-name>
   ```

3. **Open in VS Code**:
   ```bash
   code .
   ```

4. **Reopen in Container**: When VS Code opens, click "Reopen in Container" in the notification
   - Or use the Command Palette: `Dev Containers: Reopen in Container`

5. **First run**: The AWS setup will prompt you interactively for SSO details. Follow the prompts.

6. **Authenticate Kiro CLI**:
   ```bash
   kiro-cli login --use-device-flow
   ```

### Why WSL2?

Your development environment runs as: **Windows → WSL2 → Docker → Dev Container**

- Files are stored natively in WSL2's ext4 filesystem (not Windows NTFS via `/mnt/c/`)
- Docker runs directly in WSL2, not through Hyper-V
- The devcontainer gets native Linux I/O for `npm install`, `yarn`, `tsc`, etc.
- Result: massively faster builds and installs compared to working from the Windows filesystem

### Verify Performance

To confirm you're running with optimal performance inside the container:
```bash
# Should show ext4, not 9p or drvfs
df -T /workspaces/*

# Should show microsoft-standard-WSL2 kernel
uname -r
```

### Where It Appears in VS Code

The devcontainer shows under **Dev Containers** in the Remote Explorer panel, not under WSL Targets. This is correct — you're connected to the container, which Docker hosts inside WSL2.

### GitHub CLI in WSL2

If you need to authenticate with GitHub from your WSL2 distro (for private repos):

```bash
# Install gh (one-time, as root)
wsl -u root
apt update && apt install gh
exit

# Authenticate (as your regular user)
gh auth login
```

This installs `gh` in your WSL2 distro, not inside the devcontainer. The devcontainer inherits your WSL2 git credentials automatically.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| "Reopen in Container" not showing | Ensure Dev Containers extension is installed in VS Code |
| Very slow file operations | Check you cloned into `~/` not `/mnt/c/`. Run `pwd` — should start with `/home/` |
| Docker not running | Open Docker Desktop, ensure WSL2 backend is enabled in Settings → General |
| Container build fails | Check `~/setup.log` inside the container for which script failed |

## Container User

Runs as `node` (not root) for security and Node.js compatibility. Home directory is `/home/node`.

## Logs

Setup progress is logged to `~/setup.log` for troubleshooting.

## Steering Files to Add Per Project

The template includes general-purpose steering files. When starting a new project, consider adding these to `.kiro/steering/`:

| File | Purpose |
|------|---------|
| `aws-region.md` | Default region and any multi-region expectations |
| `testing.md` | Test framework (jest/vitest), snapshot vs fine-grained assertions, coverage expectations |
| `graph-operations.md` | Microsoft Graph conventions — delegated vs application permissions, preferred auth patterns |
| `commit-style.md` | Conventional commits, PR structure, commit granularity |
| `naming-conventions.md` | Resource naming patterns (e.g. `{project}-{env}-{resource}`), construct ID conventions |
| `error-handling.md` | Preferred patterns for Lambda/API error responses, error types |

These are intentionally left out of the template — they vary too much between projects to standardise.

## Customization

- **AWS profiles**: Delete `~/.aws/config` and re-run the setup script
- **MCP servers**: Edit `scripts/mcp-setup.sh` to add/remove servers
- **Steering**: Add/edit markdown files in `.kiro/steering/`
- **New setup steps**: Create a script in `scripts/`, call it from `setup.sh`
- **Extensions**: Edit the `customizations.vscode.extensions` array in `devcontainer.json`

## Known Issues

- **MCP OAuth servers** (GitHub, Microsoft Enterprise) require a browser flow on first use
- **AWS MCP** is in preview — behaviour may change
- **Git LFS** not installed. If needed: `sudo apt-get update && sudo apt-get install git-lfs`
