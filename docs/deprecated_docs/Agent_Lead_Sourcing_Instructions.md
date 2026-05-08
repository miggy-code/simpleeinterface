# Manus Agent Instructions: Lead Sourcing & Factoid Gathering

> **Status: current and accurate** as of 2026-05-04. Field mappings and the
> "Personalization Insights" handoff convention are aligned with reality. One fix:
> the `Pipeline Status` enum no longer has an `Uncontacted` value — use `New`.
> See [`Data_Flow_and_Schema_Map.md`](./Data_Flow_and_Schema_Map.md) for the full
> Pipeline Status state machine and field inventory.

This document provides the exact instructions you should give to a Manus agent when you want it to source leads for Throttl. It is designed to work entirely with free/public sources (Google, LinkedIn, company websites) and ensures the agent gathers raw "factoids" rather than writing the final personalization hook.

---

## How to Use This Document

When you start a new Manus task for lead sourcing, copy and paste the **Agent Prompt Template** below. Fill in the bracketed variables `[LIKE THIS]` with your specific requirements for that batch.

The agent will then execute the 4-step workflow defined in the prompt, resulting in clean, qualified leads deposited directly into your Airtable `Leads` table.

---

## Agent Prompt Template

**Copy and paste the following text into a new Manus task:**

> **Task:** Source new leads for Throttl's outbound engine and insert them directly into our Airtable `Leads` table.
> 
> **Target Criteria:**
> - **Industry/Niche:** [e.g., Manufacturing, Commercial HVAC, B2B SaaS]
> - **Location:** [e.g., Sharon, MA and surrounding 20-mile radius]
> - **Company Size/Revenue:** [e.g., 10-50 employees, $2M-$10M revenue]
> - **Target Persona:** Owner, Founder, or CEO ONLY.
> - **Quantity:** Find exactly [e.g., 10] qualified leads.
> 
> **The Offer:** We are pitching a 1-hour consultation session with an AI expert to help them identify operational bottlenecks and automate workflows.
> 
> **Execution Workflow:**
> Please execute this task in the following 4 steps. Do not skip steps.
> 
> ### Step 1: Discovery (Free Sources Only)
> Use Google Search, Google Maps/Business, and LinkedIn (via public search) to identify companies that match the target criteria. 
> - For local businesses, use queries like `site:linkedin.com/company "manufacturing" "Sharon, MA"`.
> - Cross-reference company websites to verify they are still active and fit the size/revenue profile.
> 
> ### Step 2: Persona Identification & Contact Info
> For each qualified company, identify the Owner, Founder, or CEO.
> - Find their full name and LinkedIn profile URL.
> - Find their corporate email address. Use pattern guessing (e.g., `first@company.com`, `first.last@company.com`) and verify via public search if possible, or check the company website's contact/about pages.
> 
> ### Step 3: Factoid Gathering (Not Hook Writing)
> For each lead, spend 2-3 minutes researching the person and the company to find **raw factoids** that could be used for personalization. 
> - **Look for:** Recent company news, a specific project mentioned on their website, a recent LinkedIn post by the CEO, a unique company history (e.g., "3rd generation family owned"), or a specific industry pain point they likely face.
> - **The Rule of Relevance:** Do not force it. If there is nothing genuinely interesting or unique online, **leave the factoids blank**. A generic email is better than forced, irrelevant personalization.
> - **Output:** Write 2-3 bullet points of raw facts. DO NOT write the actual email hook sentence. Just gather the raw material.
> 
> ### Step 4: Airtable Ingestion
> Use the `manus-mcp-cli` tool with the `airtable` server to insert these leads directly into the `Leads` table in the `ThrottlGTM` base.
> 
> Map the data to the following fields:
> - `Name`: [Full Name]
> - `First Name`: [First Name]
> - `Last Name`: [Last Name]
> - `Email`: [Email Address]
> - `Title`: [Job Title]
> - `Company Name`: [Company Name]
> - `Company Domain`: [Website URL]
> - `LinkedIn URL`: [Person's LinkedIn URL]
> - `Industry`: [Industry]
> - `City`: [City]
> - `State`: [State]
> - `Personalization Insights`: [The raw factoids gathered in Step 3. Leave blank if nothing relevant was found.]
> - `Pipeline Status`: "New"
> 
> **Completion:** Once all leads are inserted, provide me with a summary table of the companies and CEOs you found.

---

## Why This Prompt Works

1. **It enforces the "Factoid" rule:** By explicitly telling the agent *not* to write the hook, you ensure the `Personalization Insights` field in Airtable is populated with raw data. Your web app's AI (DeepSeek) will then use those factoids to write the actual `{{personalization_hook}}` during the approval workflow.
2. **It respects the personalization threshold:** The prompt explicitly gives the agent permission to fail at personalization ("The Rule of Relevance"). This prevents the agent from hallucinating or scraping the bottom of the barrel for useless facts.
3. **It uses free sources effectively:** By guiding the agent to use specific Google Search operators (`site:linkedin.com`) and Google Maps, it bypasses the need for paid tools like Apollo or ZoomInfo for local/niche searches.
4. **It automates data entry:** The agent handles the tedious work of mapping the data into Airtable, so you only ever interact with the leads inside your custom web app dashboard.
