#!/bin/bash
set -e

echo 'Installing Kiro CLI...'

# Ensure directories exist with correct permissions
mkdir -p /home/node/.kiro /home/node/.local/share/kiro-cli

# Add Kiro CLI installation path to PATH for this session
export PATH="$HOME/.local/bin:$PATH"

# Install Kiro CLI
curl -fsSL https://cli.kiro.dev/install | bash

# Add to shell profile for persistence
if ! grep -q 'kiro-cli' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

echo 'Kiro CLI installation completed'
echo 'Run "kiro-cli login --use-device-flow" to authenticate'
