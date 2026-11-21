# CGP TODO

Requirements roadmap reviewed against the original product brief, version 1, and the local CGP application on 2026-11-21. This lists remaining work; it does not describe features as already available or set release dates. Existing architecture and security boundaries remain as documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Starting point

Accounts, username-or-email sign-in, persistent sessions, basic public profiles, account settings, player search, private text chat, unread counts, blocking, message reports, basic moderation, shared styling, and English/Polish localization already work locally. Extend these capabilities rather than rebuilding them. The Guide contains illustrative examples; its teams, recruitment, tournaments, standings, results, and veto are not live records. Home content remains empty until its scope is agreed.

Registration continues to require username, private email, password, and confirmation. Administrator access remains assignable only through manual database interaction. The early brief's alternative account model and implementation suggestions do not replace these current requirements.

An initial Cloudflare deployment was completed on 2026-11-21 and passed representative hosted checks; see [deployment status](DEPLOYMENT.md). The release branch below also tracks remaining operational acceptance work, including sustained capacity, monitoring, and recovery with representative data.

## Reading the tree

- `[ ]` means outstanding work. Mark a task complete only when its own outcome and validation are complete.
- `[x]` means the stated task is complete; its dependent tasks can still be outstanding.
- Group labels use `/`. A task indented beneath another task depends on that parent task being complete. Children are follow-on work, not a claim that their parent already implements them.
- `requires: ID` records an additional dependency in another branch. Siblings can proceed independently unless a dependency says otherwise. IDs remain stable when tasks move.
- `[Brief]` identifies requirements from the original brief. `[CGP]` identifies follow-up work from current CGP scope. `[Proposal]` identifies a suggested addition to review. Tasks beginning with `Decide` leave that product choice open.
- Source sections identify requirement provenance without adding the source document or its local filesystem location to the repository. Technology choices from that document are outside this roadmap.

## Task tree

```text
CGP/
|-- Initial release of the current application/ [CGP]
|   `-- [x] REL-01 Record the approved release scope and exact revision: CGP 0.1.0, commit 3d8baf2; use DEPLOYMENT.md for release requirements.
|       |-- [x] REL-02 Prepare the approved hosted environment, origin, private configuration, and service bindings.
|       |   |-- [x] REL-03 Rehearse fresh migrations and an upgrade with existing messages, sessions, and read positions; fresh hosted migrations and local existing-data upgrade checks passed.
|       |   |   `-- [ ] REL-04 Verify backup restoration and document application/data rollback and migration recovery.
|       |   |-- [ ] REL-05 Check hosted account, search, chat, report, and moderation flows using separate test accounts.
|       |   |   |-- [ ] REL-06 Verify real HTTPS cookies, origin/CSRF enforcement, asset headers, and failure behavior.
|       |   |   `-- [ ] REL-07 Measure actual request, read/write, storage, and hashing usage against expected traffic and allowances.
|       |   `-- [ ] REL-08 Establish service-health checks and useful error reporting that exclude credentials and private messages.
|       |-- [ ] REL-09 Review staged files, public documentation, templates, and release evidence for private information.
|       |-- [ ] REL-10 Run dependency checks and Codex Security on the release revision; fix and review validated findings.
|       `-- [ ] REL-11 Close the full operational release checklist and repeat post-release checks; the initial deployment and smoke checks are complete. (requires: REL-04, REL-06, REL-07, REL-08, REL-09, REL-10)
|           `-- [ ] REL-12 Collect feedback from initial players and prioritize confirmed usability and reliability issues.
|
|-- Gaming profiles and FACEIT identity/ [Brief sections 3, 8, 11]
|   `-- [ ] PROF-01 Decide which gaming fields are public, self-declared, or provider-verified; define editing and privacy rules.
|       |-- [ ] PROF-02 Add CS2 role (entry, support, AWPer, IGL, or flex), availability, spoken languages, and level fields to profile editing and public display.
|       |   `-- [ ] PROF-03 Distinguish declared and verified information, and keep spoken language separate from interface language.
|       `-- [ ] ID-01 Define how players prove ownership of a FACEIT account and how linking, unlinking, and relinking work.
|           `-- [ ] ID-02 Link an immutable FACEIT player ID to a CGP account; do not identify a player by nickname alone.
|               |-- [ ] ID-03 Prevent the same external identity from being attached to multiple active CGP accounts.
|               |-- [ ] ID-04 Display and refresh permitted nickname/level data, including stale or unavailable-data states.
|               `-- [ ] ID-05 Record identity changes and prevent relinking from rewriting historical tournament lineups.
|
|-- Teams, invitations, and rosters/ [Brief sections 4, 11]
|   `-- [ ] TEAM-01 Decide team name/tag rules, membership limits, and starter/substitute rules; the brief suggests five starters and up to two substitutes.
|       `-- [ ] TEAM-02 Create persistent teams with immutable IDs, name, tag, and a generated logo; make the founder captain.
|           |-- [ ] TEAM-03 Add public team pages showing the captain and current roster.
|           |   |-- [ ] PROF-04 Link current team memberships from public player profiles.
|           |   `-- [ ] TEAM-04 Add paginated real-team search and connect the Teams category in general search.
|           |-- [ ] TEAM-05 Enforce captain/member permissions and captain-only team settings on the server.
|           |   |-- [ ] INV-01 Decide invitation expiry, usage limits, and whether joining requires captain approval.
|           |   |   `-- [ ] INV-02 Let captains create invitation codes/links, revoke them, and replace them so old invitations stop working.
|           |   |       `-- [ ] INV-03 Accept invitations safely, with atomic capacity checks and clear expired, revoked, full, and already-member outcomes.
|           |   |           `-- [ ] ROSTER-01 Manage starters, substitutes, open/closed recruitment, and available roster places.
|           |   |               |-- [ ] ROSTER-02 Support leaving, removal, and captain transfer without leaving an ownerless team.
|           |   |               `-- [ ] ROSTER-03 Prevent roster edits, departures, and team closure from bypassing active tournament eligibility rules. (requires: TOUR-06)
|           |   `-- [ ] TEAM-06 Add team archival/closure rules and retain historical names, participants, and results where needed. (requires: ROSTER-02, TOUR-06)
|           |-- [ ] TEAM-07 Display team tournament history and confirmed results. (requires: RESULT-02)
|           |   `-- [ ] PROF-05 Display player participation and tournament history from the recorded lineups, including past teams.
|           `-- [ ] TEAM-08 Decide whether custom team-logo uploads are needed; if approved, define content, size, privacy, and moderation rules. [Proposal]
|
|-- Recruitment listings/ [Brief section 5]
|   `-- [ ] LFG-01 Decide listing fields, visibility, expiry, renewal limits, and edit/close rules; the brief suggests seven-day expiry.
|       |-- [ ] LFG-02 Publish player-looking-for-team listings with CS2, level, role, availability, spoken language, and a short description. (requires: PROF-02)
|       |-- [ ] LFG-03 Publish team-looking-for-player listings under captain authority, with role and roster requirements. (requires: TEAM-05, ROSTER-01)
|       `-- [ ] LFG-04 Provide a paginated listings board with role, level, availability, and language filters, sorting, and useful empty states. (requires: LFG-02, LFG-03)
|           |-- [ ] LFG-05 Let owners edit, renew, and close listings; hide expired, closed, and banned-owner listings from discovery.
|           |-- [ ] LFG-06 Open the existing private conversation from a listing, respecting bans and bilateral blocks.
|           |-- [ ] LFG-07 Link listings to their public player/team profiles and keep contact targets correct after name changes.
|           `-- [ ] LFG-08 Add listing abuse reports, spam controls, and bounded moderator review with action reasons. [Proposal]
|
|-- Tournaments and registration/ [Brief section 7]
|   `-- [ ] TOUR-01 Decide event eligibility, roster locks, substitutes, deadlines, late withdrawals, and no-show/walkover rules.
|       `-- [ ] TOUR-02 Let authorized administrators create/edit events with name, game, start time, capacity, BO1/BO3 format, map pool, and rules.
|           |-- [ ] TOUR-03 Publish event lists/details with open, in-progress, and completed states, registered teams, and remaining places.
|           |   `-- [ ] TOUR-04 Add bounded tournament search and connect the Tournaments category in general search.
|           |-- [ ] TOUR-05 Let captains register a team; validate roster completeness and applicable identity requirements. (requires: TEAM-05, ROSTER-01, ID-03)
|           |   `-- [ ] TOUR-06 Atomically reserve places and snapshot eligible lineups; prevent one player representing two teams in the same tournament.
|           |       |-- [ ] TOUR-07 Support permitted withdrawals and roster changes before the cutoff without corrupting capacity or history.
|           |       `-- [ ] TOUR-08 Close registration manually or at its deadline and freeze the accepted entrants for bracket generation.
|           `-- [ ] TOUR-09 Add cancellation/rescheduling rules, player-facing notices, and audited administrator actions. [Proposal]
|
|-- Brackets and match pages/ [Brief section 7]
|   `-- [ ] BRACKET-01 Generate single-elimination pairings from closed registrations; retain the draw and handle byes. (requires: TOUR-08)
|       |-- [ ] BRACKET-02 Prevent duplicate draws and protect a started bracket from accidental regeneration.
|       |-- [ ] BRACKET-03 Persist rounds, match IDs, participants, downstream slots, and scheduled/ready/awaiting-result/completed/disputed states.
|       |   |-- [ ] MATCH-01 Add match pages showing participants, lineup snapshots, schedule, format, maps, status, and result provenance.
|       |   |   `-- [ ] MATCH-02 Let the permitted participants coordinate scheduling and see administrative decisions; apply the no-show rules. (requires: TOUR-01)
|       |   `-- [ ] BRACKET-04 Display the live bracket accessibly on desktop and mobile, including byes, disputes, and the champion.
|       `-- [ ] BRACKET-05 Add match administration for walkovers, cancellations, and corrections with required reasons. (requires: RESULT-03)
|
|-- Confirmed results and FACEIT imports/ [Brief sections 8, 11]
|   `-- [ ] RESULT-01 Define canonical BO1/BO3 results, draws/invalid scores, lineup matching, and whether a series requires one or several external references. (requires: BRACKET-03)
|       `-- [ ] RESULT-02 Save a confirmed result and advance the correct winner exactly once, atomically, while retaining its source and lineup snapshot.
|           |-- [ ] RESULT-03 Provide audited administrator manual entry/correction for provider outages and matches played elsewhere.
|           |   `-- [ ] RESULT-04 Define safe correction/reversal behavior after later rounds have started; preserve a visible decision history.
|           |-- [ ] FACEIT-01 Accept supported match-room links, extract the stable match ID, and retrieve results only from the trusted provider service.
|           |   |-- [ ] FACEIT-02 Keep integration credentials private and bound requests, response sizes, retries, caching, and refresh frequency.
|           |   `-- [ ] FACEIT-03 Normalize completed match/series scores, map results, game, participants, and winner from provider data.
|           |       `-- [ ] FACEIT-04 Verify the game, completion status, and both registered lineup snapshots by immutable player ID. (requires: FACEIT-02, ID-05, TOUR-06)
|           |           |-- [ ] FACEIT-05 Reject unrelated matches, unfinished matches, duplicate references, replayed imports, and invalid BO1/BO3 mappings.
|           |           `-- [ ] FACEIT-06 Let eligible captains submit a verified reference and use the canonical result/advancement workflow once. (requires: FACEIT-05)
|           |               `-- [ ] FACEIT-07 Show actionable invalid-link, still-playing, provider-unavailable, rate-limit, mismatch, and already-imported states.
|           `-- [ ] DISPUTE-01 Route lineup/result conflicts into a bounded administrator review queue and pause affected advancement.
|               `-- [ ] DISPUTE-02 Resolve disputes with a reason, notify affected participants, and log approved corrections. (requires: RESULT-04)
|
|-- Live map veto/ [CGP; builds on Guide previews]
|   `-- [ ] VETO-01 Agree the map pool, first acting team, BO1/BO3 sequence, side selection, timeout, and reset rules. (requires: MATCH-01)
|       `-- [ ] VETO-02 Persist captain-only, alternating ban/pick turns for the actual match and reject stale or duplicate actions.
|           |-- [ ] VETO-03 Display progress and history to participants/spectators, and resume correctly after reload or reconnect.
|           |-- [ ] VETO-04 Commit distinct selected maps, decider, order, and side choices to the match before play begins.
|           `-- [ ] VETO-05 Permit reasoned administrator recovery without silently overwriting a completed veto or confirmed result.
|
|-- Chat extensions and activity notifications/ [Brief sections 6, 10]
|   |-- [ ] CHAT-01 Add a captain-only team invitation action to existing private conversations. (requires: INV-02, TEAM-05)
|   |-- [ ] CHAT-02 Define team-channel membership and history visibility, including joins, removals, and bans. (requires: ROSTER-01)
|   |   `-- [ ] CHAT-03 Add team chat with persistent history, unread state, reporting, and immediate membership enforcement.
|   |-- [ ] CHAT-04 Define match-channel access for both registered teams and relevant moderators. (requires: MATCH-01, TOUR-06)
|   |   `-- [ ] CHAT-05 Add match chat for scheduling and disputes, with bounded moderator access and report evidence.
|   |-- [ ] CHAT-06 Agree acceptable delivery latency and evaluate measured chat responsiveness/load before changing how updates are delivered. [CGP]
|   `-- [ ] NOTICE-01 Extend the existing bell beyond chat with deduplicated invitations, registration, match, and result updates. (requires: INV-03, TOUR-06, RESULT-02)
|       |-- [ ] NOTICE-02 Add read/dismiss state, relevant destination links, and preferences for optional notifications.
|       `-- [ ] NOTICE-03 Prevent cross-account leaks and stop notifications when their underlying access is revoked.
|
|-- Complete the competition MVP/ [Brief sections 2, 9]
|   |-- [ ] ACCEPT-01 Verify the complete player journey: gaming profile, listing, conversation, invitation, and joining a team. (requires: PROF-03, INV-03, LFG-05, LFG-06)
|   |-- [ ] ACCEPT-02 Run an eight-team event from registration to a confirmed final using verified external results. (requires: BRACKET-02, BRACKET-04, FACEIT-06, DISPUTE-02)
|   |   |-- [ ] ACCEPT-03 Repeat with partial capacity/byes, duplicate submissions, concurrent actions, roster conflicts, bans, and provider failure.
|   |   `-- [ ] ACCEPT-04 Cover BO1 and BO3, manual fallback, corrections, and restart persistence without duplicated advancement.
|   `-- [ ] ACCEPT-05 Reconcile feature availability, navigation, search categories, Guide explanations, and documentation with the completed workflows. (requires: ACCEPT-01, ACCEPT-03, ACCEPT-04)
|       `-- [ ] ACCEPT-06 Release the competition workflows using the established release checks and collect player feedback. (requires: REL-11)
|
|-- Later competition features/ [Brief section 10; after reliable confirmed results]
|   `-- [ ] GROW-01 Decide when participation and confirmed match history justify rankings and the scope of the first ranking release. (requires: ACCEPT-06)
|       |-- [ ] RANK-01 Define eligible matches, ordering/tiebreaks, forfeits, disputes, corrections, and team identity across roster changes.
|       |   `-- [ ] RANK-02 Publish real team standings with played/won/lost, round difference, recent form, and titles.
|       |       `-- [ ] RANK-03 Paginate/filter standings and rebuild them deterministically after approved result corrections.
|       |-- [ ] RATE-01 Choose and document a player/team rating policy, such as Elo or Glicko-2, including placement and abuse handling.
|       |   `-- [ ] RATE-02 Apply versioned rating changes once per eligible result and support audited correction/recalculation.
|       |-- [ ] STATS-01 Confirm available, permitted provider statistics and define K/D, headshot percentage, map performance, and MVP meanings.
|       |   `-- [ ] STATS-02 Display attributable player/team statistics with sample sizes, update times, and missing-data states.
|       |-- [ ] BADGE-01 Define participation, tournament-win, and win-streak achievements from confirmed history.
|       |   `-- [ ] BADGE-02 Award achievements once and correct/revoke them when underlying results change.
|       `-- [ ] SEASON-01 Define season dates, eligibility, transitions, archives, and which ratings or standings reset. (requires: RANK-03, RATE-02)
|           `-- [ ] SEASON-02 Publish current and past season tables while preserving historical results and awards.
|
|-- Later formats, games, and external convenience features/ [Brief section 10]
|   |-- [ ] FORMAT-01 Specify group-stage and double-elimination rules, advancement, tiebreaks, and reset-final behavior. (requires: ACCEPT-06)
|   |   `-- [ ] FORMAT-02 Implement and validate each additional format through registration, results, disputes, and final standings.
|   |-- [ ] GAME-01 Select additional games based on demand and confirm their roster, format, map, and result-verification requirements. (requires: ACCEPT-06)
|   |   `-- [ ] GAME-02 Add each approved game without mixing incompatible identities, statistics, rankings, or rules.
|   |-- [ ] SOCIAL-01 Decide whether optional Steam/FACEIT sign-in is wanted, including safe linking and recovery for existing accounts.
|   |   `-- [ ] SOCIAL-02 Add approved sign-in options without silently merging accounts by nickname or unverified email.
|   `-- [ ] BOT-01 Define an opt-in Discord integration and which public or authorized events it may publish. (requires: NOTICE-02)
|       `-- [ ] BOT-02 Add approved notifications with limited permissions, revocation, and protection against private-message disclosure.
|
`-- Account lifecycle and public-service follow-up/ [CGP; independent of competition milestones]
    |-- [ ] ACCOUNT-01 Decide verification, recovery, and email-change policies while preserving currently usable accounts.
    |   `-- [ ] ACCOUNT-02 Configure account-email delivery with private credentials and clear delivery/failure handling.
    |       |-- [ ] ACCOUNT-03 Add email verification with expiring, single-use challenges and bounded resend attempts.
    |       |-- [ ] ACCOUNT-04 Add password recovery with expiring, single-use challenges, enumeration-resistant responses, and session revocation.
    |       `-- [ ] ACCOUNT-05 Add reauthenticated email changes with verification of the new address and appropriate account notices.
    |-- [ ] PRIVACY-01 Decide account deletion/export, content retention, and treatment of tournament history and moderation evidence. [Proposal]
    |   `-- [ ] PRIVACY-02 Implement approved lifecycle requests without exposing other participants' messages or private reports.
    `-- [ ] HOME-01 Decide whether and when home should show real events, recruitment, or activity instead of remaining empty. [Proposal]
        `-- [ ] HOME-02 Add only the approved real-data sections, with useful empty states and no demonstration records.
```

## Completion rules for every feature

- Add explicit persistent data changes and migrations where needed; verify both fresh storage and upgrades using disposable data. Keep Guide examples separate from live data.
- Enforce permissions, ownership, participant access, current bans, input bounds, request limits, and atomic state changes on the server. Preserve private emails, credentials, messages, and report evidence. Keep external secrets out of clients and public records.
- Use shared controls/styles and professional English/Polish copy, including errors and accessible labels. Respect language, regional formatting, time zone, keyboard access, mobile layouts, and reduced motion.
- Test successful journeys and relevant denial, concurrent, retry, stale-state, failure, and restart cases against actual local storage/runtime. Follow [LOCAL_TESTING.md](LOCAL_TESTING.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
- Run Codex Security after implementation changes, address validated vulnerabilities, and review security fixes. Record scope and evidence without claiming tests or scans prove every vulnerability absent.
- Update current behavior, local setup, and feature availability in maintained guidance. Verify hosted behavior separately under the [deployment requirements](DEPLOYMENT.md); local checks do not certify production quotas or recovery.

## Maintaining the roadmap

Complete prerequisite task rows before their descendants and satisfy every additional `requires` reference. Keep completed IDs for traceability. Split large tasks when implementation reveals independent outcomes; add explicit dependencies rather than duplicating a task under several parents. Revisit decisions before changing account policy, administrator authority, competition rules, or public data exposure.
