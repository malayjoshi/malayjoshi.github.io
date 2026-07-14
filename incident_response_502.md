# Incident Response Runbook: Troubleshooting 502 Bad Gateway Errors

This runbook outlines the step-by-step diagnostic workflow and mitigation procedures for resolving **HTTP 502 Bad Gateway** errors in the SaaS production environment.

---

## 1. Architectural Error Context
A `502 Bad Gateway` indicates that an edge node, reverse proxy, or load balancer acting as a gateway was unable to get a valid response from the upstream backend service. In this SaaS architecture, the request path has three potential fail points:

```
[ User ]
   │
   ▼
[ Cloudflare Edge ] ──(Fail Point A)──► [ AWS ALB ] ──(Fail Point B)──► [ Nginx Ingress ] ──(Fail Point C)──► [ App Pods ]
```

- **Fail Point A**: Cloudflare cannot reach the AWS ALB (e.g., DNS error, ALB security group blocking public IPs).
- **Fail Point B**: ALB cannot reach the Nginx Ingress Controllers on Kubernetes worker nodes (e.g., target group health check failures).
- **Fail Point C**: Nginx Ingress cannot connect to application pods (e.g., crash loops, failed readiness probes, network policies blocking traffic).

---

## 2. Emergency Triage Checklist (First 5 Minutes)

### Step 1: Identify the Error Source (Cloudflare vs. Internal)
Observe the error page returned to the client:
- **Cloudflare-branded 502 Page**: The issue is between Cloudflare and the AWS ALB. Check if the ALB is resolving or if the Origin Shield blocks Cloudflare IPs.
- **Plain Nginx 502 Page**: The issue is between the Ingress Controller and the application pods. The Nginx reverse proxy itself is online and answering requests but cannot reach the backend.
- **AWS ELB 502 Page**: The issue is between the ALB and the Nginx Ingress Controller targets.

### Step 2: Determine Scope of Impact
Query metrics/logs to see if the issue is global or isolated:
- Is it affecting all hostnames (`app.saasapp.com` and `api.saasapp.com`)?
- Is it isolated to specific endpoints (e.g., `/api/v1/auth`)?
- Check Grafana's Ingress Request Latency and Ingress HTTP 5xx dashboards.

---

## 3. Detailed Diagnostic Flow

### Phase A: Edge & Load Balancer Check (Cloudflare ◄► ALB)
If Cloudflare reports that the origin server is unreachable:
1. **Validate AWS ALB State**:
   - Check the AWS Console or run the AWS CLI to ensure the load balancer state is `active`:
     ```bash
     aws elbv2 describe-load-balancers --load-balancer-arns <ALB_ARN> --query "LoadBalancers[*].State"
     ```
2. **Verify Security Group Ingress Rules**:
   - Ensure the ALB Security Group allows incoming HTTPS (TCP 443) traffic from [Cloudflare's Published IP Ranges](https://www.cloudflare.com/ips/).
3. **Verify Target Group Health**:
   - Check the health status of the Nginx Ingress target group:
     ```bash
     aws elbv2 describe-target-health --target-group-arn <TARGET_GROUP_ARN>
     ```
   - If targets show `Unhealthy` with reason `Elb.RegistrationFailed` or `Target.ResponseCodeMismatch`, proceed to **Phase B**.

---

### Phase B: Kubernetes Ingress Layer Check (ALB ◄► Nginx Ingress)
If ALB target groups are reporting ingress controller instances as unhealthy:
1. **Check Ingress Controller Pod Status**:
   - Ensure the Ingress Controller pods are running and ready:
     ```bash
     kubectl get pods -n ingress-nginx -o wide
     ```
2. **Inspect Ingress Controller Logs**:
   - Look for connections being dropped, timeouts, or config reload failures:
     ```bash
     kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=200
     ```
   - Common indicators:
     - `connect() failed (111: Connection refused) while connecting to upstream`: The target K8s Service IP or pod IP is rejecting connections.
     - `upstream prematurely closed connection while reading response header`: The application container crashed mid-request.

---

### Phase C: Application Compute Layer Check (Nginx ◄► App Pods)
If the ingress controller is healthy but throwing 502s when proxying to application pods:
1. **Check Application Pods State**:
   - View the status of application pods in the `prod-apps` namespace:
     ```bash
     kubectl get pods -n prod-apps -l app=saas-api-service
     ```
2. **Look for Restarts and Crash Loops**:
   - If pods show status `CrashLoopBackOff` or `Error`, inspect the termination reason:
     ```bash
     kubectl describe pod <pod-name> -n prod-apps
     ```
   - Look for **Exit Code 137 (OOMKilled)**, indicating the container exceeded its configured RAM limits and was terminated by the Linux kernel.
3. **Verify Liveness/Readiness Probes**:
   - Check if pods are failing readiness checks, causing them to be removed from the Service endpoint list:
     ```bash
     kubectl describe pod <pod-name> -n prod-apps | grep -A 3 "Readiness"
     ```
4. **Examine Application Stdout logs**:
   - Retrieve error messages or stack traces directly from the container:
     ```bash
     kubectl logs -n prod-apps deployment/saas-api-service --tail=100
     ```

---

### Phase D: Network & Dependency Policy Checks (Cilium ◄► Pods ◄► Database)
If pods are running green but Ingress still fails to connect:
1. **Validate Calico/Cilium Network Policies**:
   - Confirm that a network policy is not blocking traffic from the `ingress-nginx` namespace to the `prod-apps` namespace:
     ```bash
     kubectl get networkpolicies -n prod-apps
     ```
   - Temporarily inspect network blockages using Cilium monitor commands if installed:
     ```bash
     cilium monitor --type drop
     ```
2. **Check Database Connection Pool Exhaustion**:
   - Check if the database has reached its maximum connections limit (configured at 1000 in `terraform-db.tf`).
   - If the application blocks on acquiring database connections, health endpoints `/healthz` will timeout, triggering pod isolation and resulting in 502 errors at the ingress proxy.
   - Execute query on RDS PostgreSQL to verify connection counts:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```

---

## 4. Mitigation Strategies

Depending on the diagnosis, execute the appropriate mitigation path:

### Scenario A: Application Pod is Stuck/Unresponsive
Perform a zero-downtime rolling restart to clear deadlocks or memory leaks:
```bash
kubectl rollout restart deployment/saas-api-service -n prod-apps
```

### Scenario B: Resource Throttling / Capacity Limit
If pods are crashing due to Out-Of-Memory (OOM) or high CPU latency:
1. Increase resource limits temporarily by editing the deployment:
   ```bash
   kubectl set resources deployment/saas-api-service -n prod-apps --limits=cpu=2,memory=2Gi --requests=cpu=1,memory=1Gi
   ```
2. Manually scale pod replicas to distribute incoming load:
   ```bash
   kubectl scale deployment/saas-api-service -n prod-apps --replicas=8
   ```

### Scenario C: Bad Deployment / Regression
If the 502 errors coincided with a recent code change or release sync:
- **Rollback via GitOps (ArgoCD)**:
  - If auto-sync is enabled, revert the last commit in the GitOps git repository.
  - If auto-sync is disabled, use ArgoCD's rollback feature to return to the previous known-good sync tag.
- **Rollback via kubectl (Fallback)**:
  ```bash
  kubectl rollout undo deployment/saas-api-service -n prod-apps
  ```

---

## 5. Post-Mortem Requirements
Once the 502 error resolves and traffic is fully normalized:
1. Preserve diagnostic data: Save Grafana metric screenshots and Loki log extracts corresponding to the incident window.
2. Review HPA scaling limits: Readjust liveness/readiness probe timeouts to prevent cascading health-check failures.
3. Review connection pool settings: Tune PgBouncer client timeout thresholds to return structural fast failures (HTTP 429/503) rather than blocking until gateway timeouts (HTTP 502) occur.
