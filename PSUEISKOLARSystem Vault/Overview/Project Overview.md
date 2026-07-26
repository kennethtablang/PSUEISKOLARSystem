---
tags: [overview]
---
# Project Overview

**PSU e-Iskolar** is a web-based platform that centralizes **scholar profiling, document/records management, compliance monitoring, and descriptive data analytics** for Pangasinan State University's scholarship program. It replaces fragmented spreadsheet-based tracking with a single, role-based database.

Related: [[Home]] · [[User Roles & Permissions]] · [[Data Model]]

## Purpose
- **Scholars** self-manage their profile and upload/resubmit required documents each academic period, and track their compliance status.
- **Coordinators** verify submissions, monitor GWA/document compliance in real time, set deadlines, and post announcements.
- **Administrators** manage accounts and system configuration, and generate analytics reports for decision-making.

## Institutional context
- **Institution:** Pangasinan State University — **Lingayen Campus** (main). Student & Alumni Affairs Office.
- Originally scoped multi-campus; **now single-campus** (see [[Roadmap & Status]]).
- **Quality framework:** ISO 25010 (functionality, reliability, usability, efficiency, maintainability, portability).
- **Methodology:** Agile / Scrum (5 sprints).
- This is a **capstone project**. The full SRS lives in the repo at `psueiskolarsystem.client/src/assets/PSU_eIskolar_Requirements_Specification_v2.md`.

## What a scholar does (happy path)
1. Registers → verifies email → accepts the Data Privacy consent → completes profile (the [[Authentication & Security#Onboarding gate|onboarding gate]]).
2. Picks scholarship type; sees the [[Documents & Compliance|required documents]] for the active period.
3. Uploads each document; a [[User Roles & Permissions|coordinator]] verifies or flags it.
4. Tracks compliance (documents + [[Documents & Compliance#GWA compliance|GWA]]) on the dashboard; gets [[Announcements & Notifications|notifications]] for reviews, deadlines, announcements.

## Core modules
[[Authentication & Security]] · [[Documents & Compliance]] · [[Announcements & Notifications]] · [[Analytics & Reports]] · [[Messaging & Search]] · scholarship-type & requirement configuration · [[User Roles & Permissions|user management]] · system settings / audit log.
