# Examples

## Prompts

Use these example prompts as a starting point. You can copy them into your AI Assistant chat, and adapt them to your use-case,
extend them as needed, and use them as inspiration for more advanced interactions. They are here to help you imagine how
real-time observability works together with your AI Assistant.

### Examples - Problems

```text
Ask Dynatrace to list application problems from the last 24 hours
```

```text
Let's investigate the first problem in more detail
```

### Examples - Vulnerabilities

```text
Ask Dynatrace to check for critical vulnerabilities that are OPEN
```

```text
let's compare those vulnerabilities to last month and summarize the trend
```

### Example Enquiries - Logs

```text
Analyze Dynatrace error logs for Monday mornings of the last 4 weeks and see if there is a pattern
```

### Example - Service Level Objectives (SLOs)

```text
Show me all Dynatrace SLOs and their current status
```

```text
Find failing SLOs and correlate with recent problems using Dynatrace
```

### Example - Entities

```text
Ask Dynatrace to list payment entities it's aware of
```

```text
Ask Dynatrace what is related to the books storage service
```

### Example - Metrics

```text
What performance metrics are available for the books service
```

```text
Ask Dynatrace for the daily trend of the "builtin:service.response.time" metric for the dt_books_storage service over the last week
```

### Example - Misc.

```text
Ask Dynatrace to suggest some queries for troubleshooting kubernetes
```

### **Advanced Incident Investigation**

**Multi-phase incident response:**

```
Our checkout service is experiencing high error rates. Start a systematic 4-phase incident investigation:
1. Detect and triage the active problems
2. Assess user impact and affected services
3. Perform cross-data source analysis (problems → logs)
4. Identify root cause with file/line-level precision
```

**Cross-service failure analysis:**

```
We have cascading failures across our microservices architecture.
Analyze the entity relationships and trace the failure propagation from the initial problem
through all downstream services. Show me the correlation timeline.
```

### **SLO & Reliability Engineering**

**SLO health assessment:**

```
Perform a comprehensive SLO health check:
- List all SLOs with current status and error budget
- Identify SLOs at risk of breaching targets
- Correlate failing SLOs with recent system problems
- Provide error budget consumption analysis
```

**SLO violation root cause analysis:**

```
Our payment service SLO is failing. Analyze the root cause:
- Get SLO evaluation history for the last 24 hours
- Correlate SLO violations with system problems and events
- Generate recommendations for improving reliability
```

### **Security & Compliance Analysis**

**Latest-scan vulnerability assessment:**

```
Perform a comprehensive security analysis using the latest scan data:
- Check for new vulnerabilities in our production environment
- Focus on critical and high-severity findings
- Provide evidence-based remediation paths
- Generate risk scores with team-specific guidance
```

**Multi-cloud compliance monitoring:**

```
Run a compliance assessment across our AWS, Azure, and Kubernetes environments.
Check for configuration drift and security posture changes in the last 24 hours.
```

### **DevOps & SRE Automation**

**Deployment health gate analysis:**

```
Our latest deployment is showing performance degradation.
Run deployment health gate analysis with:
- Golden signals monitoring (Rate, Errors, Duration, Saturation)
- SLO/SLI validation with error budget calculations
- Correlate deployment events with SLO violations
- Generate automated rollback recommendation if needed
```

### **Traditional Use Cases (Enhanced)**

**Find open vulnerabilities on production:**

```
I have this code snippet here in my IDE, where I get a dependency vulnerability warning for my code.
Check if I see any open vulnerability/cve on production.
Analyze a specific production problem.
```

**Debug intermittent 503 errors:**

```
Our load balancer is intermittently returning 503 errors during peak traffic.
Pull all recent problems detected for our front-end services and
run a query to correlate error rates with service instance health indicators.
I suspect we have circuit breakers triggering, but need confirmation from the telemetry data.
```

**Correlate memory issue with logs:**

```
There's a problem with high memory usage on one of our hosts.
Get the problem details and then fetch related logs to help understand
what's causing the memory spike? Which file in this repo is this related to?
```

**Analyze Kubernetes cluster events:**

```
Our application deployments seem to be failing intermittently.
Can you fetch recent events from our "production-cluster"
to help identify what might be causing these deployment issues?
```
