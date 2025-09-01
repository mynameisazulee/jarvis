#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { N8nOnEc2Stack } from '../lib/stack-n8n-ec2';

const app = new cdk.App();

new N8nOnEc2Stack(app, 'Jarvis-N8n-EC2', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || 'us-west-2' 
  },
  domainName: process.env.N8N_DOMAIN,
  hostedZoneName: process.env.HOSTED_ZONE,
  letsEncryptEmail: process.env.ACME_EMAIL,
  basicAuthUser: process.env.N8N_USER || 'azu',
  basicAuthPass: process.env.N8N_PASS || 'change-me-strong'
});