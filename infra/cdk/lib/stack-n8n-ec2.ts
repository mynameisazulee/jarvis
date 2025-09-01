import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';

export interface N8nStackProps extends cdk.StackProps {
  domainName?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
  letsEncryptEmail?: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
}

export class N8nOnEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: N8nStackProps = {}) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'N8nSg', {
      vpc, allowAllOutbound: true, description: 'n8n + Traefik'
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    const role = new iam.Role(this, 'N8nRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    const ami = ec2.MachineImage.latestAmazonLinux2023();

    const domain = props.domainName ?? 'changeme.example.com';
    const email  = props.letsEncryptEmail ?? 'admin@example.com';
    const basicUser = props.basicAuthUser ?? 'azu';
    const basicPass = props.basicAuthPass ?? 'set-a-strong-pass';

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable docker && systemctl start docker',
      'dnf install -y docker-compose-plugin',
      'mkdir -p /opt/n8n /opt/traefik/letsencrypt',
      'cat > /opt/n8n/docker-compose.yml << "EOF"',
      'services:',
      '  traefik:',
      '    image: traefik:v3.0',
      '    command:',
      '      - "--providers.file.filename=/etc/traefik/dynamic.yml"',
      '      - "--entrypoints.web.address=:80"',
      '      - "--entrypoints.websecure.address=:443"',
      '      - "--certificatesresolvers.le.acme.tlschallenge=true"',
      `      - "--certificatesresolvers.le.acme.email=${email}"`,
      '      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"',
      '    ports:',
      '      - "80:80"',
      '      - "443:443"',
      '    volumes:',
      '      - /opt/traefik/letsencrypt:/letsencrypt',
      '      - /opt/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro',
      '    restart: unless-stopped',
      '',
      '  n8n:',
      '    image: n8nio/n8n:latest',
      '    environment:',
      `      - N8N_HOST=${domain}`,
      '      - N8N_PORT=5678',
      `      - WEBHOOK_URL=https://${domain}/`,
      '      - N8N_PROTOCOL=https',
      '      - TZ=America/Los_Angeles',
      '      - N8N_BASIC_AUTH_ACTIVE=true',
      `      - N8N_BASIC_AUTH_USER=${basicUser}`,
      `      - N8N_BASIC_AUTH_PASSWORD=${basicPass}`,
      '      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY:-please-change-me}',
      '    volumes:',
      '      - /opt/n8n/data:/home/node/.n8n',
      '    labels:',
      '      - "traefik.enable=true"',
      `      - "traefik.http.routers.n8n.rule=Host(\`${domain}\`)"`,
      '      - "traefik.http.routers.n8n.entrypoints=websecure"',
      '      - "traefik.http.routers.n8n.tls.certresolver=le"',
      '      - "traefik.http.services.n8n.loadbalancer.server.port=5678"',
      '    restart: unless-stopped',
      'EOF',
      'cat > /opt/traefik/dynamic.yml << "EOF"',
      'http:',
      '  routers:',
      '    redirect:',
      '      entryPoints: ["web"]',
      '      rule: "HostRegexp(`{any:.*}`)"',
      '      middlewares: ["to-https"]',
      '      service: "noop"',
      '  middlewares:',
      '    to-https:',
      '      redirectScheme: { scheme: https, permanent: true }',
      '  services:',
      '    noop: { loadBalancer: { servers: [{ url: "http://127.0.0.1" }] } }',
      'EOF',
      'touch /opt/traefik/letsencrypt/acme.json && chmod 600 /opt/traefik/letsencrypt/acme.json',
      'docker compose -f /opt/n8n/docker-compose.yml up -d'
    );

    const instance = new ec2.Instance(this, 'N8nEc2', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ami,
      role,
      securityGroup: sg,
      userData
    });

    // Elastic IP
    const eip = new ec2.CfnEIP(this, 'N8nEip', { domain: 'vpc' });
    new ec2.CfnEIPAssociation(this, 'N8nEipAssoc', {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId
    });

    // Create hosted zone and DNS record
    if (props.hostedZoneName && props.domainName) {
      const zone = new route53.HostedZone(this, 'HostedZone', {
        zoneName: props.hostedZoneName
      });
      
      new route53.ARecord(this, 'N8nARecord', {
        zone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromIpAddresses(eip.ref),
        ttl: cdk.Duration.minutes(1)
      });
      
      new cdk.CfnOutput(this, 'HostedZoneId', { value: zone.hostedZoneId });
      new cdk.CfnOutput(this, 'NameServers', { value: cdk.Fn.join(', ', zone.hostedZoneNameServers!) });
    }

    new cdk.CfnOutput(this, 'ElasticIP', { value: eip.ref });
    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'N8nURL', { value: `https://${domain}` });
  }
}