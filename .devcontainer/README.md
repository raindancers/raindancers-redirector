# Development Container

VS Code devcontainer setup with Kiro CLI for AI-assisted development.

## What You Get

- **VS Code** as the editor with devcontainer support
- **Kiro CLI** as the AI coding agent (terminal-based)
- **AWS CLI** with interactive SSO configuration on first run
- **Azure CLI** for Microsoft Graph / Entra ID operations
- **12 MCP servers** pre-configured for AWS, GitHub, and Microsoft services
- **Steering files** for consistent AI behaviour across the team
- **Auth persistence** — Kiro and AWS credentials survive container rebuilds

## Quick Start

1. Clone the repo in WSL2 (recommended) or locally
2. Open in VS Code → "Reopen in Container"
3. On first run, the setup will prompt you for AWS SSO details
4. Authenticate Kiro CLI:
   ```bash
   kiro-cli login --use-device-flow
   ```
5. Start coding:
   ```bash
   kiro-cli chat --v3
   ```

## Scripts

| Script | Runs | Purpose |
|--------|------|---------|
| `setup.sh` | Always | Orchestrates all other scripts in order |
| `git-setup.sh` | Always | Configures `git user.name` and `user.email` from GitHub API |
| `aws-setup.sh` | First run only | Interactive AWS SSO configuration. Skips if `~/.aws/config` exists |
| `uvx-setup.sh` | Always | Installs `uv`/`uvx` for running Python-based MCP servers |
| `kiro-setup.sh` | Always | Installs Kiro CLI to `~/.local/bin` |
| `mcp-setup.sh` | Always | Writes MCP server configuration to `~/.kiro/settings/mcp.json` |

## Volume Mounts

Two named Docker volumes persist data across container rebuilds:

| Volume | Mount point | Contents |
|--------|-------------|----------|
| `kiro-config` | `/home/node/.kiro` | Kiro settings, MCP config |
| `kiro-cli-data` | `/home/node/.local/share/kiro-cli` | Auth tokens, session data |

## Execution Order

```
postCreateCommand
  → setup.sh
      → git-setup.sh
      → aws-setup.sh      (interactive or placeholder)
      → uvx-setup.sh
      → kiro-setup.sh
      → mcp-setup.sh
```

## MCP Servers

### Remote (no local process, instant)

| Server | Purpose |
|--------|---------|
| GitHub | PRs, issues, Actions, code search |
| AWS Knowledge | AWS docs and knowledge base |
| Microsoft Learn | Entra ID / Azure / M365 documentation |
| Microsoft Enterprise | Read-only Microsoft Graph queries |

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

## WSL2 Setup (Windows)

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
   cd raindancers-redirector
   ```
3. **Open in VS Code**: `code .`
4. **Reopen in Container**: Click "Reopen in Container" in the notification
5. **First run**: Follow the AWS SSO prompts
6. **Authenticate Kiro CLI**: `kiro-cli login --use-device-flow`

### Why WSL2?

Files are stored natively in WSL2's ext4 filesystem — massively faster builds and installs compared to working from the Windows filesystem (`/mnt/c/`).

## Reconfiguring

| What | How |
|------|-----|
| AWS SSO | `rm ~/.aws/config && .devcontainer/scripts/aws-setup.sh` |
| MCP servers | Edit `scripts/mcp-setup.sh` and rebuild |
| Kiro auth | `kiro-cli login --use-device-flow` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Reopen in Container" not showing | Ensure Dev Containers extension is installed |
| Very slow file operations | Check you cloned into `~/` not `/mnt/c/` |
| Docker not running | Open Docker Desktop, ensure WSL2 backend is enabled |
| Container build fails | Check `~/setup.log` inside the container |

## Container User

Runs as `node` (not root). Home directory is `/home/node`.
