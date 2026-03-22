---
name: hospitality-email-node
description: Hospitality workflow was enhanced with SMTP email node bifurcating from Format Text to both Write to File and Send Email with HTML body
type: project
---

Hospitality workflow expanded from 3 nodes to 4 nodes with bifurcated output from Format Text.

**Why:** User needed email notifications sent to wmateohv@hotmail.com with formatted hospitality disruption data, in addition to the existing file output.

**How to apply:** The Format Text code node now outputs three fields: `formattedText` (plain text for file), `htmlBody` (styled HTML for email), and `emailSubject` (dynamic subject line with event/hub/PAX counts). The Send Email node uses `n8n-nodes-base.emailSend` v2.1 with SMTP credentials referenced by name `NexusRecover SMTP` and placeholder ID `CONFIGURE_ME`. User must create SMTP credentials in N8N UI before activating.
