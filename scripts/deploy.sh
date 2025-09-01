#!/bin/bash

# Jarvis n8n Deployment Script
set -e

echo "🚀 Building Jarvis n8n Infrastructure..."

# Load environment variables
if [ -f "infra/.env" ]; then
    export $(cat infra/.env | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found in infra/ directory"
    exit 1
fi

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=${AWS_REGION:-us-west-2}
echo "🔧 CDK Account: $CDK_DEFAULT_ACCOUNT"
echo "🔧 CDK Region: $CDK_DEFAULT_REGION"

# Navigate to CDK directory
cd infra/cdk

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Deploy infrastructure
echo "🚀 Deploying to AWS..."
cd ..
npm run deploy

echo "✅ Deployment complete!"
echo "🌐 Your n8n instance will be available at: https://${N8N_DOMAIN}"
echo "👤 Username: ${N8N_USER}"
echo "🔑 Password: ${N8N_PASS}"