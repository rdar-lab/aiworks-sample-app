# AiWorks — User Manual

**AiWorks — Sample App**
**Last Updated:** April 2026

Welcome to AiWorks, your AI-powered Sample App. This manual walks you through every feature of the application so you can get the most out of your experience.

---

## Table of Contents

1. [Registration & Authentication](#registration--authentication)
2. [Dashboard](#dashboard)
3. [Notifications](#notifications)
4. [Updating Your User Context](#updating-your-user-context)
5. [Knowledge Bases ♦ Pro](#knowledge-bases--pro)
6. [MCP Servers ♦ Pro](#mcp-servers--pro)
7. [Integrations ♦ Pro](#integrations--pro)
8. [Research Report Sessions ♦ Pro](#research-report-sessions--pro)
9. [License Tiers](#license-tiers)

---

## 1. Registration & Authentication

### Creating an Account

1. Navigate to the **Sign In** page (you will be redirected here automatically if not logged in).
2. Click **"Don't have an account? Register"** to open the registration form.
3. Fill in the following fields:
   - **Username** — at least 2 characters.
   - **Email** — a valid email address where you will receive a verification token.
   - **Password** — at least 8 characters.
4. Check the **"I agree to the License Agreement"** checkbox.
5. Click **Register**.

### Email Verification

After registering, AiWorks sends a one-time token to your email address.

1. Open your inbox (check your spam/junk folder if you don't see it).
2. Copy the token from the email.
3. Paste it into the **Token** field on the verification screen.
4. Click **Submit Token**.

You will be redirected to the sign-in page once your email is verified.

### Signing In

1. Enter your **Username or Email** and **Password**.
2. Click **Sign In**.

A **"Continue with Google"** button is also available above the sign-in form, which enables users to use their Google account to sign-in or register easily.

### Resetting Your Password

1. On the **Sign In** page, click **"Forgot Password?"**.
2. Enter the email address associated with your account and click **Request Reset**.
3. Open your inbox and copy the reset token from the email.
4. Enter the token and your new password, then click **Reset Password**.

---

## 2. Dashboard

The **Dashboard** is the first page you see after signing in. It provides a unified overview of your activity and quick access to every major feature.

### Action Buttons

The dashboard action buttons give you direct access to the main session types.

| Button | Session Type | Description |
|---|---|---|
| **Research a Topic** | Research Report | Generate a deep research report on any topic |

> ♦ These options require a Pro account and are locked for free users.

### Recent Activity

Below the action buttons, the dashboard shows your **Recent Activity** — a list of your most recent sessions. Each session card shows the session title, the session type icon, the status badge (where applicable), and the date.

Click any session to reopen it.

---

## 3. Notifications

The **Notifications** panel provides a running feed of important events and updates from AiWorks.

### Opening the Notifications Panel

Click the **bell icon** in the toolbar (top right of any page). A panel opens showing your most recent notifications in reverse chronological order.

### Notification Types

Notifications cover a variety of events, including:

- **Research report ready** — A research report has finished generating.

### Managing Notifications

Each notification in the panel has two actions:

- **Mark as read** (checkmark icon) — Marks the notification as read. The unread count on the bell badge decreases.
- **Dismiss** (X icon) — Removes the notification from the list without marking it as read.

After either action, the panel automatically refreshes from the server to reflect the updated notification state.

### Notification Badge

The bell icon in the toolbar shows a badge with the current **unread count**. The badge disappears when there are no unread notifications.

---

## 4. Updating Your User Context

Your **Executive Profile** gives AiWorks context about your background, role, and priorities. \

### Opening Your Executive Profile

1. From any page inside the application, locate the navigation bar at the top.
2. Click the **User** button (person icon, top right of the navigation bar) to open the user menu.
3. Click **My Profile**.
4. The **Executive Profile** panel will open.

### Editing Your Profile

1. In the text area, describe your professional background, current role, and any context that might be relevant to you — \
for example: *"I am the CEO of a Series B SaaS startup with 80 employees. Our core market is enterprise HR software in Europe."*
2. Click **Save Profile**.

Your profile is saved and will be available as an optional input whenever you create a new session.

> **Tip:** The more specific and current your profile, the more personalised the intreactions will be.

### Remembered Context (Memories) ♦ Pro

> **Pro feature:** Remembered Context is available on Pro accounts only.

AiWorks automatically extracts insights about you from your past sessions and stores them as **Remembered Context** entries. These memories complement your manually written profile, giving LLM a richer and more up-to-date picture of your background, priorities, and decision-making style over time.

When memories are present, they are included alongside your written profile whenever you check the **Personal Context** option on a new session. The **Personal Context** checkbox appears as soon as you have either a written profile or at least one memory — you do not need to have written anything manually for the checkbox to appear.

**Viewing and removing memories:**

1. Open **My Profile** (User button → My Profile).
2. If memories exist, a **Remembered Context** section is shown below the profile text area, listing each memory entry.
3. To remove a memory entry, click the trash icon next to it. Removal is immediate and cannot be undone.

Free accounts see the Remembered Context section in their profile as a preview of this Pro feature.

### Light and Dark Mode

AiWorks supports both light and dark themes. To toggle between them:

1. Click the **User** button (person icon, top right of the navigation bar) to open the user menu.
2. Click **Dark Mode** or **Light Mode** to switch themes.

Your preference is saved to your profile and applied automatically on your next visit.

---

## 5. Knowledge Bases ♦ Pro

> **Pro feature** — Knowledge Bases require a Pro account.

**Knowledge Bases** let you build private document libraries that the AI research agent can query during sessions. \
Instead of (or in addition to) searching the internet, the researcher reads your uploaded files and produces a briefing grounded in your own documents.

### What Is a Knowledge Base?

A Knowledge Base is a named collection of files you own. Files you add to a Knowledge Base are private — no other user can access them. \
A single Knowledge Base can contain multiple files, and you can attach one or more Knowledge Bases to any session.

### Managing Knowledge Bases

1. Click the **Menu** button (☰ hamburger icon) in the navigation bar, then click **Knowledge Bases**.
2. The **Knowledge Bases** page lists all your existing KBs, showing the name and number of files in each.

#### Creating a Knowledge Base

1. Click **+ New Knowledge Base**.
2. Enter a name for the KB and press **Enter** or click **Create**.
3. The new KB appears in the list, ready for files to be uploaded.

#### Renaming a Knowledge Base

1. Click the **Edit** (pencil) icon next to the KB name.
2. Type the new name and press **Enter** or click away to save.

#### Deleting a Knowledge Base

1. Click the **Delete** (trash) icon next to the KB.
2. Confirm the deletion. All files inside the KB are permanently removed.

> **Warning:** Deleting a KB also removes all its files. Sessions that previously used the KB are not affected — the research report was already generated at session time.

### Adding Files to a Knowledge Base

1. Click the **expand arrow** on a KB row to reveal its file list.
2. Click **Upload Files** and select one or more files. \
Supported formats: PDF, Word (DOCX, DOC, RTF), Excel (XLSX, XLS, ODS), PowerPoint (PPTX, PPT, ODP), text files (TXT, MD, CSV), and OpenDocument (ODT). Maximum 50 MB per file.
3. The files are processed and added to the KB immediately.

### Removing Files from a Knowledge Base

1. Expand the KB to reveal its file list.
2. Click the **Remove** (×) button next to any file you want to delete.

---

## 6. MCP Servers ♦ Pro

> **Pro feature** — MCP Servers require a Pro account.

**MCP (Model Context Protocol) Servers** allow the AI research agent to call tools hosted on external services during sessions. \
By registering an MCP server, you can extend the agent's capabilities beyond web search and Knowledge Bases — for example, querying internal APIs, databases, or custom tools your organization exposes via MCP.

### What Is an MCP Server?

An MCP server is an external service that exposes a set of callable tools over HTTP, or a REST API described by an OpenAPI specification. \
When you attach an MCP server to a session, the research agent can discover and invoke those tools as part of its research phase, enriching the briefing it prepares for the board.

MCP servers are available in two types:

- **HTTP MCP Server** — connects to a server that implements the MCP protocol over HTTP
- **OpenAPI Server** — connects to any REST API by providing an OpenAPI specification (JSON or YAML); the specification can be provided as a URL or uploaded as a file

### Managing MCP Servers

1. Click the **Menu** button (☰ hamburger icon) in the navigation bar, then click **MCP Servers**.
2. The **MCP Servers** page lists all your registered servers, showing the name and URL of each.

#### Quick-Add Built-In Servers

At the top of the page, a row of **pills** displays any predefined (built-in) MCP servers that your administrator has configured. Clicking a pill opens a lightweight credential form so you can connect that server with minimal setup:

- The server's URL, authentication type, and headers are pre-filled by the admin — you cannot change them.
- You only need to provide your own credentials (bearer token, username/password, or OAuth).
- Once added, the server appears in your server list with a **Built-in** badge.
- A pill turns into a check-mark badge once you have already added that server.

#### Registering a New MCP Server

1. Choose the server type: **HTTP** or **OpenAPI**. Use HTTP for servers that implement the MCP protocol directly. Use OpenAPI to connect any REST API that has an OpenAPI specification.
2. Enter the server **Name** and, for HTTP servers, the **URL**. For OpenAPI servers, also provide the OpenAPI specification — either a URL to the spec (`Spec URL`) or a spec file uploaded from your computer (`Upload Spec`). The uploaded spec takes precedence over the URL if both are provided.
3. If the server requires OAuth authentication, click **Authenticate** to complete the authorization flow:
   - A popup window opens, taking you to the server's authorization page.
   - After you grant access, the popup closes automatically and AiWorks stores the OAuth connection securely for that server. You do not need to paste an access token into the **Headers** field.
4. If the server uses a static bearer token or similar credential, choose the appropriate option from the **Authentication** dropdown and enter the credential there. Use the **Headers** field only for additional custom HTTP headers required by the server.
5. Click **Register**. AiWorks will attempt to connect to the server with the provided credentials before saving. If the connection fails you will see an error — check the URL and credentials and try again.

| Field | Description |
|---|---|
| **Type** | Choose **HTTP** (standard MCP server) or **OpenAPI** (REST API with OpenAPI spec). |
| **Name** | A unique, human-readable name for this server (e.g., *"Internal CRM Tools"*). |
| **URL** | The full HTTP(S) URL of the MCP server endpoint. Only shown for HTTP servers. |
| **Spec URL** | A URL pointing to an OpenAPI specification (JSON or YAML). Only shown for OpenAPI servers. |
| **Upload Spec** | Upload an OpenAPI specification file from your computer. Only shown for OpenAPI servers. Takes precedence over Spec URL if both are provided. |
| **Authenticate** | Starts an OAuth 2.1 / PKCE authorization flow for servers that support OAuth. AiWorks stores the resulting server-side authentication state after you approve access. |
| **Headers** (optional) | A JSON object of additional HTTP headers to include with every request when needed by the server. This is not where bearer tokens are entered. |

#### Editing an MCP Server

1. Click the **Edit** (pencil) icon next to the server you want to update.
2. For manually registered HTTP servers, you can modify the name, URL, headers, and credentials.
3. For OpenAPI servers, you can update the name, authentication, and headers, but the spec URL and uploaded spec are locked — they were set at registration and cannot be changed via editing.
4. For servers added from a built-in template (shown with a **Built-in** badge), only the credentials can be updated — the URL, authentication type, and headers are locked to the template values.
5. Click **Save**. The connection is re-validated before the changes are stored.

#### Deleting an MCP Server

1. Click the **Delete** (trash) icon next to the server.
2. Confirm the deletion. The server is removed from your account and will no longer be available for new sessions.

> **Note:** Deleting an MCP server does not affect sessions that already used it — those sessions have already completed.

### Attaching MCP Servers to a Session

When creating a new session, an **MCP Servers** selector appears below the other options if you have at least one registered server. \
Select one or more servers to make their tools available to the research agent for that session.

> **Tip:** MCP servers can be combined with Knowledge Bases and internet search. The research agent will use all enabled sources together.

---

## 7. Research Report Sessions ♦ Pro

> **Pro feature:** Research Report sessions require a Pro account.

A **Research Report** session assigns a deep research task to the AI agent. A Research Report produces a comprehensive, formatted Markdown report on any topic you specify. The agent uses the internet, your Knowledge Bases, and any connected MCP servers to compile its findings.

### When to Use a Research Report

Use Research Reports when you need:
- A structured briefing on a market, technology, competitor, or regulatory topic.
- Deep background research before presenting to the board.

### Creating a Research Report

1. Click the **Perform an Action** dropdown on the dashboard and select **Research a Topic**, or select **New Research Report** from the **+** dropdown in the navigation bar.
2. You will be taken to the **New Research Report** page.

#### Stage 1 — Define Your Research Topic

1. In the large text area, **describe your research topic or question** as specifically as possible. \
For example: *"What are the key regulatory trends in AI governance across the EU and US in 2025–2026, and what do they mean for a B2B SaaS company building on top of LLMs?"*
2. Configure the optional settings:

   | Option | Description |
   |---|---|
   | **Research Online** | The research agent searches the internet for up-to-date information on your topic. Highly recommended for current-events topics. |
   | **Personal Context** | Includes your Executive Profile so the agent can tailor the report to your background and focus. |
   | **Knowledge Bases** | Attach one or more of your Knowledge Bases. The agent will search your private document libraries as part of its research. |
   | **MCP Servers** | Attach MCP servers to give the agent access to custom tools exposed by your organisation. |
   | **Sessions** | Attach a previous session to provide additional context. The attached session's findings and report are included as a reference in the research. |

3. Optionally, click the **upload** icon (↑) to attach supporting documents that should inform the report. Supported formats are the same as for sessions.
4. Click **Start Research** to submit your topic.

#### Stage 2 — Research in Progress

The research agent runs in the background and may take several minutes to complete.

- A progress screen shows what the agent is currently doing.
- **You do not need to keep the page open.** Close the browser and return later — you will receive an **email notification** when the report is ready.
- To resume, click the **Menu** button (☰) in the navigation bar, click **History**, and select the session (research sessions are marked with a **Research** badge).

### Viewing the Research Report

When the report is complete, you are automatically redirected to the **Research Report** page. You can also navigate here at any time via the **History** panel.

The report is displayed as formatted Markdown with full heading structure, tables, and citations.

### Refining a Research Report

Owners (the session creator) on a Pro account can request a targeted refinement of a completed report. Click the **Refine** button, enter guidance about what to change (for example, "focus on competitor pricing" or "add an executive summary"), and submit. The system saves your notes, re-runs the research agent with the previous report available as context, and generates an updated report. Refinements run as background tasks; you will be guided back through the research workflow to review any scoping questions and can monitor progress from the Research page or History panel.

### Sharing and Exporting the Report

| Action          | Description                                                                                                                       |
|-----------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **Refine**    ♦ | **Pro only.** Request a targeted refinement of the completed report.                                                              |
| **History**   ♦ | **Pro only.** Opens the **Version History** panel to view and restore previous snapshots (see below).                             |
| **Print**     ♦ | **Pro only.** Opens your browser's print dialog with a print-optimised layout.                                                    |
| **Download**  ♦ | **Pro only.** Opens a format picker with three options: **PDF Document** (server-generated PDF), **Word Document (.docx)** (server-generated Word file), and **ZIP Archive** (all agent-produced files bundled together as Markdown). |
| **Share**       | Generates a read-only shareable link. Anyone with the link can view the report without logging in.                                |

### Version History ♦ Pro

> **Pro feature:** Version History requires a Pro account.

AiWorks automatically saves a **version snapshot** each time a Research Report session completes successfully (including after each refinement). Click the **History** button on the report page to open the **Version History** panel.

The panel lists all available snapshots, newest first. Each entry shows the date and time it was captured. Click **Restore** next to any entry to roll the session back to that exact state — report content and all attached files are fully reverted. A confirmation prompt appears before the restore is performed.

> **Note:** Restoring a snapshot is irreversible. Any work done after the snapshot was taken will be lost. Consider refining the current report first if you only want to adjust specific sections.

### Research Report History

Research Report sessions appear in the **Recent Sessions** list on the dashboard and in the **History** panel, marked with a **Research** badge. Clicking a research session from either location opens the full report.

---

## 9. License Tiers

AiWorks offers three tiers:

| Feature | Free | Pro ♦ |
|---|:---:|:---:|
| Research Report sessions | — | 5 / day |
| File uploads (per session) | 1 file | Unlimited |
| Research Online | 1/day | Unlimited |
| Rerun sessions | — | ✓ |
| Generate PDF report | — | ✓ |
| Knowledge Base | — | ✓ |
| MCP Server support | — | ✓ |

Features marked with **♦** in the application require a **Pro** account. Click the **♦** diamond icon on any locked feature to learn more about upgrading.

To upgrade, contact us at [AiWorks@proton.me](mailto:AiWorks@proton.me) 

---

## Frequently Asked Questions

**How do I report a problem or bug?**
Contact the AiWorks support team at AiWorks@proton.me.

---

## Need Help?

If you have any questions, feedback, or want to report a system issue, contact us at [AiWorks@proton.me](mailto:AiWorks@proton.me).

For legal information, see the [License Agreement](eula) and [Privacy Policy](privacy).
