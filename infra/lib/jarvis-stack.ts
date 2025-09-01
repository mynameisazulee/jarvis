import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class JarvisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'JarvisVpc', {
      maxAzs: 2
    });

    const sg = new ec2.SecurityGroup(this, 'JarvisSg', {
      vpc,
      allowAllOutbound: true
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5678), 'n8n');

    const role = new iam.Role(this, 'JarvisRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf update -y',
      'dnf install -y docker nginx certbot python3-certbot-nginx',
      'systemctl enable docker nginx',
      'systemctl start docker nginx',
      'usermod -a -G docker ec2-user',
      'docker volume create n8n_data',
      'docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n',
      'cat > /etc/nginx/conf.d/n8n.conf << "EOF"',
      'server {',
      '    listen 80;',
      '    server_name _;',
      '    location / {',
      '        proxy_pass http://127.0.0.1:5678;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '}',
      'EOF',
      'systemctl reload nginx'
    );

    new ec2.Instance(this, 'JarvisInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: sg,
      role,
      keyName: 'keypair',
      userData
    });
  }
}
