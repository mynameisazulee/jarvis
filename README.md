# Jarvis - AWS Infrastructure

CDK project for deploying AWS infrastructure with EC2 instances.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- SSH key pair `n8n-keypair.pem` in project root for EC2 access

## Quick Commands

### Deploy Infrastructure
```bash
./scripts/deploy.sh
```

### SSH into EC2 Instance
```bash
./scripts/ssh.sh
```

## Manual Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run deploy`  - Deploy stack to AWS (auto-approval)
* `npm run destroy` - Destroy the stack
* `npm run cdk`     - Run CDK commands

## SSH Access

Place your `n8n-keypair.pem` file in the project root directory and ensure proper permissions:
```bash
chmod 400 n8n-keypair.pem
```

Then use `./scripts/ssh.sh` to connect to your EC2 instance.

## Infrastructure

The stack deploys:
- VPC with public/private subnets
- EC2 instance (t3.micro) with Amazon Linux 2023
- Security group with SSH and HTTP access
- IAM role for SSM access