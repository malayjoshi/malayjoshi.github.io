/* Production-Ready SaaS Architecture Explorer Core Logic */

// Database of architectural nodes and their detailed specs
const nodeData = {
    "node-dns": {
        badge: "Edge Security & Routing",
        title: "Cloudflare DNS & WAF",
        description: "All public user requests hit Cloudflare first. DNS is resolved globally via Anycast DNS. The Web Application Firewall (WAF) inspects requests for security threats (vulnerabilities, OWASP top 10), mitigates DDoS attacks, terminates HTTP/3 traffic, and serves cached frontend assets.",
        tech: "Cloudflare WAF / Anycast DNS",
        pattern: "Edge Proxy & CDN caching",
        ha: "Global Edge Redundancy (No Single Point of Failure)",
        dr: "DNS Failover automation to alternative CDN/Edge provider",
        configs: ["nginx.conf"]
    },
    "node-lb": {
        badge: "Ingress Load Balancing",
        title: "AWS ALB / NLB Load Balancers",
        description: "Layer 4 Network Load Balancers (NLB) handle raw TCP connections requiring high-throughput, and route them to Kubernetes worker nodes. Layer 7 Application Load Balancers (ALB) handle path-based HTTP routing, handle custom SSL certificates, and balance traffic across ingress controllers.",
        tech: "AWS ALB / NLB / HAProxy",
        pattern: "Dedicated Load Balancing Layer",
        ha: "Multi-AZ Load Balancer deployment with cross-zone routing",
        dr: "DNS redirection to a standby region load balancer",
        configs: ["nginx.conf"]
    },
    "node-ingress": {
        badge: "Kubernetes Ingress & Routing",
        title: "Nginx Ingress Controller",
        description: "The ingress controller routes traffic inside the Kubernetes cluster. It processes host headers and path mappings, performs rate-limiting per consumer IP, attaches CORS policies, and proxies traffic to the target Kubernetes Service IP.",
        tech: "Nginx Ingress / Envoy Proxy",
        pattern: "API Gateway & Reverse Proxy",
        ha: "DaemonSet deployment on multiple nodes with HPA scaling",
        dr: "Traffic fallback to static 503 error page in object storage",
        configs: ["k8s-ingress.yaml", "nginx.conf"]
    },
    "node-pods": {
        badge: "Application Compute Layer",
        title: "Microservice Container Pods",
        description: "Microservices (e.g., API service, Auth service) run as Docker containers inside Kubernetes Pods. Pods are deployed as Deployments in multiple Availability Zones, managed by Horizontal Pod Autoscalers (HPA) to scale dynamically based on CPU, RAM, or custom requests metrics.",
        tech: "Docker / Go / Node.js / Kubernetes",
        pattern: "Containerized Microservices",
        ha: "Multi-AZ Pod Anti-affinity rules, auto-restart on crash",
        dr: "Self-healing deployments and automated rollbacks via GitOps",
        configs: ["k8s-ingress.yaml"]
    },
    "node-secrets": {
        badge: "Secrets & Credentials Manager",
        title: "HashiCorp Vault / Secrets Manager",
        description: "Credentials, database passwords, and API keys are stored in HashiCorp Vault. Vault manages dynamic credentials (short-lived database credentials), and integrates with Kubernetes via the External Secrets Operator (ESO), injecting secrets securely into pod filesystems.",
        tech: "HashiCorp Vault / AWS Secrets Manager",
        pattern: "Dynamic Secrets & Transit Encryption",
        ha: "Multi-node Raft storage consensus cluster, multi-AZ deployment",
        dr: "Replicated Vault standby clusters in secondary DR regions",
        configs: ["vault-policy.hcl"]
    },
    "node-db": {
        badge: "Primary Database Layer",
        title: "Managed PostgreSQL (RDS Primary)",
        description: "The Primary PostgreSQL database instance manages all database writes and transaction logs (WAL). Deployed in a Multi-AZ layout, it continuously replicates transactions synchronously to a standby database instance in another availability zone.",
        tech: "PostgreSQL (AWS RDS / Cloud SQL)",
        pattern: "Primary-Replica Replication",
        ha: "Synchronous Multi-AZ standby replica with automated failover",
        dr: "Point-in-Time Recovery (PITR) + Cross-Region snapshots",
        configs: ["terraform-db.tf"]
    },
    "node-dbreplica": {
        badge: "Read Scalability Layer",
        title: "PostgreSQL Read Replica",
        description: "Read replicas offload read-heavy query traffic from the primary database instance. Managed dynamically by connection routing libraries or PgBouncer, applications query the read replica to maximize overall transaction throughput.",
        tech: "PostgreSQL Read Replica",
        pattern: "CQRS / Database Read Isolation",
        ha: "Asynchronous replication across multiple AZs",
        dr: "Can be promoted to Primary if both primary and standby fail",
        configs: ["terraform-db.tf"]
    },
    "node-cache": {
        badge: "Caching & Sessions Layer",
        title: "Redis Cluster",
        description: "Redis is deployed as an in-memory key-value database. It handles user session storage, database query caching, rate-limit counters, and publish/subscribe message streaming. This lightens database load and maintains microsecond response latencies.",
        tech: "Redis Cluster / ElastiCache",
        pattern: "In-Memory Cache Aside & Write-Through",
        ha: "Redis Master-Replica architecture with sentinel auto-failover",
        dr: "Re-creation from empty cache state or daily backups",
        configs: ["vault-policy.hcl"]
    },
    "node-monitoring": {
        badge: "Metrics & Observability",
        title: "Prometheus Monitoring Stack",
        description: "Prometheus scrapes metrics from applications, Kubernetes nodes, and cloud systems. It integrates with Grafana for visual dashboards, and uses Alertmanager to dispatch high-priority alerts to Slack, PagerDuty, or Webhooks when anomalies occur.",
        tech: "Prometheus / Grafana / Alertmanager",
        pattern: "Pull-Based Observability Engine",
        ha: "High-Availability Prometheus setup with Thanos / Cortex",
        dr: "Long-term metric retention stored in S3/Object Storage",
        configs: ["prometheus-rules.yaml"]
    },
    "node-logging": {
        badge: "Distributed Logging Layer",
        title: "Grafana Loki & Promtail",
        description: "Logs are collected by Promtail agents running on every Kubernetes node. They are aggregated in Grafana Loki, allowing developers to query application logs and track request lifecycles using correlation IDs injected by the proxy.",
        tech: "Grafana Loki / Promtail / FluentBit",
        pattern: "Centralized Log Aggregation",
        ha: "Distributed Loki microservices with object storage backends",
        dr: "Replicated logs archived in write-once-read-many (WORM) storage",
        configs: ["prometheus-rules.yaml"]
    },
    "node-git": {
        badge: "Source Code Control",
        title: "GitHub Repository (GitOps Source)",
        description: "The single source of truth for both application code and infrastructure configuration. Every update is tracked via version control. GitOps manifests define the desired state of the Kubernetes cluster, enabling automated audit trails.",
        tech: "GitHub / GitLab Enterprise",
        pattern: "GitOps Declarative Infrastructure",
        ha: "SaaS high-availability infrastructure with local git mirrors",
        dr: "Backups of git repositories and commit history stored securely",
        configs: ["github-ci.yaml", "argocd-app.yaml"]
    },
    "node-cicd": {
        badge: "Continuous Integration",
        title: "GitHub Actions CI Pipelines",
        description: "Triggered by pull requests or code merges. Linting, unit tests, and integration tests run automatically. The pipeline performs container security scans using Trivy, builds Docker images, pushes them to Amazon ECR, and commits tag updates to GitOps configs.",
        tech: "GitHub Actions / Runners / Trivy",
        pattern: "Automated Verification Pipeline",
        ha: "Distributed runner groups with auto-scaling capabilities",
        dr: "Self-hosted standby runners and backup pipeline definition files",
        configs: ["github-ci.yaml"]
    },
    "node-gitops": {
        badge: "Continuous Delivery",
        title: "ArgoCD GitOps Deployment",
        description: "ArgoCD runs inside Kubernetes and watches the GitOps manifest repository. It compares the actual running state in the cluster with the target state defined in Git. Upon detecting drift or new release tags, it performs an automated zero-downtime rolling update.",
        tech: "ArgoCD / Kustomize / Helm",
        pattern: "GitOps Pull-based Reconciliation",
        ha: "High-Availability cluster mode with state replication",
        dr: "Backup manifests stored in multiple repositories for reconstruction",
        configs: ["argocd-app.yaml"]
    }
};

// Raw file configs content matching the workspace files
const configsData = {
    "nginx.conf": `user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 8096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Custom log format with trace IDs, request times, and upstream response times
    log_format json_analytics escape=json '{'
        '"time_local":"$time_local",'
        '"remote_addr":"$remote_addr",'
        '"request":"$request",'
        '"status": "$status",'
        '"body_bytes_sent":"$body_bytes_sent",'
        '"request_time":"$request_time",'
        '"http_referrer":"$http_referer",'
        '"http_user_agent":"$http_user_agent",'
        '"upstream_response_time":"$upstream_response_time",'
        '"x_forwarded_for":"$http_x_forwarded_for",'
        '"request_id":"$request_id"'
    '}';

    access_log /var/log/nginx/access_json.log json_analytics;

    # Optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Rate Limiting: 100 requests per second per IP
    limit_req_zone $binary_remote_addr zone=api_limit:20m rate=100r/s;
    limit_req_status 429;

    # SSL / TLS Settings (Mozilla Modern Configuration)
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS (1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none';" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Upstream backend (Kubernetes Ingress Controllers)
    upstream k8s_ingress {
        server 10.0.12.15:443 max_fails=3 fail_timeout=10s;
        server 10.0.13.20:443 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    # Main HTTP Server redirecting to HTTPS
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name api.saasapp.com app.saasapp.com;
        return 301 https://$host$request_uri;
    }

    # HTTPS Server Proxying to Kubernetes Ingress
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name app.saasapp.com api.saasapp.com;

        # SSL Certificates
        ssl_certificate /etc/letsencrypt/live/saasapp.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/saasapp.com/privkey.pem;

        location / {
            proxy_pass https://k8s_ingress;
            
            # Proxy headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Request-ID $request_id; # Inject trace ID

            # Upstream keepalive parameters
            proxy_http_version 1.1;
            proxy_set_header Connection "";

            # Buffering & Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            proxy_buffers 16 16k;
            proxy_buffer_size 32k;
        }

        # API endpoint rate-limiting
        location /api/v1/ {
            limit_req zone=api_limit burst=50 nodelay;
            proxy_pass https://k8s_ingress;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Request-ID $request_id;
        }

        # Error Pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}`,
    "k8s-ingress.yaml": `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saas-app-ingress
  namespace: prod-apps
  annotations:
    kubernetes.io/ingress.class: "nginx"
    # SSL/TLS Auto-Provisioning via cert-manager Let's Encrypt issuer
    cert-manager.io/cluster-issuer: "letsencrypt-production"
    
    # Ingress Controller Rate Limiting (Secondary buffer behind Nginx reverse proxy)
    nginx.ingress.kubernetes.io/limit-connections: "20"
    nginx.ingress.kubernetes.io/limit-rps: "100"
    
    # Ingress Custom SSL Settings
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    
    # CORS Configuration
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.saasapp.com"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"
    
    # Buffer limits & client upload sizes
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"

    # Injecting unique trace ID for tracing (OpenTelemetry correlation)
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header X-Request-ID $req_id;
spec:
  tls:
    - hosts:
        - app.saasapp.com
        - api.saasapp.com
      secretName: saasapp-tls-cert
  rules:
    # Frontend Single Page App (SPA) Traffic
    - host: app.saasapp.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
    # Core API and Auth Traffic
    - host: api.saasapp.com
      http:
        paths:
          - path: /api/v1/auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: 8080
          - path: /api/v1
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8000`,
    "terraform-db.tf": `# Terraform configuration for Multi-AZ PostgreSQL RDS Database & Read Replica
provider "aws" {
  region = "us-east-1"
}

# Subnet group for RDS deployment across multiple availability zones
resource "aws_db_subnet_group" "db_subnet" {
  name       = "saas-db-subnet-group"
  subnet_ids = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1", "subnet-0123456789abcdef2"]

  tags = {
    Name        = "SaaS DB Subnet Group"
    Environment = "Production"
  }
}

# DB Security Group allowing access only from the Kubernetes worker nodes
resource "aws_security_group" "db_sg" {
  name        = "saas-db-sg"
  description = "Allow inbound PostgreSQL traffic from EKS worker nodes"
  vpc_id      = "vpc-0123456789abcdef0"

  ingress {
    description     = "PostgreSQL from Kubernetes worker nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = ["sg-0987654321fedcba0"] # K8s worker node security group ID
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Custom Database Parameters (Optimization and Security)
resource "aws_db_parameter_group" "pg_params" {
  name   = "saas-postgres15-parameters"
  family = "postgres15"

  # Performance Tuning
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/32768}"
  }

  parameter {
    name  = "work_mem"
    value = "16384" # 16MB per query
  }

  # Connection Management
  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1" # Force SSL connections
  }
}

# Primary Database (Multi-AZ Master)
resource "aws_db_instance" "db_primary" {
  identifier                  = "saas-db-primary"
  engine                      = "postgres"
  engine_version              = "15.4"
  instance_class              = "db.r6g.xlarge" # Memory-optimized
  allocated_storage           = 100
  max_allocated_storage       = 1000            # Autoscale storage up to 1TB
  storage_type                = "gp3"
  db_name                     = "saas_prod"
  username                    = var.db_master_username
  password                    = var.db_master_password
  port                        = 5432
  
  # High Availability & Networking
  multi_az                    = true # Multi-AZ deployment for failover HA
  db_subnet_group_name        = aws_db_subnet_group.db_subnet.name
  vpc_security_group_ids      = [aws_security_group.db_sg.id]
  publicly_accessible         = false

  # Backup & Maintenance Policies
  backup_retention_period     = 30
  backup_window               = "03:00-04:00"
  copy_tags_to_snapshot       = true
  deletion_protection         = true # Prevent accidental deletion
  skip_final_snapshot         = false

  # Performance Insights (Real-time analytics)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Encryption at rest
  storage_encrypted           = true
  kms_key_id                  = "arn:aws:kms:us-east-1:123456789012:key/kms-uuid"

  parameter_group_name        = aws_db_parameter_group.pg_params.name
}

# Read Replica Database (Read Scalability)
resource "aws_db_instance" "db_replica" {
  identifier                  = "saas-db-replica"
  replicate_source_db         = aws_db_instance.db_primary.identifier
  instance_class              = "db.r6g.xlarge"
  storage_type                = "gp3"
  port                        = 5432
  
  vpc_security_group_ids      = [aws_security_group.db_sg.id]
  publicly_accessible         = false
  parameter_group_name        = aws_db_parameter_group.pg_params.name
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
}`,
    "prometheus-rules.yaml": `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: saas-alert-rules
  namespace: monitoring
  labels:
    role: alert-rules
    prometheus: k8s-prometheus
spec:
  groups:
    - name: KubernetesInfrastructureAlerts
      rules:
        # Node status check
        - alert: HostNodeDown
          expr: up{job="kubernetes-nodes"} == 0
          for: 5m
          labels:
            severity: critical
            tier: infrastructure
          annotations:
            summary: "Kubernetes node down"
            description: "Node {{ $labels.instance }} has been unreachable for more than 5 minutes."

        # High CPU utilisation alert
        - alert: HostCpuHighUsage
          expr: (100 - (rate(node_cpu_seconds_total{mode="idle"}[5m]) * 100)) > 85
          for: 10m
          labels:
            severity: warning
            tier: infrastructure
          annotations:
            summary: "High CPU usage on {{ $labels.instance }}"
            description: "CPU usage on node {{ $labels.instance }} is currently {{ $value | printf \\"%.2f\\" }}%."

    - name: DatabaseAlerts
      rules:
        # High CPU usage on database
        - alert: DatabaseCpuUtilizationHigh
          expr: aws_rds_cpuutilization_average > 85
          for: 5m
          labels:
            severity: critical
            tier: database
          annotations:
            summary: "RDS Database Instance CPU high"
            description: "RDS database {{ $labels.dbinstance_identifier }} CPU utilization is {{ $value }}%."

        # Replica Lag critical alert
        - alert: DatabaseReplicaLagHigh
          expr: aws_rds_replica_lag_average > 60
          for: 2m
          labels:
            severity: critical
            tier: database
          annotations:
            summary: "RDS Database Read Replica Lag High"
            description: "Replica lag for {{ $labels.dbinstance_identifier }} exceeds 60 seconds."

    - name: ApplicationPerformanceAlerts
      rules:
        # High HTTP 5xx rate
        - alert: HighHttp5xxErrorRate
          expr: sum(rate(nginx_ingress_controller_requests{status=~"5.*"}[5m])) / sum(rate(nginx_ingress_controller_requests[5m])) * 100 > 2
          for: 3m
          labels:
            severity: critical
            tier: application
          annotations:
            summary: "High HTTP 5XX Error Rate in Ingress"
            description: "Ingress 5XX errors are over 2% of total traffic in the last 3 minutes."`,
    "github-ci.yaml": `# Production CI Pipeline for SaaS Application
name: SaaS CI Pipeline

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

permissions:
  contents: read
  id-token: write # Required for AWS OIDC authentication

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  IMAGE_NAME: saas-api-service
  GITOPS_REPO: myorg/saas-gitops-manifests

jobs:
  validate-and-test:
    name: Code Verification
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.20'
          cache: true

      - name: Run Linters (golangci-lint)
        uses: golangci/golangci-lint-action@v3
        with:
          version: v1.53

      - name: Run Unit Tests
        run: |
          go test -v -race -coverprofile=coverage.out ./...

  security-scan:
    name: Security Vulnerability Scanning
    needs: validate-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Run Trivy FS Scanner (Dependency Check)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          severity: 'HIGH,CRITICAL'
          exit-code: '1'

  build-and-push:
    name: Containerize & Push ECR
    needs: [validate-and-test, security-scan]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Configure AWS Credentials (OIDC - Passwordless)
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-ecr-role
          aws-region: \${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and Push Docker Image
        run: |
          docker build -t \${{ env.ECR_REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }} .
          docker push \${{ env.ECR_REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}`,
    "argocd-app.yaml": `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: saas-production-application
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: 'https://github.com/myorg/saas-gitops-manifests.git'
    targetRevision: HEAD
    path: environments/production
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: prod-apps
  syncPolicy:
    automated:
      prune: true     # Auto delete resources deleted in git
      selfHeal: true  # Auto overwrite cluster manual changes (drift prevention)
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m`,
    "vault-policy.hcl": `# Production HashiCorp Vault Access Policy for SaaS App
# Mapped to the Kubernetes ServiceAccount token via Vault K8s Auth.

# 1. Read static application secrets
path "secret/data/production/saas-api/*" {
  capabilities = ["read"]
}

# 2. Request dynamic database credentials (PostgreSQL roles)
path "database/creds/saas-app-role" {
  capabilities = ["read"]
}

# 3. Allow renewing database credential lease times
path "sys/leases/renew" {
  capabilities = ["update"]
}

path "sys/leases/renew/database/creds/saas-app-role/*" {
  capabilities = ["update"]
}

# 4. Transit engine access for application-layer encryption (PII)
path "transit/encrypt/saas-data-key" {
  capabilities = ["update"]
}

path "transit/decrypt/saas-data-key" {
  capabilities = ["update"]
}

# 5. Read-only health check endpoint
path "sys/health" {
  capabilities = ["read"]
}`
};

// Code highlighting implementation helpers
function syntaxHighlight(code, lang) {
    if (!code) return "";
    // Clean escape values
    let escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Regex logic for highlighting
    // Comments
    escaped = escaped.replace(/(\s|^)(#.*|(\/\/.*))/g, '$1<span class="token-comment">$2</span>');
    
    // Keywords
    const keywords = [
        '\\bapiVersion\\b', '\\bkind\\b', '\\bmetadata\\b', '\\bspec\\b', '\\bprovider\\b', '\\bresource\\b',
        '\\bvariable\\b', '\\btype\\b', '\\bdescription\\b', '\\bsensitive\\b', '\\bports\\b', '\\bhosts\\b',
        '\\bhttp\\b', '\\bserver\\b', '\\blisten\\b', '\\blocation\\b', '\\bupstream\\b', '\\bgzip\\b',
        '\\bssl_protocols\\b', '\\bpath\\b', '\\bcapabilities\\b', '\\bname\\b', '\\bnamespace\\b',
        '\\bon\\b', '\\bjobs\\b', '\\bsteps\\b', '\\bruns-on\\b', '\\buses\\b', '\\bwith\\b', '\\brun\\b', '\\benv\\b'
    ];
    const keyRegex = new RegExp(`(${keywords.join('|')})`, 'g');
    escaped = escaped.replace(keyRegex, '<span class="token-keyword">$1</span>');

    // Values in YAML key: value
    escaped = escaped.replace(/(:\s+)(["'][^"']*["']|\S+)/g, '$1<span class="token-string">$2</span>');

    // Numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');

    return escaped;
}

// Current state management
let activeNodeId = "node-dns";
let activeConfigName = "nginx.conf";

// UI References
const detailsBadge = document.getElementById("details-badge");
const detailsTitle = document.getElementById("details-title");
const detailsDescription = document.getElementById("details-description");
const techVal = document.getElementById("tech-val");
const patternVal = document.getElementById("pattern-val");
const haVal = document.getElementById("ha-val");
const drVal = document.getElementById("dr-val");

const codeBlock = document.getElementById("code-block");
const configTabsContainer = document.getElementById("config-tabs");
const copyBtn = document.getElementById("copy-btn");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const consoleLogs = document.getElementById("console-logs");
const healthStatus = document.getElementById("health-status");

// Function to select and render a node's detail view
function selectNode(nodeId) {
    // Toggle active classes on SVG nodes
    document.querySelectorAll(".svg-node").forEach(node => {
        node.classList.remove("active");
    });
    
    const svgNode = document.getElementById(nodeId);
    if (svgNode) {
        svgNode.classList.add("active");
    }

    const data = nodeData[nodeId];
    if (!data) return;

    activeNodeId = nodeId;

    // Animate details transition
    const detailsCard = document.getElementById("details-card");
    detailsCard.style.opacity = 0.5;
    detailsCard.style.transform = "translateY(5px)";
    
    setTimeout(() => {
        // Update content
        detailsBadge.innerText = data.badge;
        detailsTitle.innerText = data.title;
        detailsDescription.innerText = data.description;
        techVal.innerText = data.tech;
        patternVal.innerText = data.pattern;
        haVal.innerText = data.ha;
        drVal.innerText = data.dr;

        // Render associated tabs
        renderConfigTabs(data.configs);

        detailsCard.style.opacity = 1;
        detailsCard.style.transform = "translateY(0)";
        detailsCard.style.transition = "all 0.3s ease";
    }, 150);

    // Update connection lines active status
    updateConnectionHighlight(nodeId);
}

// Update connection lines when clicking nodes
function updateConnectionHighlight(nodeId) {
    document.querySelectorAll(".svg-connection").forEach(line => {
        line.classList.remove("active");
    });

    // Map which paths light up per node selection to represent operational flow
    const connectionMap = {
        "node-dns": ["conn-dns-lb"],
        "node-lb": ["conn-dns-lb", "conn-lb-ingress"],
        "node-ingress": ["conn-lb-ingress", "conn-ingress-app1", "conn-ingress-app2", "conn-ingress-app3"],
        "node-pods": ["conn-ingress-app1", "conn-ingress-app2", "conn-ingress-app3", "conn-app-vault", "conn-app-redis", "conn-app-rds"],
        "node-secrets": ["conn-app-vault"],
        "node-db": ["conn-app-rds", "conn-rds-replica"],
        "node-dbreplica": ["conn-rds-replica"],
        "node-cache": ["conn-app-redis"],
        "node-monitoring": ["conn-k8s-monitoring", "conn-monitoring-logging"],
        "node-logging": ["conn-monitoring-logging"],
        "node-git": ["conn-git-ci"],
        "node-cicd": ["conn-git-ci", "conn-ci-cd"],
        "node-gitops": ["conn-ci-cd", "conn-cd-k8s"]
    };

    const connections = connectionMap[nodeId] || [];
    connections.forEach(connId => {
        const line = document.getElementById(connId);
        if (line) line.classList.add("active");
    });
}

// Dynamic configuration tabs generation
function renderConfigTabs(configs) {
    configTabsContainer.innerHTML = "";
    if (!configs || configs.length === 0) {
        // Fallback configurations if node doesn't have custom configs
        configs = ["nginx.conf", "k8s-ingress.yaml", "terraform-db.tf"];
    }

    configs.forEach((cfgName, idx) => {
        const btn = document.createElement("button");
        btn.className = `config-tab ${idx === 0 ? 'active' : ''}`;
        btn.dataset.config = cfgName;
        btn.innerText = cfgName;
        btn.addEventListener("click", () => {
            document.querySelectorAll(".config-tab").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            loadConfigContent(cfgName);
        });
        configTabsContainer.appendChild(btn);
    });

    // Load first config by default
    loadConfigContent(configs[0]);
}

// Load configurations inside pre/code blocks
function loadConfigContent(cfgName) {
    activeConfigName = cfgName;
    const rawContent = configsData[cfgName] || "# Configuration not found.";
    codeBlock.innerHTML = syntaxHighlight(rawContent);
}

// Show Toast System
function showToast(message, type = "info") {
    toastMessage.innerText = message;
    
    // Choose icons
    const icon = toast.querySelector(".toast-icon");
    if (type === "error") {
        icon.innerText = "❌";
        toast.style.borderColor = "var(--danger)";
        toast.style.boxShadow = "var(--glow-danger)";
    } else if (type === "success") {
        icon.innerText = "✅";
        toast.style.borderColor = "var(--success)";
        toast.style.boxShadow = "var(--glow-success)";
    } else {
        icon.innerText = "ℹ️";
        toast.style.borderColor = "var(--border-color-active)";
        toast.style.boxShadow = "var(--glow-primary)";
    }

    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 4000);
}

// Console logging simulator helper
function addConsoleLog(text, type = "info") {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-text ${type}">${text}</span>`;
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// SIMULATOR ACTIONS SETUP

// 1. Pod failure simulation
document.getElementById("sim-pod-failure").addEventListener("click", () => {
    addConsoleLog("Simulating Pod Crash event...", "warning");
    showToast("Triggered: Pod Crash Simulation");

    const podsNode = document.getElementById("node-pods");
    podsNode.style.filter = "drop-shadow(0px 0px 10px #ff4d6d)";
    
    setTimeout(() => {
        addConsoleLog("[CRITICAL] Pod api-pod-2 heartbeat timeout on node-worker-3", "danger");
        addConsoleLog("[INFO] Kubernetes kube-scheduler detecting replica gap...", "info");
    }, 1000);

    setTimeout(() => {
        addConsoleLog("[INFO] Replicaset 'saas-api-service' scaling action started: desired=3, ready=2", "info");
        addConsoleLog("[INFO] Creating new pod container 'saas-api-service-abc12'...", "info");
    }, 2500);

    setTimeout(() => {
        addConsoleLog("[SUCCESS] Pod saas-api-service-abc12 running. Readiness Probe PASSED.", "success");
        addConsoleLog("[SUCCESS] Ingress controller endpoints refreshed. Service restored.", "success");
        podsNode.style.filter = "none";
        showToast("Self-Healing Complete: Kubernetes rescheduled the failed pod", "success");
    }, 4500);
});

// 2. DB Failover simulation
document.getElementById("sim-db-failover").addEventListener("click", () => {
    addConsoleLog("Simulating Database Master Failure...", "warning");
    showToast("Triggered: Database Failover Process");

    const dbNode = document.getElementById("node-db");
    const dbreplicaNode = document.getElementById("node-dbreplica");
    
    dbNode.style.filter = "drop-shadow(0px 0px 10px #ff4d6d)";
    healthStatus.innerText = "DB Failover Active";
    healthStatus.parentElement.style.color = "var(--warning)";
    healthStatus.parentElement.style.borderColor = "rgba(255, 183, 3, 0.3)";
    healthStatus.previousElementSibling.style.backgroundColor = "var(--warning)";
    healthStatus.previousElementSibling.style.boxShadow = "0 0 10px var(--warning)";

    setTimeout(() => {
        addConsoleLog("[CRITICAL] Primary RDS Instance heartbeat lost. Network partition detected.", "danger");
        addConsoleLog("[INFO] Multi-AZ AWS RDS Engine initiating automated failover...", "info");
    }, 1200);

    setTimeout(() => {
        addConsoleLog("[INFO] Promoting Sync Standby in AZ 'us-east-1b' to Primary role...", "info");
        dbreplicaNode.style.filter = "drop-shadow(0px 0px 10px #00ff87)";
    }, 2800);

    setTimeout(() => {
        addConsoleLog("[INFO] Updating DB CNAME records to resolve to new primary instance...", "info");
        addConsoleLog("[INFO] PgBouncer connection pool buffering client queries...", "info");
    }, 4000);

    setTimeout(() => {
        addConsoleLog("[SUCCESS] Failover complete. Standby promoted to Primary. Write operations active.", "success");
        addConsoleLog("[SUCCESS] Re-establishing async read replica in us-east-1a.", "success");
        
        dbNode.style.filter = "none";
        dbreplicaNode.style.filter = "none";
        
        healthStatus.innerText = "System Operational";
        healthStatus.parentElement.style.color = "var(--success)";
        healthStatus.parentElement.style.borderColor = "rgba(0, 255, 135, 0.2)";
        healthStatus.previousElementSibling.style.backgroundColor = "var(--success)";
        healthStatus.previousElementSibling.style.boxShadow = "0 0 10px var(--success)";
        
        showToast("Database Failover Completed successfully in 45s", "success");
    }, 6000);
});

// 3. Traffic Spike / Autoscaling simulation
document.getElementById("sim-traffic-spike").addEventListener("click", () => {
    addConsoleLog("Incoming API traffic spike detected: 15,000 requests/sec", "warning");
    showToast("Triggered: API Traffic Autoscaling");

    const ingressNode = document.getElementById("node-ingress");
    const podsNode = document.getElementById("node-pods");
    
    ingressNode.style.filter = "drop-shadow(0px 0px 10px #00f2fe)";
    
    setTimeout(() => {
        addConsoleLog("[INFO] Nginx Ingress rate-limits triggered. Rate-limiting IP bursts.", "info");
        addConsoleLog("[WARNING] Horizontal Pod Autoscaler (HPA) triggers scaling: CPU load @ 88%", "warning");
    }, 1200);

    setTimeout(() => {
        addConsoleLog("[INFO] Kubernetes HPA scaling replicas from 3 to 8 pods...", "info");
        podsNode.style.filter = "drop-shadow(0px 0px 10px #00ff87)";
    }, 2500);

    setTimeout(() => {
        addConsoleLog("[INFO] Node group auto-scaling triggered: Karpenter spinning up 2 spot instances...", "info");
    }, 3800);

    setTimeout(() => {
        addConsoleLog("[SUCCESS] Karpenter instances joined cluster. Pod distribution complete.", "success");
        addConsoleLog("[SUCCESS] API average latency stabilized at 12ms. Load balanced successfully.", "success");
        
        ingressNode.style.filter = "none";
        podsNode.style.filter = "none";
        
        showToast("Infrastructure Auto-scaled: HPA & Karpenter resolved traffic spike", "success");
    }, 5500);
});

// 4. GitOps rolling deployment simulation
document.getElementById("sim-deploy").addEventListener("click", () => {
    addConsoleLog("Deploying version release v1.2.4...", "info");
    showToast("Triggered: Continuous Delivery GitOps Release");

    const gitNode = document.getElementById("node-git");
    const cicdNode = document.getElementById("node-cicd");
    const gitopsNode = document.getElementById("node-gitops");
    const podsNode = document.getElementById("node-pods");

    gitNode.style.filter = "drop-shadow(0px 0px 10px #b163ff)";

    setTimeout(() => {
        addConsoleLog("[INFO] Commit pushed to main: 'release(api): bump version v1.2.4'", "info");
        addConsoleLog("[INFO] GitHub Actions CI pipeline started...", "info");
        gitNode.style.filter = "none";
        cicdNode.style.filter = "drop-shadow(0px 0px 10px #00f2fe)";
    }, 1000);

    setTimeout(() => {
        addConsoleLog("[INFO] Golang checks and unit tests PASSED. Trivy image vulnerability scan PASSED.", "success");
        addConsoleLog("[INFO] Pushed build image 'saas-api-service:v1.2.4' to ECR.", "info");
        addConsoleLog("[INFO] GitOps manifests updated with new image tag.", "info");
        cicdNode.style.filter = "none";
        gitopsNode.style.filter = "drop-shadow(0px 0px 10px #00ff87)";
    }, 3000);

    setTimeout(() => {
        addConsoleLog("[INFO] ArgoCD pulling latest Git state. Desired state: v1.2.4, Active: v1.2.3", "info");
        addConsoleLog("[INFO] Syncing cluster. Initiating rolling update (Zero Downtime)...", "info");
        gitopsNode.style.filter = "none";
        podsNode.style.filter = "drop-shadow(0px 0px 10px #00ff87)";
    }, 4500);

    setTimeout(() => {
        addConsoleLog("[SUCCESS] Rolling update complete. Old pods terminated. Version v1.2.4 is live.", "success");
        podsNode.style.filter = "none";
        showToast("GitOps Rollout Complete: Application updated to v1.2.4", "success");
    }, 6000);
});

// Copy Code to Clipboard setup
copyBtn.addEventListener("click", () => {
    const textToCopy = configsData[activeConfigName];
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Copied ${activeConfigName} to clipboard!`, "success");
    }).catch(err => {
        showToast("Failed to copy code.", "error");
    });
});

// Click handlers for SVG nodes
document.addEventListener("DOMContentLoaded", () => {
    Object.keys(nodeData).forEach(nodeId => {
        const svgNode = document.getElementById(nodeId);
        if (svgNode) {
            svgNode.addEventListener("click", () => {
                selectNode(nodeId);
            });
        }
    });

    // Default initialization select DNS node
    selectNode("node-dns");
});
