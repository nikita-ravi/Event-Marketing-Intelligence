#!/bin/bash

# Test script to run CLI with real query
# This sends the test query and captures the full output

cd /Users/nikitaravi/Desktop/event\ marketing/agent-backend

# Send the query via echo and pipe to the CLI
echo "Find events for my restaurant in Washington DC in the next two weeks" | npm run test-cli
