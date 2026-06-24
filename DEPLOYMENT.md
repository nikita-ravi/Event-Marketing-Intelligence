# Deployment Guide

This guide covers various deployment strategies for the Event Marketing Intelligence Platform.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Serverless Deployment](#serverless-deployment)
- [Environment Configuration](#environment-configuration)
- [Security Hardening](#security-hardening)
- [Scaling Strategies](#scaling-strategies)
- [Monitoring in Production](#monitoring-in-production)

## Deployment Options

### 1. Docker Compose (Recommended for Development/Staging)

**Pros**:
- Simple orchestration
- Easy local testing
- Quick iteration
- Resource efficient

**Cons**:
- Limited scaling
- Single host deployment

**Use Case**: Development, staging environments, small-scale production

### 2. Kubernetes (Recommended for Production)

**Pros**:
- Auto-scaling
- High availability
- Rolling updates
- Resource optimization

**Cons**:
- Complex setup
- Higher learning curve
- Infrastructure costs

**Use Case**: Production environments, high traffic, enterprise deployments

### 3. Serverless (AWS Lambda + API Gateway)

**Pros**:
- Pay per execution
- Zero infrastructure management
- Auto-scaling
- Cost effective for low/variable traffic

**Cons**:
- Cold starts
- Execution time limits
- Vendor lock-in

**Use Case**: Event-driven workflows, cost-sensitive deployments, variable load

---

## Docker Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

### Production Docker Compose

Create \`docker-compose.prod.yml\`:

\`\`\`yaml
version: '3.8'

services:
  agent-backend:
    build:
      context: ./agent-backend
      dockerfile: Dockerfile
    image: event-marketing-agent:latest
    container_name: event-marketing-agent-prod
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - TICKETMASTER_API_KEY=\${TICKETMASTER_API_KEY}
      - LOG_LEVEL=info
      - LANGCHAIN_TRACING_V2=\${LANGCHAIN_TRACING_V2:-false}
      - LANGCHAIN_API_KEY=\${LANGCHAIN_API_KEY}
    volumes:
      - ./mcp-server/dist:/app/mcp-server/dist:ro
      - agent-logs:/app/logs
    depends_on:
      - mcp-server
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health')"]
      interval: 30s
      timeout: 5s
      retries: 3

  mcp-server:
    build:
      context: ./mcp-server
      dockerfile: Dockerfile
    image: event-marketing-mcp:latest
    container_name: event-marketing-mcp-prod
    restart: always
    environment:
      - NODE_ENV=production
      - TICKETMASTER_API_KEY=\${TICKETMASTER_API_KEY}
      - CACHE_DURATION_MS=900000
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: event-marketing-frontend:latest
    container_name: event-marketing-frontend-prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - agent-backend
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3

networks:
  app-network:
    driver: bridge

volumes:
  agent-logs:
    driver: local
\`\`\`

### Deploy

\`\`\`bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
\`\`\`

### SSL/TLS with Let's Encrypt

Add nginx-proxy and certbot:

\`\`\`yaml
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - ./certs:/etc/nginx/certs:ro
      - ./vhost.d:/etc/nginx/vhost.d
      - ./html:/usr/share/nginx/html

  letsencrypt:
    image: nginxproxy/acme-companion
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./certs:/etc/nginx/certs
      - ./acme:/etc/acme.sh
    depends_on:
      - nginx-proxy
\`\`\`

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or local minikube)
- kubectl configured
- Helm 3+ (optional)

### Namespace Creation

\`\`\`yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: event-marketing
\`\`\`

\`\`\`bash
kubectl apply -f namespace.yaml
\`\`\`

### Secrets Management

\`\`\`yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
  namespace: event-marketing
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "your-anthropic-api-key"
  TICKETMASTER_API_KEY: "your-ticketmaster-api-key"
  LANGCHAIN_API_KEY: "your-langsmith-api-key"
\`\`\`

\`\`\`bash
kubectl apply -f secrets.yaml
\`\`\`

### MCP Server Deployment

\`\`\`yaml
# mcp-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: event-marketing
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: event-marketing-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: TICKETMASTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: TICKETMASTER_API_KEY
        - name: CACHE_DURATION_MS
          value: "900000"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
\`\`\`

### Agent Backend Deployment

\`\`\`yaml
# agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-backend
  namespace: event-marketing
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-backend
  template:
    metadata:
      labels:
        app: agent-backend
    spec:
      containers:
      - name: agent-backend
        image: event-marketing-agent:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: ANTHROPIC_API_KEY
        - name: TICKETMASTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: TICKETMASTER_API_KEY
        - name: LANGCHAIN_TRACING_V2
          value: "true"
        - name: LANGCHAIN_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: LANGCHAIN_API_KEY
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
apiVersion: v1
kind: Service
metadata:
  name: agent-backend
  namespace: event-marketing
spec:
  selector:
    app: agent-backend
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
\`\`\`

### Frontend Deployment

\`\`\`yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: event-marketing
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: event-marketing-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"

---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: event-marketing
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
\`\`\`

### Horizontal Pod Autoscaler

\`\`\`yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-backend-hpa
  namespace: event-marketing
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
\`\`\`

### Deploy to Kubernetes

\`\`\`bash
# Apply all manifests
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f mcp-deployment.yaml
kubectl apply -f agent-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f hpa.yaml

# Verify
kubectl get all -n event-marketing

# Get frontend URL
kubectl get svc frontend -n event-marketing
\`\`\`

---

## Serverless Deployment (AWS Lambda)

### Prerequisites

- AWS Account
- AWS CLI configured
- Serverless Framework or SAM CLI

### Lambda Function (Agent Backend)

Create \`serverless.yml\`:

\`\`\`yaml
service: event-marketing-agent

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: \${opt:stage, 'dev'}
  environment:
    ANTHROPIC_API_KEY: \${env:ANTHROPIC_API_KEY}
    TICKETMASTER_API_KEY: \${env:TICKETMASTER_API_KEY}
    NODE_ENV: production

functions:
  chat:
    handler: dist/lambda.chat
    timeout: 30
    memorySize: 1024
    events:
      - http:
          path: /chat
          method: post
          cors: true

  health:
    handler: dist/lambda.health
    events:
      - http:
          path: /health
          method: get
          cors: true

resources:
  Resources:
    # API Gateway
    ApiGatewayRestApi:
      Type: AWS::ApiGateway::RestApi
      Properties:
        Name: \${self:service}-\${self:provider.stage}

plugins:
  - serverless-offline
  - serverless-plugin-typescript
\`\`\`

### Lambda Handler

Create \`agent-backend/src/lambda.ts\`:

\`\`\`typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { EventCampaignAgent } from './agent.js';

let agent: EventCampaignAgent | null = null;

async function getAgent() {
  if (!agent) {
    agent = new EventCampaignAgent(process.env.ANTHROPIC_API_KEY!);
    await agent.initialize('/opt/mcp-server/index.js');
  }
  return agent;
}

export const chat: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const agent = await getAgent();
    
    const response = await agent.chat(body.message);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export const health: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok' }),
  };
};
\`\`\`

### Deploy

\`\`\`bash
# Install Serverless Framework
npm install -g serverless

# Deploy
cd agent-backend
serverless deploy --stage prod

# Get endpoints
serverless info --stage prod
\`\`\`

---

## Environment Configuration

### Development

\`\`\`env
NODE_ENV=development
LOG_LEVEL=debug
LANGCHAIN_TRACING_V2=true
\`\`\`

### Staging

\`\`\`env
NODE_ENV=staging
LOG_LEVEL=info
LANGCHAIN_TRACING_V2=true
\`\`\`

### Production

\`\`\`env
NODE_ENV=production
LOG_LEVEL=warn
LANGCHAIN_TRACING_V2=true
\`\`\`

---

## Security Hardening

### 1. API Key Rotation

- Use secret managers (AWS Secrets Manager, Azure Key Vault)
- Rotate keys every 90 days
- Never commit keys to git

### 2. Network Security

\`\`\`yaml
# Network Policy (Kubernetes)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-backend-policy
  namespace: event-marketing
spec:
  podSelector:
    matchLabels:
      app: agent-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mcp-server
\`\`\`

### 3. Rate Limiting

Add to nginx config:

\`\`\`nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://agent-backend:3001/;
}
\`\`\`

### 4. HTTPS Only

\`\`\`yaml
# Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: event-marketing-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.eventmarketing.com
    secretName: tls-secret
  rules:
  - host: api.eventmarketing.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
\`\`\`

---

## Scaling Strategies

### Horizontal Scaling

- **Agent Backend**: 3-10 replicas based on CPU/memory
- **MCP Server**: 2-5 replicas (stateless)
- **Frontend**: 2-3 replicas (CDN for static assets)

### Vertical Scaling

- **Development**: 512MB RAM, 0.5 CPU
- **Production**: 1-2GB RAM, 1-2 CPU

### Caching Strategy

- MCP Server: 15-minute cache
- CDN: Static assets (1 year)
- API Gateway: Response caching (5 minutes)

---

## Monitoring in Production

### Metrics to Track

1. **Request Rate**: Requests per second
2. **Error Rate**: 4xx/5xx errors
3. **Latency**: p50, p95, p99
4. **Agent Performance**: Tool calls per conversation
5. **API Quota**: Ticketmaster/Anthropic usage

### Logging Strategy

- **Structured JSON logs**
- **Centralized logging** (ELK, CloudWatch, Datadog)
- **Log retention**: 30 days
- **Alert on errors**: > 5% error rate

### Monitoring Tools

- **LangSmith**: Agent tracing
- **Prometheus + Grafana**: Metrics
- **Sentry**: Error tracking
- **UptimeRobot**: Availability monitoring

---

## Documentation for New Team Members

### Onboarding Checklist

1. [ ] Clone repository
2. [ ] Install dependencies
3. [ ] Get API keys
4. [ ] Run local development
5. [ ] Read architecture docs
6. [ ] Review test suite
7. [ ] Deploy to staging

### Key Concepts

- **MCP Protocol**: stdio-based tool calling
- **Dual Frameworks**: LangChain vs Anthropic SDK
- **Deterministic Scoring**: 135-point algorithm
- **Type Safety**: Full TypeScript coverage

---

## Troubleshooting

### Common Issues

**Issue**: Agent not responding
\`\`\`bash
# Check MCP server logs
docker-compose logs mcp-server

# Verify environment variables
docker-compose exec agent-backend env | grep API_KEY
\`\`\`

**Issue**: High latency
\`\`\`bash
# Check cache hit rate
grep "Cache HIT" logs/combined.log | wc -l

# Monitor API calls
tail -f logs/combined.log | grep "API Call"
\`\`\`

**Issue**: Out of memory
\`\`\`bash
# Increase memory limit
docker update --memory 2g event-marketing-agent
\`\`\`

---

**Next Steps**: See [README.md](./README.md) for application usage guide.
