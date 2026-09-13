
# Manual Posting & Scheduling System

## Overview
This feature allows users to manually create, schedule, and publish posts to LinkedIn (with support for future platforms). It integrates with n8n for the actual publishing logic.

## Architecture

1.  **Database**:
    *   `ScheduledPost` model tracks content, media, scheduling time, and status.
    *   Linked to `User` and `SocialAccount`.

2.  **Frontend**:
    *   `/dashboard/accounts`: Lists all connected social accounts.
    *   `/dashboard/accounts/linkedin/[socialAccountId]`: Creation interface for Text, Image, and Video posts.

3.  **Backend API**:
    *   `POST /api/posts`: Creates the post record. Triggers n8n if "Publish Now".
    *   `POST /api/n8n/publish`: Decrypts tokens and invokes the n8n webhook.
    *   `POST /api/posts/update-status`: Callback used by n8n to update success/failure status and LinkedIn URN.

4.  **Automation (n8n)**:
    *   Workflow: `n8n/linkedin-publish-workflow.json`
    *   Handles platform-specific API calls (LinkedIn UGC API).
    *   Manages media upload flows (future expansion for Image/Video).

## Setup Instructions

1.  **Database**:
    Run `npx prisma db push` to create the `scheduled_posts` table.

2.  **Environment Variables**:
    Ensure `.env` has:
    ```env
    N8N_PUBLISH_WEBHOOK_URL="[Your n8n webhook URL]"
    NEXTAUTH_URL="https://socialyncara.vercel.app"
    ```

3.  **n8n Import**:
    Import `n8n/linkedin-publish-workflow.json` into your n8n instance and activate it.

## Extension Guide

To add a new platform (e.g., Twitter):
1.  Update `Prisma` enums (`platform`, `postType` if needed).
2.  Add platform to `app/dashboard/accounts/page.tsx`.
3.  Create `app/dashboard/accounts/twitter/[id]/page.tsx` (or make the existing page dynamic for multiple platforms).
4.  Update n8n workflow to handle `platform == 'TWITTER'`.
