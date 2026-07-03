#!/bin/bash
set -e

AWS_CONFIG="/home/node/.aws/config"

# Skip if already configured (not first run)
if [ -f "$AWS_CONFIG" ]; then
    echo 'AWS already configured, skipping. Delete ~/.aws/config to reconfigure.'
    exit 0
fi

# Detect workspace context for session naming
WORKSPACE_DIR=$(pwd)
GH_USER=${GITHUB_USER:-$(whoami)}
REPO_NAME=${GITHUB_REPOSITORY_NAME:-$(basename "$WORKSPACE_DIR")}
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
SESSION_NAME="$GH_USER-$REPO_NAME-$BRANCH_NAME"

# If not interactive (CI, prebuilds, headless), write a placeholder
if [ ! -t 0 ]; then
    echo 'Non-interactive environment detected. Writing placeholder AWS config.'
    mkdir -p /home/node/.aws
    cat > "$AWS_CONFIG" << EOF
# ┌──────────────────────────────────────────────────────────────┐
# │  AWS SSO not yet configured.                                 │
# │  Run: .devcontainer/scripts/aws-setup.sh                     │
# │  Or delete this file and rebuild the container.              │
# └──────────────────────────────────────────────────────────────┘

[sso-session $SESSION_NAME]
sso_start_url = https://UNCONFIGURED.awsapps.com/start#
sso_region = ap-southeast-2
sso_registration_scopes = sso:account:access

[profile default]
sso_session = $SESSION_NAME
sso_account_id = 000000000000
sso_role_name = UNCONFIGURED
region = ap-southeast-2
EOF
    echo 'Run ".devcontainer/scripts/aws-setup.sh" in a terminal to configure interactively.'
    exit 0
fi

# ─── Interactive setup ────────────────────────────────────────────────────────

echo ''
echo '╔══════════════════════════════════════════════════════════════╗'
echo '║                    AWS SSO Configuration                    ║'
echo '╠══════════════════════════════════════════════════════════════╣'
echo '║  First-time setup — configure your AWS Identity Center      ║'
echo '║  (SSO) access. You can reconfigure later by deleting        ║'
echo '║  ~/.aws/config and running this script again.               ║'
echo '╚══════════════════════════════════════════════════════════════╝'
echo ''

# Prompt for SSO details
read -p "SSO Start URL (e.g. https://myorg.awsapps.com/start#): " SSO_START_URL
read -p "SSO Region [ap-southeast-2]: " SSO_REGION
SSO_REGION=${SSO_REGION:-ap-southeast-2}
read -p "Default region [ap-southeast-2]: " DEFAULT_REGION
DEFAULT_REGION=${DEFAULT_REGION:-ap-southeast-2}

# Build base config
mkdir -p /home/node/.aws
cat > "$AWS_CONFIG" << EOF
[sso-session $SESSION_NAME]
sso_start_url = $SSO_START_URL
sso_region = $SSO_REGION
sso_registration_scopes = sso:account:access
EOF

# Add profiles
echo ''
echo 'Now add AWS profiles. Enter a blank profile name when done.'
echo ''

while true; do
    read -p "Profile name (blank to finish): " PROFILE_NAME
    [ -z "$PROFILE_NAME" ] && break

    read -p "  Account ID: " ACCOUNT_ID
    read -p "  Role name: " ROLE_NAME
    read -p "  Region [$DEFAULT_REGION]: " PROFILE_REGION
    PROFILE_REGION=${PROFILE_REGION:-$DEFAULT_REGION}

    cat >> "$AWS_CONFIG" << EOF

[profile $PROFILE_NAME]
sso_session = $SESSION_NAME
sso_account_id = $ACCOUNT_ID
sso_role_name = $ROLE_NAME
region = $PROFILE_REGION
EOF

    echo "  ✓ Profile '$PROFILE_NAME' added"
    echo ''
done

echo ''
echo 'AWS configuration completed.'
echo "SSO session: $SESSION_NAME"
echo "Config file: $AWS_CONFIG"
echo ''
echo 'To authenticate, run:'
echo "  aws sso login --profile <profile-name>"
echo ''
