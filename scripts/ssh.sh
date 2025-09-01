#!/bin/bash

# Get instance public IP from EC2 using stack tag
PUBLIC_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=JarvisStack" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" = "None" ]; then
  echo "❌ Could not find instance public IP. Make sure the stack is deployed."
  exit 1
fi

echo "🔗 Connecting to instance: $PUBLIC_IP"
ssh -i "$(dirname "$0")/../keypair.pem" ec2-user@$PUBLIC_IP