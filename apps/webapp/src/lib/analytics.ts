import {
  Analytics,
  ConsoleDriver,
  DatadogRumDriver,
  type IDriver,
  IngestDriver,
  MultiDriver,
} from "@cognitionai/analytics";
import { datadogRum } from "@datadog/browser-rum";
import { resetClientUuid } from "@/lib/clientUuid";
import { loadDatadogConfig } from "@/lib/datadog";
import { ENV } from "@/modules/config";
import type { ClickIdKey } from "@/modules/conversion-tracking/conversionTracking";
import type { TabOpenSource } from "@/state/sessionTabs";

type AnalyticsContextSchema = {
  orgId: string;
  impersonating: boolean;
  session_id: string;
  webapp_version: string;
  app_env: string;
  enterprise_id: string;
  locale: string;
  timezone: string;
  viewport_width: number;
  viewport_height: number;
  device_type: "mobile" | "tablet" | "desktop";
  referrer: string;
  page_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
} & Partial<Record<ClickIdKey, string>>;

interface LegacyAnalyticsSchema {
  ["DeepWiki:TimeSpent"]: {
    timespentInMilliseconds: number;
    repoName: string;
    pageName: string;
  };
  ["DeepWiki:View"]: {
    repoName: string;
    pageName: string;
  };
  ["SlashCommand:Used"]: {
    command: string;
  };
  ["Enterprise:ModeSwitcher:Click"]: {
    mode: "Agent" | "Ask";
    blocked?: boolean;
  };
  ["Enterprise:Landing:OrgChange"]: {
    orgId: string;
    orgName: string;
  };
  ["Enterprise:Search:ConnectGitHub"]: {
    source: "no-repos" | "indexed-card" | "repos-available";
  };
  ["Enterprise:Search:ManageIntegrations"]: {
    source: "no-repos" | "indexed-card";
  };
  ["Enterprise:Search:ManageGitPermissions"]: {
    source: "no-repos" | "indexed-card";
  };
  ["Enterprise:Search:RefreshRepos"]: Record<string, never>;
  ["Enterprise:Search:DismissCard"]: {
    cardType:
      | "connect-github"
      | "add-unindexed-repos"
      | "contact-admin-for-access";
  };
  ["Enterprise:Search:OpenWiki"]: {
    repoName: string;
    repoId: string;
  };
  ["Enterprise:Search:IndexRepo"]: {
    repoName: string;
    repoId: string;
  };
  // Review module events
  ["Review:HomePage:View"]: {
    source: "direct" | "navigation";
  };
  ["Review:HomePage:OpenPR"]: {
    owner: string;
    repo: string;
    prNumber: number;
    category: string;
  };
  ["Review:HomePage:SubmitURL"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:HomePage:CategorySelect"]: {
    categoryId: string | null;
  };
  ["Review:PRPage:View"]: {
    owner: string;
    repo: string;
    prNumber: number;
    hasJobId: boolean;
  };
  ["Review:PRPage:TimeSpent"]: {
    timespentInMilliseconds: number;
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Job:Launch"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Job:Select"]: {
    owner: string;
    repo: string;
    prNumber: number;
    jobId: string;
  };
  ["Review:Submit"]: {
    owner: string;
    repo: string;
    prNumber: number;
    event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
  };
  ["Review:DiscardReview"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Comment:Add"]: {
    owner: string;
    repo: string;
    prNumber: number;
    isReply: boolean;
    isLineComment: boolean;
  };
  ["Review:Thread:Resolve"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Thread:Unresolve"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Agent:Open"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Agent:Message"]: {
    owner: string;
    repo: string;
    prNumber: number;
    hasMentions: boolean;
  };
  ["Review:Agent:NewChat"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Agent:ApplyEdits"]: {
    owner: string;
    repo: string;
    prNumber: number;
    editCount: number;
    fileCount: number;
    files: string[];
  };
  ["Review:Agent:SwitchSession"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Agent:ClearEdits"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Agent:SuggestedPrompt"]: {
    owner: string;
    repo: string;
    prNumber: number;
    prompt: string;
  };
  ["Review:Agent:Close"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Settings:DiffMode"]: {
    mode: "split" | "unified";
  };
  ["Review:Settings:CommentLocation"]: {
    location: "inline" | "floating" | "hybrid";
  };
  ["Review:Settings:HideCommentBoxes"]: {
    hide: boolean;
  };
  ["Review:CopyBranch"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:OpenGitHub"]: {
    owner: string;
    repo: string;
    prNumber: number;
    target: "pr" | "branch" | "commit" | "file";
  };
  ["Review:EditDescription"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:EditTitle"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:ExpandSection"]: {
    section: string;
  };
  ["Review:ClickCitation"]: {
    owner: string;
    repo: string;
    prNumber: number;
    citationType: "snippet" | "file";
  };
  ["Review:FixWithDevin"]: {
    owner: string;
    repo: string;
    prNumber: number;
    failedChecksCount: number;
  };
  ["Review:Launch:Autofix"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Enable:Autofix"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Bug:View"]: {
    owner: string;
    repo: string;
    prNumber: number;
    bugId: string;
    severity: string;
  };
  ["Review:AddReviewer"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:RemoveReviewer"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:AddAssignee"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:RemoveAssignee"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:AddLabel"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:RemoveLabel"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Sidebar:Toggle"]: {
    collapsed: boolean;
  };
  ["Review:Reaction"]: {
    owner: string;
    repo: string;
    prNumber: number;
    reaction: string;
    action: "add" | "remove";
  };
  // Landing page events (unauthenticated)
  ["Review:Landing:View"]: {
    source: "direct" | "referral" | "utm";
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
  ["Review:Landing:SubmitURL"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Landing:ExampleClick"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Landing:ScrollToFeatures"]: Record<string, never>;
  ["Review:Landing:SignIn"]: Record<string, never>;
  ["Review:Landing:TimeSpent"]: {
    durationMs: number;
  };
  // Bug/Flag GitHub posting events
  ["Review:Bug:PostToGitHub"]: {
    owner: string;
    repo: string;
    prNumber: number;
    bugId: string;
  };
  ["Review:Flag:PostToGitHub"]: {
    owner: string;
    repo: string;
    prNumber: number;
    flagId: string;
  };
  // Search module events
  ["Search:PublicRepos:Selected"]: {
    repoNames: string[];
    count: number;
  };
  ["Search:PublicRepos:TabView"]: Record<string, never>;
  ["Search:Query:WithPublicRepos"]: {
    publicRepoCount: number;
    privateRepoCount: number;
  };
}

// New events must follow the Subject:Verb:Object naming convention.
// The verb MUST describe the outcome/domain action, NOT the UI interaction.
// Good: "Review:Submit:Comment", "Review:Merge:PR", "Search:Select:Repo"
// Bad:  "UserClickedButton", "Review:ClickMerge:PR", "Search:ButtonPressed"
// See AGENTS.md in this directory for full rules.
// Legacy events above may not follow this convention but all new entries must.

interface AnalyticsSchema extends LegacyAnalyticsSchema {
  // Session workspace tab changes and where the tab was opened from.
  ["Session:Change:Tab"]: {
    devinId: string;
    toTab: string;
    fromTab: string | null;
    source: TabOpenSource;
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 1: Landing Page → Signup (unauthenticated user)
  //
  //   Optional (user may skip straight to signup):
  //     - User:Submit:LandingMessage        — submits a prompt on the landing page
  //     - User:Submit:LandingFollowUp       — submits a follow-up message
  //
  //   Signup sequence:
  //     1. User:Initiate:SignUp              — clicks "Sign Up" in the header
  //     2. User:View:SignupPage              — signup page renders (GA redirect, invite code form, or disabled)
  //     3. User:Submit:SignupEmail           — submits invite code + email (invite_code method only)
  //   → continues to Onboarding (Flow 2 or Flow 3)
  // ──────────────────────────────────────────────────────────────────

  // Optional — landing page: first message
  ["User:Submit:LandingMessage"]: {
    promptLength: number;
    repoCount: number;
    hasPublicRepos: boolean;
  };
  // Optional — landing page: follow-up message
  ["User:Submit:LandingFollowUp"]: {
    promptLength: number;
    queryId: string;
  };
  // Step 1 — landing page: click sign-up CTA
  ["User:Initiate:SignUp"]: {
    source: "header";
  };
  // Step 2 — signup page view
  ["User:View:SignupPage"]: {
    method: "ga" | "invite_code" | "disabled";
  };
  // Step 3 — submit invite code (invite_code method only)
  ["User:Submit:SignupEmail"]: {
    method: "invite_code";
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 1.5: Attribution Survey (pre-git-onboarding)
  //
  //   Fires before the user reaches git connection. Measures drop-off
  //   at the attribution step and captures which source the user chose.
  //     1. User:View:AttributionSurvey       — survey rendered
  //     2. User:View:AttributionSurveyOther  — "Other" expanded (free-text input shown)
  //     3. User:Complete:AttributionSurvey   — answer submitted
  // ──────────────────────────────────────────────────────────────────

  ["User:View:AttributionSurvey"]: Record<string, never>;
  ["User:View:AttributionSurveyOther"]: Record<string, never>;
  ["User:Complete:AttributionSurvey"]: {
    sources: string[];
    method: "pill" | "other" | "skip" | "windsurf";
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 2: Onboarding — Devin (authenticated user, devin product)
  //
  //   View events fire on each step render (stepId values below):
  //     "devin_connect_git" → "devin_create_org" → "devin_integrations" → "devin_done"
  //
  //   Completion events fire when the user finishes each step:
  //     1. User:View:OnboardingStep         — each step viewed (funnel drop-off)
  //     2a. User:Initiate:OnboardingGitConnect — clicks a git provider button (intent)
  //     2b. User:Complete:OnboardingGitConnect — git provider connected (async, useEffect)
  //     3a. User:Select:OnboardingPayment     — selects a plan (click)
  //     3b. User:Complete:OnboardingPayment   — payment confirmed / plan activated (async, useEffect)
  //     4. User:Complete:OnboardingIntegrations — (local users only) continues past integrations
  //     5. User:Complete:OnboardingStartSessions — launches first sessions or skips
  //   → user lands on Home
  // ──────────────────────────────────────────────────────────────────

  // Step 1 — view each onboarding step (shared with Wiki flow)
  ["User:View:OnboardingStep"]: {
    stepId: string;
    flow: "devin" | "wiki";
  };
  // Step 2a — click on a git provider button (intent, before OAuth redirect)
  ["User:Initiate:OnboardingGitConnect"]: {
    provider: "github_app" | "github_pat" | "gitlab" | "bitbucket";
  };
  // Step 2b — git provider connected (async, detected via useEffect)
  ["User:Complete:OnboardingGitConnect"]: {
    provider: "github_app" | "github_pat" | "gitlab" | "bitbucket";
  };
  // Step 3a — select a payment plan (click)
  ["User:Select:OnboardingPayment"]: {
    planId: string;
  };
  // Step 3b — payment plan confirmed
  ["User:Complete:OnboardingPayment"]: {
    planId: string;
  };
  // Step 4 — integrations step completed (local users only)
  ["User:Complete:OnboardingIntegrations"]: Record<string, never>;
  // Step 5 — start sessions or skip
  ["User:Complete:OnboardingStartSessions"]: {
    taskCount: number;
    skipped: boolean;
    repoName: string | null;
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 3: Onboarding — Wiki (authenticated user, wiki product)
  //
  //   View events fire on each step render (stepId values):
  //     "devin_connect_git" → "wiki_repo_select"
  //
  //   Completion events:
  //     1. User:View:OnboardingStep              — each step viewed (funnel drop-off)
  //     2a. User:Initiate:OnboardingWikiGitConnect — clicks a git provider button (intent)
  //     2b. User:Complete:OnboardingWikiGitConnect — git provider connected (async, useEffect)
  //     3. User:Complete:OnboardingWikiRepoSelect — selects repos to index (or skips)
  //   → user lands on Wiki
  // ──────────────────────────────────────────────────────────────────

  // Step 2a — click on a git provider button (intent, before OAuth redirect)
  ["User:Initiate:OnboardingWikiGitConnect"]: {
    provider: "github_app" | "github_pat" | "gitlab";
  };
  // Step 2b — git provider connected (async, detected via useEffect)
  ["User:Complete:OnboardingWikiGitConnect"]: {
    provider: "github_app" | "github_pat" | "gitlab";
  };
  // Step 3 — select repos to index
  ["User:Complete:OnboardingWikiRepoSelect"]: {
    repoCount: number;
    skipped: boolean;
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 3.5: Onboarding Tour (post-signup product walkthrough)
  //
  //   The product tour shown via OnboardingGuard / OnboardingStepper after
  //   a user finishes the git/org onboarding. Steps are defined in
  //   modules/onboarding/useOnboardingFlow.tsx (ONBOARDING_STEPS).
  //
  //   Funnel:
  //     1. User:View:OnboardingTourStep      — fires once on mount for step 0
  //        only, as the funnel entry point ("user saw the tour at all").
  //     2. User:Complete:OnboardingTourStep  — fires when the user explicitly
  //        advances past a step via Continue / Enter / ArrowRight. Drop-off
  //        at step N = complete(N-1) − complete(N); drop-off at step 0 is
  //        view(0) − complete(0).
  //     3. User:Complete:OnboardingTour      — terminal event, fires when
  //        the user finishes the last step. Distinguishes "abandoned on the
  //        last step" from "actually finished the tour".
  // ──────────────────────────────────────────────────────────────────

  // Funnel entry. Fires exactly once per mount for step 0 only.
  ["User:View:OnboardingTourStep"]: {
    stepSlug: string;
    stepIndex: number;
    totalSteps: number;
  };
  // User clicked "Continue" past a step (or pressed Enter / ArrowRight).
  // Deduped per mount by stepIndex so back → forward doesn't double-count.
  ["User:Complete:OnboardingTourStep"]: {
    stepSlug: string;
    stepIndex: number;
    totalSteps: number;
  };
  // User finished the entire tour (advanced past the last step).
  ["User:Complete:OnboardingTour"]: {
    lastStepSlug: string;
    totalSteps: number;
  };

  // PLG onboarding funnel (`?from=plg`) events. Keyed by stable stepSlug;
  // `funnelSteps` snapshots the resolved sequence so metrics survive
  // reordering and workflow/connection gating.

  // Step rendered. Deduped per (org, user) across sessions.
  ["User:View:PlgOnboardingStep"]: {
    stepSlug: string;
    stepIndex: number;
    totalSteps: number;
    funnelSteps: string[];
  };
  // User advanced past a step. Deduped per (org, user) by slug.
  ["User:Complete:PlgOnboardingStep"]: {
    stepSlug: string;
    method: "continue" | "skip";
    stepIndex: number;
    totalSteps: number;
    funnelSteps: string[];
  };
  // User left the page mid-funnel (pagehide before finishing).
  ["User:Exit:PlgOnboardingFunnel"]: {
    lastViewedStepSlug: string;
    funnelSteps: string[];
  };
  // Workflows chosen on the plg_choose_workflows step.
  ["User:Select:PlgOnboardingWorkflows"]: {
    workflows: string[];
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 4: Select Org
  //
  //   User picks which GitHub org to use with Devin.
  //   Can appear post-signup or when switching/adding orgs.
  //   Rendered as a screen takeover (SelectOrgScreen) on the originating
  //   page, or as a settings subpage at /settings/select-org.
  //
  //   1. User:View:SelectOrg                — content rendered
  //   Actions (mutually exclusive per interaction):
  //     - User:Initiate:InstallGitHub        — clicks "Install Devin" (personal or org)
  //     - User:Initiate:JoinOrg              — clicks "Join team" / "Request to join"
  //     - User:Initiate:ConnectAnotherOrg    — clicks "Connect another GitHub organization"
  //     - User:Initiate:CreateOrgFromInstallation — clicks "Create team" on unlinked installation
  //     - User:Complete:GhCliAuth            — GH CLI auth completed (async, useEffect)
  //   → redirects to GitHub OAuth or org dashboard
  // ──────────────────────────────────────────────────────────────────

  // Page view
  ["User:View:SelectOrg"]: {
    orgCount?: number;
    hasPersonalInstallation?: boolean;
    unlinkedInstallationCount: number;
    joinableOrgCount: number;
    from_desktop: string | null;
  };
  // Auto-redirect — new user with no orgs/installations, skip org selection
  ["User:Redirect:ConnectGithubOrg"]: {
    from_desktop: string | null;
  };
  // Action — click "Install Devin" on a personal or org row
  ["User:Initiate:InstallGitHub"]: {
    target: "personal" | "org";
    orgName: string | null;
  };
  // Action — click "Join team" / "Request to join"
  ["User:Initiate:JoinOrg"]: {
    orgName: string;
    autoJoin: boolean;
    from_desktop: string | null;
  };
  // Action — click "Connect another GitHub organization"
  ["User:Initiate:ConnectAnotherOrg"]: {
    from_desktop: string | null;
  };
  // Action — click "Create team" on an unlinked GitHub installation
  ["User:Initiate:CreateOrgFromInstallation"]: {
    orgName: string;
    installationId: number;
    from_desktop: string | null;
  };
  // Action — GH CLI auth completed successfully
  ["User:Complete:GhCliAuth"]: {
    username: string | undefined;
    from_desktop: string | null;
  };

  // ──────────────────────────────────────────────────────────────────
  // Standalone events (not part of a sequential flow)
  // ──────────────────────────────────────────────────────────────────

  // Session creation — source indicates where it was triggered
  ["User:Create:Session"]: {
    source: "home" | "onboarding" | "omni" | "command-palette";
    mode: "agent" | "ask";
  };

  // PR merge via the Devin UI
  ["User:MergeViaDevinUI:PR"]: {
    owner: string;
    repo: string;
    prNumber: number;
    mergeMethod: string;
  };

  // ──────────────────────────────────────────────────────────────────
  // Global / Navigation (fires on every route change)
  // ──────────────────────────────────────────────────────────────────

  ["User:Navigate:Page"]: {
    path: string;
    title: string;
    referrer: string;
  };

  // Voice recording
  ["Voice:Complete:Recording"]: {
    source: "chat" | "search" | "omni";
    durationSeconds: number;
    success: boolean;
    textLength: number | null;
  };

  // Repo indexing from the Repositories page
  ["User:Index:Repo"]: {
    repoName: string;
    branchCount: number;
  };

  // Replay Session Demo Events

  ["Replay:Advance:Checkpoint"]: {
    replaySessionId: string;
    checkpointIndex: number;
    totalCheckpoints: number;
    trigger: "manual" | "auto";
  };
  ["Replay:Complete:Session"]: {
    replaySessionId: string;
    checkpointsReached: number;
    totalCheckpoints: number;
  };
  ["Replay:Restart:Session"]: {
    replaySessionId: string;
  };

  ["Marketing:Send:GoogleAdsConversion"]: {
    conversionType:
      | "signup"
      | "pay_as_you_go"
      | "pro"
      | "max"
      | "teams"
      | "demo_request";
    conversionLabel: string;
    hasTransactionId: boolean;
  };

  // ──────────────────────────────────────────────────────────────────
  // Notifications
  //
  //   Tracks in-app toast notifications (Devin needs your attention).
  //
  //   1. Notification:Show:Toast           — toast rendered on screen
  //   2. Notification:Open:Session         — user clicked toast to navigate to session
  // ──────────────────────────────────────────────────────────────────

  // Toast notification shown to the user
  ["Notification:Show:Toast"]: {
    devinId: string;
    sessionTitle: string;
  };
  // User clicked the toast to navigate to the session
  ["Notification:Open:Session"]: {
    devinId: string;
    sessionTitle: string;
  };

  // ──────────────────────────────────────────────────────────────────
  // Test Recording Viewer
  //
  //   Tracks usage of the test recording viewer embedded in session
  //   chat. Recordings are videos of Devin testing UI changes, with
  //   structured annotations (setup, test_start, assertion).
  //
  //   1. TestRecording:Open:Viewer           — user expands to full viewer
  //   2. TestRecording:Close:Viewer          — user closes the viewer
  //   3. TestRecording:Play:Video            — video starts playing
  //   4. TestRecording:Seek:Annotation       — user clicks an annotation row
  //   5. TestRecording:Change:PlaybackRate   — user changes speed
  //   6. TestRecording:Loop:Chapter          — user loops a test chapter
  //   7. TestRecording:Download:Video        — user downloads the recording
  // ──────────────────────────────────────────────────────────────────

  // User expands to full viewer
  ["TestRecording:Open:Viewer"]: {
    annotationsAttachmentUuid: string;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
  };
  // User closes the viewer
  ["TestRecording:Close:Viewer"]: {
    annotationsAttachmentUuid: string;
    durationViewedMs: number;
  };
  // Video starts playing
  ["TestRecording:Play:Video"]: {
    annotationsAttachmentUuid: string;
  };
  // User clicks an annotation in the sidebar
  ["TestRecording:Seek:Annotation"]: {
    annotationsAttachmentUuid: string;
    annotationType: string;
    testResult: string | undefined;
  };
  // User changes playback speed
  ["TestRecording:Change:PlaybackRate"]: {
    annotationsAttachmentUuid: string;
    rate: number;
  };
  // User loops a test chapter
  ["TestRecording:Loop:Chapter"]: {
    annotationsAttachmentUuid: string;
  };
  // User downloads the recording video
  ["TestRecording:Download:Video"]: {
    annotationsAttachmentUuid: string;
  };

  // User selects an MCP shortcut from the composer "+" Actions submenu,
  // inserting its prompt template into the input.
  ["Composer:Insert:MCPShortcut"]: {
    serverSlug: string;
    shortcutId: string;
    shortcutLabel: string;
  };

  // Slack "Post and follow" link flow: Submit (confirmed), Succeed (succeeded),
  // Fail (errored). No channel names/ids are sent, only the target kind.
  ["Composer:Submit:SlackLink"]: {
    devinId: string;
    target: "channel" | "dm";
  };
  ["Composer:Succeed:SlackLink"]: {
    devinId: string;
    target: "channel" | "dm";
  };
  ["Composer:Fail:SlackLink"]: {
    devinId: string;
    target: "channel" | "dm";
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 5: Windsurf / Desktop → Devin Handoff
  //
  //   Tracks users arriving from a desktop IDE (e.g. Windsurf) via
  //   ?from_windsurf=<variant>, completing git onboarding, and
  //   returning to the IDE via deep link.
  //
  //   1. User:View:ArrivedFromDesktop      — user lands with from_windsurf param
  //   2. User:Initiate:ConnectGitProvider   — clicks GitHub/GitLab/Bitbucket button
  //   3. User:Initiate:SkipGitConnection    — clicks "I'll do it later"
  //   4. User:Initiate:ReturnToDesktop      — deep link opens to return to IDE
  // ──────────────────────────────────────────────────────────────────

  // User arrived from a desktop IDE (fires immediately on mount, decoupled
  // from async git-onboarding state so the timestamp is accurate).
  ["User:View:ArrivedFromDesktop"]: {
    from_desktop: string;
  };
  // User clicked a git provider connect button
  ["User:Initiate:ConnectGitProvider"]: {
    provider: "github" | "gitlab" | "bitbucket";
    from_desktop: string | null;
  };
  // User clicked skip / "I'll do it later"
  ["User:Initiate:SkipGitConnection"]: {
    from_desktop: string | null;
  };
  // Deep link opened to return user to desktop IDE
  ["User:Initiate:ReturnToDesktop"]: {
    from_desktop: string | null;
    trigger: string;
  };

  // ──────────────────────────────────────────────────────────────────
  // FLOW 6: CLI Trial Upsell (browser auth flow)
  //
  //   During CLI browser-based login, eligible free-plan users see a
  //   trial prompt offering a 14-day pro trial before redirecting back
  //   to the CLI.
  //
  //   1. CLI:View:TrialPrompt               — trial prompt rendered
  //   2. CLI:Initiate:StartTrial            — user starts checkout
  //   3. CLI:Dismiss:TrialPrompt            — user skips the trial
  // ──────────────────────────────────────────────────────────────────

  // Trial prompt rendered to the user
  ["CLI:View:TrialPrompt"]: Record<string, never>;
  // User initiated the trial checkout flow
  ["CLI:Initiate:StartTrial"]: Record<string, never>;
  // User dismissed the trial prompt
  ["CLI:Dismiss:TrialPrompt"]: Record<string, never>;

  // ──────────────────────────────────────────────────────────────────
  // FLOW 7: Contact Support
  //
  //   User navigates to the support page from the help popover.
  //
  //   1. Support:Open:Page        — support page opened from help popover
  //
  //   Legacy (pre-Decagon) events, kept for historical telemetry:
  //   - Support:Open:Dialog       — dialog rendered
  //   - Support:Submit:Ticket     — ticket submitted successfully
  // ──────────────────────────────────────────────────────────────────

  ["Support:Open:Page"]: Record<string, never>;
  ["Support:Open:Dialog"]: Record<string, never>;
  ["Support:Submit:Ticket"]: {
    issueId: string;
    attachmentCount: number;
  };

  // ──────────────────────────────────────────────────────────────────
  // Automations
  //
  //   Fires once when an automation is successfully created, capturing
  //   which entry point the user came through so we can measure
  //   natural-language vs manual vs template adoption.
  // ──────────────────────────────────────────────────────────────────

  ["Automation:Create:Automation"]: {
    method:
      | "natural_language"
      | "manual"
      | "template"
      | "channel_devin"
      | "duplicate";
  };

  ["Swe17PreviewBanner:Select:Agent"]: Record<string, never>;
  ["Swe17PreviewBanner:Dismiss:Banner"]: Record<string, never>;

  ["AgentPicker:Select:Option"]: {
    optionId: string;
    optionType: "persona" | "agent";
    previousOptionId: string | null;
    previousOptionType: "persona" | "agent" | null;
  };

  // ──────────────────────────────────────────────────────────────────
  // Code Scans
  //
  //   Tracks user interactions with the code scanning feature:
  //   page views, scan lifecycle, finding actions, and profile CRUD.
  // ──────────────────────────────────────────────────────────────────

  ["CodeScan:Start:Scan"]: {
    repoName: string;
    hasProfile: boolean;
    interactive: boolean;
    hasSchedule: boolean;
  };
  ["CodeScan:Start:IngestScan"]: {
    repoName: string;
    hasSchedule: boolean;
  };
  ["CodeScan:Start:BulkScan"]: {
    count: number;
    hasProfile: boolean;
    hasFilter: boolean;
  };
  ["CodeScan:Archive:Scan"]: {
    scanId: string;
    repoName: string;
  };
  ["CodeScan:Unarchive:Scan"]: {
    scanId: string;
    repoName: string;
  };
  ["CodeScan:Create:AutoScan"]: {
    scanId: string;
    repoName: string;
    rrule: string;
  };
  ["CodeScan:Export:Findings"]: {
    scanId: string;
    repoName: string;
  };
  ["CodeScan:Recover:Scan"]: {
    scanId: string;
  };
  ["CodeScan:Remediate:Finding"]: {
    scanId: string;
    findingId: string;
    severity: string;
  };
  ["CodeScan:Adjust:Finding"]: {
    scanId: string;
    findingId: string;
    hasFeedback: boolean;
    hasSeverityChange: boolean;
  };
  ["CodeScan:Update:FindingStatus"]: {
    scanId: string;
    findingId: string;
    newStatus: string;
  };
  ["CodeScan:Create:Profile"]: {
    name: string;
    scanType: string;
  };
  ["CodeScan:Update:Profile"]: {
    profileId: string;
  };
  ["CodeScan:Delete:Profile"]: {
    profileId: string;
  };
  ["CodeScan:Delete:FindingAutomation"]: {
    automationId: string;
  };

  ["Promo:View:SettingsPage"]: {
    referrerUserId: string;
    referrerOrgId: string;
    programSlug: string;
  };
  ["Promo:Send:EmailInvite"]: {
    referrerUserId: string;
    referrerOrgId: string;
    inviteeEmailDomain: string;
    programSlug: string;
  };

  // ──────────────────────────────────────────────────────────────────
  // Review copy actions
  //
  //   Fires when a user copies content from the Devin Review UI: bug,
  //   flag, and security finding text, the "Prompt for agents" suggested
  //   edit, bulk/single "copy" in the findings section, permalinks, the
  //   PR branch name, the PR/review links, commit SHAs, file paths, and
  //   the Devin Review CLI command.
  // ──────────────────────────────────────────────────────────────────

  ["Review:Copy:PromptForAgents"]: {
    owner: string;
    repo: string;
    prNumber: number;
    bugId: string;
  };
  ["Review:Copy:Bug"]: {
    owner: string;
    repo: string;
    prNumber: number;
    bugId: string;
  };
  ["Review:Copy:Flag"]: {
    owner: string;
    repo: string;
    prNumber: number;
    flagId: string;
  };
  ["Review:Copy:SecurityFinding"]: {
    owner: string;
    repo: string;
    prNumber: number;
    findingId: string;
  };
  ["Review:Copy:Finding"]: {
    owner: string;
    repo: string;
    prNumber: number;
    findingType: "bug" | "flag" | "security";
    findingId: string;
  };
  ["Review:Copy:AllFindings"]: {
    owner: string;
    repo: string;
    prNumber: number;
    findingType: "bug" | "flag" | "security";
  };
  ["Review:Copy:Permalink"]: {
    permalinkType:
      | "review"
      | "thread"
      | "comment"
      | "bug"
      | "analysis"
      | "security";
    id: string;
  };
  ["Review:Copy:Branch"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Copy:PRLink"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Copy:ReviewLink"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };
  ["Review:Copy:CommitSha"]: {
    owner: string;
    repo: string;
    prNumber: number;
    sha: string;
  };
  ["Review:Copy:FilePath"]: {
    owner: string;
    repo: string;
    prNumber: number;
    filePath: string;
  };
  ["Review:Copy:Command"]: {
    owner: string;
    repo: string;
    prNumber: number;
  };

  // ──────────────────────────────────────────────────────────────────
  // Command Palette
  //
  //   Tracks usage of the command palette (Cmd+K) including opens,
  //   command selection, and session starts.
  //
  //   1. CommandPalette:Open:Palette        — user opened the palette
  //   2. CommandPalette:Select:Command       — user selected a command
  //   3. CommandPalette:Select:Session        — user opened a session result
  //   4. CommandPalette:Start:Session        — user started a session
  // ──────────────────────────────────────────────────────────────────

  ["CommandPalette:Open:Palette"]: Record<string, never>;
  ["CommandPalette:Select:Command"]: {
    commandId: string;
    section: string;
  };
  ["CommandPalette:Select:Session"]: {
    devinId: string;
  };
  ["CommandPalette:Start:Session"]: {
    promptLength: number;
    background: boolean;
  };

  // ──────────────────────────────────────────────────────────────────
  // AI guardrails
  //
  //   User rates whether a guardrail flag on their message was correct.
  //   Carries no message content — only the flagged event's id, the
  //   guardrail that fired, and what it did.
  // ──────────────────────────────────────────────────────────────────

  ["Guardrail:Rate:Flag"]: {
    devinId: string | null;
    eventId: string;
    guardrailId: string;
    action: "warn" | "block";
    feedback: "positive" | "negative";
  };
}

const consoleDriver = new ConsoleDriver(
  // suppress console output in production environments
  ["production", "beta", "staging"].includes(ENV)
);

const ingestDriver = new IngestDriver({
  resetClientUuid,
  storageKey: `__ingest_driver_queue_${window.location.hostname}`,
});

const drivers: IDriver[] = [consoleDriver, ingestDriver];

// Forward analytics events to Datadog RUM when RUM is configured.
const datadogConfig = loadDatadogConfig();
if (datadogConfig) {
  drivers.push(new DatadogRumDriver({ instance: datadogRum }));
}

const multiDriver = new MultiDriver(drivers);
const analytics = new Analytics<AnalyticsSchema, AnalyticsContextSchema>(
  multiDriver
);

// Flush analytics on page unload and visibility change
if (typeof window !== "undefined") {
  // Flush when tab becomes hidden (user switches tabs, minimizes)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      analytics.flush();
    }
  });

  // Flush on page unload (navigation, close, refresh)
  // pagehide is more reliable than beforeunload on mobile
  window.addEventListener("pagehide", () => {
    analytics.flush();
  });

  // beforeunload as fallback for older browsers
  window.addEventListener("beforeunload", () => {
    analytics.flush();
  });
}

export { analytics };
