#!/bin/bash

# Ensure jq is available
if ! command -v jq &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq jq >/dev/null 2>&1
fi

GIT_TOKEN=$(echo "protocol=https
host=github.com" | git credential fill 2>/dev/null | grep "^password=" | cut -d= -f2)

if [ -n "$GIT_TOKEN" ]; then
    USER_DATA=$(curl -s -H "Authorization: token $GIT_TOKEN" https://api.github.com/user)

    GIT_USER_NAME=$(echo "$USER_DATA" | jq -r '.name // empty')
    GIT_USER_LOGIN=$(echo "$USER_DATA" | jq -r '.login // empty')
    GIT_USER_EMAIL=$(echo "$USER_DATA" | jq -r '.email // empty')

    # Fall back to login if name is not set
    [ -z "$GIT_USER_NAME" ] && GIT_USER_NAME="$GIT_USER_LOGIN"

    # Fall back to noreply email if email is not public
    [ -z "$GIT_USER_EMAIL" ] && GIT_USER_EMAIL="${GIT_USER_LOGIN}@users.noreply.github.com"

    git config --global user.name "$GIT_USER_NAME"
    git config --global user.email "$GIT_USER_EMAIL"
fi
