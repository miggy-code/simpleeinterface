# Throttl CRM Web App Redesign: System Architecture & Workflow Plan

> **⚠️ Historical V2 design doc.** This is the original V2 redesign plan. Most
> architectural decisions described here (3-table forward-only movement,
> custom-variable injection in Instantly, restricted editing) were partially
> implemented. For the live system's current state — what code exists today,
> which fields actually exist in Airtable, what the prompts say verbatim — see
> [`docs/Data_Flow_and_Schema_Map.md`](./docs/Data_Flow_and_Schema_Map.md). The
> document below is preserved as design intent.

## Executive Summary

This document outlines the redesign of the Throttl CRM web application, shifting its role from a full-featured Airtable editor to a streamlined, purpose-built interface layer. The new architecture leverages Airtable as the central lead repository and archive, while utilizing Instantly as the primary execution engine for email outreach and CRM tracking. The web app will focus exclusively on three core functions: ingesting and filtering new leads based on Ideal Customer Profile (ICP) criteria, facilitating the review and approval of AI-generated personalization hooks, and managing the transition of leads into re-engagement campaigns after initial outreach sequences conclude.

## 1. System Architecture & Data Flow

The redesigned system establishes a clear separation of concerns between Airtable, the web application, and Instantly.

### 1.1 Airtable: The Central Lead Repository

Airtable will serve as the definitive system of record and historical archive for all leads. Rather than maintaining a single monolithic table, the architecture will utilize a multi-table structure to reflect the lead lifecycle, ensuring clean data management and improved performance.

*   **Table 1: Ingestion & Personalization (Active Leads):** This table holds newly acquired leads undergoing research, AI enrichment, and personalization review. Leads remain here until they are pushed to Instantly.
*   **Table 2: Active Outreach (Instantly Sync):** Once pushed to Instantly, leads are moved to this table. It serves as a mirror of active Instantly campaigns, syncing engagement metrics (opens, replies, bounces) back from the Instantly API.
*   **Table 3: Re-engagement & Archive (The Lead Repository):** Leads are moved here after completing their initial outreach sequence (e.g., 21 days post-contact) or if they reach a terminal status (bounced, unsubscribed, disqualified). This table acts as the long-term repository for future marketing efforts, such as newsletters or blog content distribution.

### 1.2 Instantly: The Execution Engine & CRM

Instantly will handle the execution of email sequences and serve as the primary CRM for tracking active conversations.

*   **Campaign Management:** Instantly manages the email templates, sending schedules, and sequence logic.
*   **Per-Lead Personalization:** The system will utilize Instantly's `custom_variables` feature to inject unique, AI-generated personalization hooks (e.g., `{{personalization_hook}}`) into the campaign templates for each lead.
*   **Engagement Tracking:** Instantly's native Unibox and analytics will be the primary interface for monitoring replies and managing active conversations, reducing the need to replicate this functionality within the custom web app.

### 1.3 The Web Application: The Interface Layer

The web app will be stripped of its general-purpose editing capabilities and refocused as a specialized workflow tool for the Throttl team.

*   **Restricted Editing:** The app will no longer allow arbitrary editing of all Airtable fields. It will enforce a strict, read-only view for most data, exposing only the specific fields required for the current workflow step.
*   **Workflow-Driven UI:** The interface will be organized around specific tasks: reviewing new leads against ICP criteria, approving personalization hooks, and monitoring campaign ingestion.

## 2. Core Workflows & Web App Functionality

The web application will support three primary workflows, designed to streamline the lead management process.

### 2.1 Workflow 1: Ingestion & ICP Review

When new leads are acquired (e.g., via AI prospecting or manual import), they enter the "Ingestion & Personalization" Airtable. The web app will provide a dedicated view for reviewing these leads.

*   **The "New Leads" Dashboard:** This view will display all uncontacted leads that have not yet been assigned to a campaign.
*   **ICP Filtering:** The dashboard will allow users to filter and sort leads based on key ICP criteria (e.g., industry, revenue band, decision-maker role) to prioritize the most valuable prospects.
*   **Contextual Display:** The UI will present the scraped data and AI-generated insights (the "why now" or "congratulations" material) alongside the lead's basic information, providing the necessary context for the next step.

### 2.2 Workflow 2: Personalization Review & Approval

This is the core interactive feature of the redesigned web app. It allows the team to review and refine the AI-generated personalization before pushing leads to Instantly.

*   **The Personalization Workbench:** For each lead, the app will display the AI-generated `{{personalization_hook}}` alongside the contextual insights gathered during the research phase.
*   **Targeted Editing:** Users will only be able to edit the specific personalization sentence (the custom variable) and, if necessary, select or modify the target Instantly campaign. All other lead data (name, company, etc.) will be read-only in this view.
*   **Campaign Template Visibility:** The workbench will display a read-only preview of the selected campaign's email template, showing exactly how the personalization hook will be inserted into the final message.
*   **Push to Instantly:** Once the personalization is approved, a single action will push the lead to the selected Instantly campaign, utilizing the API to set the `custom_variables`. This action will also trigger the movement of the lead from the "Ingestion" table to the "Active Outreach" table in Airtable.

### 2.3 Workflow 3: Re-engagement Transition

The system must automatically manage the transition of leads from active outreach to long-term nurturing.

*   **Time-Based Rules:** A background process (e.g., a scheduled cron job or an Airtable automation) will monitor leads in the "Active Outreach" table.
*   **The 21-Day Trigger:** If a lead has been in an active campaign for 21 days without a reply or meeting booked, the system will automatically flag them for re-engagement.
*   **Table Movement:** Flagged leads will be moved from the "Active Outreach" table to the "Re-engagement & Archive" table. This ensures the active table remains clean and focused only on current campaigns.
*   **Web App Visibility:** The web app may include a simple dashboard to monitor the volume of leads transitioning into the re-engagement repository, providing visibility into the growth of the long-term marketing audience.

## 3. Technical Implementation Details

### 3.1 Instantly API Integration

The integration will rely heavily on the Instantly v2 API, specifically the `POST /api/v2/leads` endpoint for lead creation and the `PATCH /api/v2/leads/{id}` endpoint for updates.

*   **Custom Variables:** When pushing a lead to Instantly, the web app will construct a JSON payload that includes the `custom_variables` object. This object will contain the approved personalization hook, mapped to the corresponding variable name used in the campaign template (e.g., `{"personalization_hook": "I saw your recent expansion into Worcester..."}`).
*   **Campaign Assignment:** The API call will specify the `campaign_id` to enroll the lead in the correct sequence.

### 3.2 Airtable API & Table Movement

The web app will interact with Airtable via its REST API to manage data and execute table movements.

*   **Moving Records:** To move a lead between tables (e.g., from "Ingestion" to "Active Outreach"), the application will perform a two-step process: first, creating a new record in the destination table with the lead's data, and second, deleting the original record from the source table. This ensures data integrity and prevents duplication.
*   **Data Synchronization:** The web app will periodically poll the Instantly API (or utilize webhooks if available) to retrieve engagement metrics (opens, replies) and update the corresponding records in the "Active Outreach" Airtable.

### 3.3 Web App UI/UX Refinements

The user interface will be simplified to reflect the restricted editing capabilities.

*   **Removal of General Edit Forms:** The comprehensive "Edit Lead" forms will be removed.
*   **Read-Only Components:** Components displaying lead details (company info, source data) will be converted to read-only displays.
*   **Focused Input Fields:** The only editable text areas will be specifically tied to the personalization hook and campaign selection.

## 4. Next Steps & Recommendations

1.  **Airtable Schema Update:** Create the new "Active Outreach" and "Re-engagement & Archive" tables in Airtable, ensuring the necessary fields are present to support the new workflows.
2.  **Web App Code Refactoring:** Begin stripping out the general editing capabilities from the Next.js application, focusing on building the read-only contextual displays and the targeted personalization workbench.
3.  **Implement Table Movement Logic:** Develop the backend API routes within the Next.js app to handle the creation and deletion of records across the different Airtable tables.
4.  **Configure Automated Triggers:** Set up the scheduled jobs or Airtable automations required to enforce the 21-day re-engagement rule.
