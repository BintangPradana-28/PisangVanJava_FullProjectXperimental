# Axiom Log Aggregation Integration

This document outlines the step-by-step procedure to set up Axiom as the central log aggregator for Pisang Van Java structured logs, ensuring long-term retention and audit capability.

## Overview

Pisang Van Java uses `pino` for high-performance structured JSON logging. By default, Vercel captures standard console streams, but has a short retention window and is difficult to query. Connecting Vercel's Log Drains to Axiom solves this.

---

## Setup Instructions

### 1. Create an Axiom Account
1. Visit [Axiom.co](https://axiom.co/) and sign up for a free tier account.
2. Create a new **dataset** named `pisang-van-java`.
3. Go to **Settings > API Tokens** and generate an API Token with `Ingest` permissions for the dataset.

### 2. Connect Vercel to Axiom
We use Vercel's native integration to drain logs asynchronously:
1. Go to the [Vercel Integrations page](https://vercel.com/integrations/axiom).
2. Click **Add Integration** and select your project (`pisang-van-java`).
3. Authorize access to your Axiom account.
4. Select the `pisang-van-java` dataset you created.
5. Vercel will automatically start forwarding all console outputs and Pino JSON lines to Axiom.

### 3. Verify Log Ingestion
1. Trigger some logs in your application (e.g., login, navigate around, or hit the health endpoint).
2. Go to the Axiom dashboard and open the `pisang-van-java` dataset.
3. You should see incoming JSON logs with fields like `level`, `msg`, `time`, and custom metadata.

---

## Querying Logs

In the Axiom Query explorer, you can search for security and error events using standard AQL (Axiom Query Language):

### Find all application errors
```aql
['pisang-van-java']
| where level == 'error' or level == 50
| project _time, msg, err
| order by _time desc
```

### Find webhook execution failures
```aql
['pisang-van-java']
| where msg contains 'webhook' and status >= 400
| project _time, msg, status, ip
```

### Audit critical admin actions
```aql
['pisang-van-java']
| where msg contains '[AUDIT]'
```
