#!/bin/bash
set -e

echo 'Configuring MCP for Kiro CLI...'

# Create Kiro settings directory and MCP configuration
mkdir -p /home/node/.kiro/settings
cat > /home/node/.kiro/settings/mcp.json << EOF
{
  "mcpServers": {
    "github": {
      "url": "https://api.github.com/mcp"
    },
    "aws-mcp": {
      "command": "uvx",
      "args": [
        "mcp-proxy-for-aws@latest",
        "https://aws-mcp.us-east-1.api.aws/mcp",
        "--metadata",
        "AWS_REGION=ap-southeast-2"
      ],
      "disabled": false,
      "autoApprove": []
    },
    "aws-knowledge-mcp-server": {
      "url": "https://knowledge-mcp.global.api.aws"
    },
    "microsoft-learn": {
      "url": "https://learn.microsoft.com/api/mcp"
    },
    "microsoft-enterprise": {
      "url": "https://mcp.svc.cloud.microsoft/enterprise"
    },
    "awslabs.cdk-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.cdk-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.aws-documentation-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.aws-documentation-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.aws-api-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.aws-api-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.iam-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.iam-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.cloudwatch-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.cloudwatch-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.cloudtrail-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.cloudtrail-mcp-server@latest"
      ],
      "env": {
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    },
    "awslabs.aws-pricing-mcp-server": {
      "command": "uvx",
      "args": [
        "awslabs.aws-pricing-mcp-server@latest"
      ],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR",
        "AWS_REGION": "ap-southeast-2"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
EOF

echo 'MCP configuration completed'
