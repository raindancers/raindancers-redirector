# .devcontainer

Technical reference for the devcontainer setup scripts. See the [root README](../README.md) for the full overview.

## Scripts

| Script | Runs | Purpose |
|--------|------|---------|
| `setup.sh` | Always | Orchestrates all other scripts in order |
| `git-setup.sh` | Always | Configures `git user.name` and `user.email` from GitHub API (uses `jq`) |
| `aws-setup.sh` | First run only | Interactive AWS SSO configuration. Skips if `~/.aws/config` exists. Writes placeholder in headless environments. |
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
      → npm-setup.sh
      → aws-setup.sh      (interactive or placeholder)
      → uvx-setup.sh
      → kiro-setup.sh
      → mcp-setup.sh
```

## Adding a New Setup Step

1. Create `scripts/my-setup.sh`
2. Add a call block in `setup.sh`:
   ```bash
   if "$SCRIPT_DIR/scripts/my-setup.sh"; then
       echo 'My setup done' >> /home/node/setup.log
   else
       echo 'My setup failed' >> /home/node/setup.log
   fi
   ```
3. Rebuild the container

## Reconfiguring

| What | How |
|------|-----|
| AWS SSO | `rm ~/.aws/config && .devcontainer/scripts/aws-setup.sh` |
| MCP servers | Edit `scripts/mcp-setup.sh` and rebuild |
| Kiro auth | `kiro-cli login --use-device-flow` |
