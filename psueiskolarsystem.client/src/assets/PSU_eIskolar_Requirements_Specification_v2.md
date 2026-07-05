# PSU e-Iskolar: A Web-Based Scholar Profiling and Records Management System with Data Analytics — System Features and Software Requirements Specification (SRS)

**Institution:** Pangasinan State University (multi-campus), Student Alumni Affairs Office
**Quality Framework:** ISO 25010 (six dimensions: functionality, reliability, usability, efficiency, maintainability, portability)
**Development Methodology:** Agile (Scrum — Requirements, Design, Develop, Test, Deploy, Review phases; 5 sprints)
**Respondents:** 30 Scholars · 10 Scholarship Coordinators · 10 IT Experts
**Likert Scale Interpretation:** 4.50–5.00 Outstanding · 3.50–4.49 Very Satisfactory · 2.50–3.49 Satisfactory · 1.50–2.49 Unsatisfactory · 1.00–1.49 Poor

---

## 1. System Overview

PSU e-Iskolar is a web-based platform that centralizes scholar profiling, document/records management, compliance monitoring, and descriptive data analytics across PSU's multiple campuses. It replaces fragmented spreadsheet-based tracking with a single, role-based, multi-campus database, enabling scholars to self-manage document submissions, coordinators to verify records and monitor compliance in real time, and administrators to generate analytics reports for institutional decision-making.

---

## 2. User Roles (Actors)

| Role | Description | Primary System Interactions |
|---|---|---|
| **Administrator** | Manages system-wide configuration, accounts, and oversight across campuses | Creates scholar accounts, assigns roles, manages users, views system activity, oversees database |
| **Scholarship Coordinator / Staff** | Reviews and verifies scholar submissions, monitors compliance | Reviews documents, updates verification status, posts announcements, generates reports |
| **Scholar (Student)** | Recipient of scholarship benefits, primary self-service user | Logs in, manages profile, uploads/resubmits documents, tracks compliance status, views announcements |

---

## 3. Core System Features

| # | Feature / Module | Description |
|---|---|---|
| 1 | **Scholar Account Management and Profiling Module** | Administrator-created scholar accounts; scholars manage and update personal, academic, and scholarship-related profile data. |
| 2 | **Self-Service Document Submission Module** | Scholars upload required documents (COR, grades, IDs, etc.) with file validation, organized storage, and resubmission for incomplete/incorrect documents. |
| 3 | **Records Management and Verification Module** | Coordinators review submitted documents and categorize them as Verified, Pending, or Incomplete, with feedback to scholars. |
| 4 | **Monitoring and Status Tracking Dashboard** | Real-time tracking of submission status, notifications, and compliance progress for scholars; submission rates and activity overview for administrators. |
| 5 | **Data Analytics and Reporting Module** | Descriptive analytics — scholar counts, distribution by program, compliance rates, submission trends — with downloadable, filterable reports. |
| 6 | **Announcement and Notification Module** | Administrators post deadlines, requirements, and scholarship-related notices, displayed on scholar dashboards. |
| 7 | **Administrative Dashboard and User Management Module** | Tools for managing accounts, assigning roles, viewing system activity, and database maintenance, with search and filtering. |
| 8 | **Role-Based Access Control and Security Module** | Defines access levels for Administrator, Scholarship Coordinator/Staff, and Scholar, with secure login, session handling, and audit trail. |
| 9 | **Centralized Multi-Campus Database** | Single, standardized data schema enabling consistent, real-time data across all PSU campuses. |
| 10 | **Advanced Search and Filtering** | Multi-criteria search (campus, course, scholarship type, compliance status) for efficient record retrieval. |
| 11 | **Responsive Web Interface** | Consistent, user-friendly experience across desktops, tablets, and mobile phones. |
| 12 | **Academic Performance Tracking** | Monitoring of scholar grades and academic standing as part of scholarship compliance requirements. |
| 13 | **Real-Time Notification and Live Update Module** | Push-based, instant delivery of notifications and live-refreshing dashboards and status indicators without manual page reload. |
| 14 | **In-App Notification Center** | Persistent, per-user notification inbox with read/unread state, categorization, and history. |
| 15 | **Bulk Account Import Module** | Batch creation of scholar accounts from CSV/Excel with per-row validation and error reporting. |
| 16 | **Submission Deadline and Compliance Window Management** | Coordinator-defined submission deadlines per requirement and period, with on-time/late flagging, countdowns, and automated reminders. |
| 17 | **Scholar–Coordinator Messaging** | Threaded, document-linked two-way communication between scholars and coordinators beyond one-way feedback. |
| 18 | **Scholarship Renewal and Lifecycle Management** | Per-period renewal processing and tracking of scholar lifecycle status (active, renewed, lapsed, suspended, graduated). |
| 19 | **Data Privacy and Consent Management** | Privacy-notice acknowledgement and consent capture per RA 10173, plus data-subject access to personal data. |
| 20 | **Notification Preferences and Printable Summaries** | Per-user notification-channel preferences and on-demand printable/PDF compliance summaries. |

---

## 4. Functional Requirements (FR)

### 4.1 Scholar Account Management and Profiling

| ID | Requirement |
|---|---|
| FR-1.1 | The system shall allow administrators to create individual scholar accounts with login credentials. |
| FR-1.2 | The system shall allow scholars to log in using their assigned account credentials. |
| FR-1.3 | The system shall allow scholars to input and update their personal, academic, and scholarship-related profile information. |
| FR-1.4 | The system shall allow scholars to update their contact information. |
| FR-1.5 | The system shall allow administrators to view, monitor, and edit scholar records and submitted documents as needed. |
| FR-1.6 | The system shall associate each scholar profile with a specific campus, course/program, and scholarship type. |
| FR-1.7 | The system shall allow recording and monitoring of a scholar's academic performance (grades) as part of their profile. |
| FR-1.8 | The system shall allow coordinators to view and assess whether a scholar meets grade-based scholarship compliance requirements. |

### 4.2 Self-Service Document Submission

| ID | Requirement |
|---|---|
| FR-2.1 | The system shall allow scholars to upload required documents (e.g., Certificate of Registration, grade reports, identification cards). |
| FR-2.2 | The system shall validate uploaded files (e.g., file type and size) before accepting a submission. |
| FR-2.3 | The system shall store submitted documents in an organized, retrievable structure linked to the scholar's profile. |
| FR-2.4 | The system shall automatically timestamp each document submission. |
| FR-2.5 | The system shall allow scholars to resubmit documents that have been marked Incomplete or Pending revision. |
| FR-2.6 | The system shall display the current submission status of each required document to the scholar. |
| FR-2.7 | The system shall notify the scholar upon successful receipt of a document submission. |

### 4.3 Records Management and Verification

| ID | Requirement |
|---|---|
| FR-3.1 | The system shall allow coordinators to review submitted documents. |
| FR-3.2 | The system shall allow coordinators to categorize each submitted document as Verified, Pending, or Incomplete. |
| FR-3.3 | The system shall allow coordinators to attach feedback or instructions to a document for the scholar's reference. |
| FR-3.4 | The system shall update the scholar's record automatically once a document's status is changed. |
| FR-3.5 | The system shall maintain a history of status changes per document. |
| FR-3.6 | The system shall automatically notify the scholar when their document status is changed by a coordinator. |

### 4.4 Monitoring and Status Tracking Dashboard

| ID | Requirement |
|---|---|
| FR-4.1 | The system shall provide scholars with a dashboard showing the real-time status of their submitted requirements. |
| FR-4.2 | The system shall display notifications related to submission status and compliance progress on the scholar dashboard. |
| FR-4.3 | The system shall provide administrators/coordinators with a dashboard showing submission rates, pending requirements, and overall scholar activity. |
| FR-4.4 | The system shall allow administrators to filter dashboard data by campus, course, scholarship type, or compliance status. |

### 4.5 Data Analytics and Reporting

| ID | Requirement |
|---|---|
| FR-5.1 | The system shall display the total number of scholars, distribution by program, and compliance rates as summarized analytics. |
| FR-5.2 | The system shall display submission trend data over time. |
| FR-5.3 | The system shall generate downloadable reports filtered by course, scholarship type, academic period, or compliance status. |
| FR-5.4 | The system shall present analytics using graphical visualizations (e.g., charts, graphs, progress indicators). |
| FR-5.5 | The system shall allow reports to be exported in a downloadable format (e.g., PDF/Excel). |
| FR-5.6 | The system shall support cross-campus analytics, allowing administrators to view and compare compliance and scholar data across multiple PSU campuses. |
| FR-5.7 | The system shall be limited to descriptive analytics only; predictive, prescriptive, and machine learning-based analytics are explicitly out of scope. |

### 4.6 Announcement and Notification Module

| ID | Requirement |
|---|---|
| FR-6.1 | The system shall allow administrators to create, edit, and delete announcements. |
| FR-6.2 | The system shall display active announcements on scholar dashboards. |
| FR-6.3 | The system shall allow announcements to be targeted by campus, scholarship type, or program where applicable. |
| FR-6.4 | The system shall notify scholars of new announcements and approaching deadlines. |

### 4.7 Administrative Dashboard and User Management

| ID | Requirement |
|---|---|
| FR-7.1 | The system shall allow administrators to create, update, deactivate, and delete user accounts. |
| FR-7.2 | The system shall allow administrators to assign or change a user's role (Administrator, Scholarship Coordinator/Staff, Scholar). |
| FR-7.3 | The system shall allow administrators to view a log of system activity. |
| FR-7.4 | The system shall provide administrators with database maintenance functions (e.g., archiving inactive scholar records). |
| FR-7.5 | The system shall display system-level summary metrics (total scholars, pending submissions, compliance overview) on the administrative dashboard. |

### 4.8 Role-Based Access Control and Security

| ID | Requirement |
|---|---|
| FR-8.1 | The system shall authenticate each user and assign exactly one role: Administrator, Scholarship Coordinator/Staff, or Scholar. |
| FR-8.2 | The system shall enforce role-based access control (RBAC), restricting access to modules, views, and actions according to the authenticated user's role. |
| FR-8.3 | The system shall maintain an audit trail recording user actions (e.g., logins, record edits, status changes) with user identity and timestamp. |
| FR-8.4 | The system shall provide a password reset/recovery mechanism for registered users. |
| FR-8.5 | The system shall automatically terminate a user session after a defined period of inactivity. |
| FR-8.6 | The system shall restrict Scholarship Coordinator/Staff data access to scholars within their assigned campus. |
| FR-8.7 | The system shall grant Administrators cross-campus access to all scholar records and system functions. |

### 4.9 Centralized Multi-Campus Database

| ID | Requirement |
|---|---|
| FR-9.1 | The system shall store scholar data from all PSU campuses in a single centralized database. |
| FR-9.2 | The system shall apply a standardized data schema for scholarship types, programs, and compliance categories across all campuses. |
| FR-9.3 | The system shall reflect data updates in real time across all authorized users regardless of campus. |
| FR-9.4 | The system shall allow records to be associated with and filtered by campus. |

### 4.10 Advanced Search and Filtering

| ID | Requirement |
|---|---|
| FR-10.1 | The system shall allow users to search scholar records by keyword (e.g., name, ID number). |
| FR-10.2 | The system shall allow users to filter scholar records by multiple criteria, including campus, course, scholarship type, and compliance status. |
| FR-10.3 | The system shall return search and filter results within the user's authorized data scope based on their role. |

### 4.11 Responsive Web Interface

| ID | Requirement |
|---|---|
| FR-11.1 | The system shall render a consistent, functional interface on desktop, tablet, and mobile screen sizes. |
| FR-11.2 | The system shall be accessible through standard web browsers without requiring local installation. |

### 4.12 Academic Performance Tracking

| ID | Requirement |
|---|---|
| FR-12.1 | The system shall allow recording of scholar grade data per academic period. |
| FR-12.2 | The system shall display a scholar's academic performance history within their profile. |
| FR-12.3 | The system shall allow coordinators to assess whether a scholar's grades meet the minimum requirements of their scholarship program. |
| FR-12.4 | The system shall flag scholars whose academic performance falls below the scholarship's grade threshold for coordinator review. |

### 4.13 Real-Time Updates and Live Notifications

| ID | Requirement |
|---|---|
| FR-13.1 | The system shall deliver notifications to users in real time (push-based) without requiring a manual page refresh. |
| FR-13.2 | The system shall update dashboard metrics, status indicators, and lists live as the underlying data changes. |
| FR-13.3 | The system shall update the unread-notification indicator (badge/count) in real time as new notifications arrive. |
| FR-13.4 | The system shall reflect document status changes and new announcements to affected connected users in real time. |
| FR-13.5 | The system shall degrade gracefully to on-refresh updates when a live connection is unavailable, without loss of data. |

### 4.14 In-App Notification Center

| ID | Requirement |
|---|---|
| FR-14.1 | The system shall maintain a persistent, per-user notification inbox retaining the user's notification history. |
| FR-14.2 | The system shall track read/unread state per notification and allow users to mark items as read or mark all as read. |
| FR-14.3 | The system shall categorize notifications by type (e.g., document status, announcement, deadline, message, account). |
| FR-14.4 | The system shall allow a notification to deep-link the user to the relevant record (document, announcement, message, or profile). |

### 4.15 Bulk Account Import

| ID | Requirement |
|---|---|
| FR-15.1 | The system shall allow administrators to create multiple scholar accounts in a single operation via CSV/Excel upload. |
| FR-15.2 | The system shall validate each imported row (required fields, duplicate email, valid campus, program, and scholarship type) before creating accounts. |
| FR-15.3 | The system shall import valid rows, reject invalid rows, and produce a downloadable validation/error report identifying failed rows and reasons. |
| FR-15.4 | The system shall provide a downloadable import template defining the required columns and format. |
| FR-15.5 | The system shall issue account credentials and/or email-verification links to successfully created scholars. |

### 4.16 Submission Deadline and Compliance Window Management

| ID | Requirement |
|---|---|
| FR-16.1 | The system shall allow coordinators to define a submission deadline for each document requirement per academic period. |
| FR-16.2 | The system shall display the applicable due date and a countdown to scholars for each pending requirement. |
| FR-16.3 | The system shall classify each submission as on-time or late by comparing its timestamp against the deadline. |
| FR-16.4 | The system shall send automated reminders to scholars ahead of a submission deadline. |
| FR-16.5 | The system shall provide coordinators a report of overdue, missing, or late submissions for a given period. |

### 4.17 Scholar–Coordinator Messaging

| ID | Requirement |
|---|---|
| FR-17.1 | The system shall allow scholars and coordinators to exchange threaded messages linked to a specific document or requirement. |
| FR-17.2 | The system shall allow both parties to post replies within a conversation thread and retain the full message history. |
| FR-17.3 | The system shall notify the recipient in real time when a new message is posted. |
| FR-17.4 | The system shall restrict each conversation to the participating scholar and authorized coordinators/administrators. |

### 4.18 Scholarship Renewal and Lifecycle Management

| ID | Requirement |
|---|---|
| FR-18.1 | The system shall track each scholar's scholarship lifecycle state (e.g., Active, Renewed, Lapsed, Suspended, Graduated). |
| FR-18.2 | The system shall allow coordinators to process scholarship renewal for a scholar per academic period. |
| FR-18.3 | The system shall support evaluating renewal eligibility against document compliance and grade thresholds. |
| FR-18.4 | The system shall surface scholars due for renewal or with lapsed status on the coordinator dashboard. |

### 4.19 Data Privacy and Consent Management

| ID | Requirement |
|---|---|
| FR-19.1 | The system shall present a data privacy notice and capture the user's consent before collecting or processing personal data, in compliance with RA 10173. |
| FR-19.2 | The system shall record each consent action with a timestamp and the applicable privacy-notice version. |
| FR-19.3 | The system shall allow scholars to view and download the personal data held about them (data-subject access). |
| FR-19.4 | The system shall restrict processing and visibility of scholar personal data to authorized roles only. |

### 4.20 Notification and Delivery Preferences

| ID | Requirement |
|---|---|
| FR-20.1 | The system shall allow users to configure their notification delivery channels (in-app and/or email) per notification category. |
| FR-20.2 | The system shall allow users to opt out of non-critical email notifications. |
| FR-20.3 | The system shall always deliver critical account and security notifications regardless of user preferences. |

### 4.21 Printable Compliance Summary

| ID | Requirement |
|---|---|
| FR-21.1 | The system shall generate a per-scholar printable/PDF summary consolidating profile, document compliance, grade history, and scholarship status. |
| FR-21.2 | The system shall include the generation date/time and the generating user on each summary. |
| FR-21.3 | The system shall make the summary available to the scholar (their own) and to authorized coordinators/administrators. |

---

## 5. Non-Functional Requirements (NFR)

NFRs are organized according to the **ISO 25010** quality dimensions adopted as the study's acceptability evaluation framework: functionality, reliability, usability, efficiency, maintainability, and portability. A dedicated **Security** subsection is included given RBAC and audit trail are core to the system's design.

### 5.1 Functional Suitability (Functionality)

| ID | Requirement |
|---|---|
| NFR-1.1 | **Completeness:** The system shall implement all functional requirements specified in Section 4 without omission. |
| NFR-1.2 | **Correctness:** Analytics computations (counts, distributions, compliance rates) shall accurately reflect the underlying scholar record data at the time of generation. |
| NFR-1.3 | **Appropriateness:** All system functions shall map directly to a documented need identified during requirements gathering with PSU scholarship stakeholders. |

### 5.2 Reliability

| ID | Requirement |
|---|---|
| NFR-2.1 | **Availability:** The system shall be available during institutional operating hours (e.g., 99% uptime). |
| NFR-2.2 | **Fault Tolerance / Data Integrity:** Database transactions (e.g., document status updates, profile edits) shall be atomic and consistent to prevent partial writes. |
| NFR-2.3 | **Recoverability:** The system database shall be backed up on a scheduled basis (e.g., daily) and recoverable within a defined Recovery Time Objective (RTO). |
| NFR-2.4 | **Referential Integrity:** All relational tables shall enforce primary key/foreign key constraints to prevent orphaned or inconsistent records (e.g., a document submission cannot exist without a valid scholar reference). |
| NFR-2.5 | **Cross-Campus Consistency:** Data submitted or updated at one campus shall be immediately and consistently reflected for all authorized users across other campuses. |
| NFR-2.6 | **Real-Time Propagation:** Notifications, status changes, and dashboard updates shall propagate to connected clients in near real time (e.g., within a few seconds) without requiring a manual refresh. |

### 5.3 Usability

| ID | Requirement |
|---|---|
| NFR-3.1 | **Learnability:** A first-time scholar user shall be able to complete document submission within a defined number of steps without prior training. |
| NFR-3.2 | **Operability:** Each role shall be presented only with navigation options and dashboard widgets relevant to that role. |
| NFR-3.3 | **User Interface Consistency:** The system shall apply a consistent visual design (color scheme, typography, component styling) across all views. |
| NFR-3.4 | **Visualization Clarity:** Analytics dashboards shall present data using clear, readable charts, graphs, and progress indicators. |

### 5.4 Performance Efficiency

| ID | Requirement |
|---|---|
| NFR-4.1 | **Time Behavior:** Standard page views (dashboards, scholar lists) shall load within an acceptable response time (e.g., ≤ 3 seconds) under normal load. |
| NFR-4.2 | **Resource Utilization:** Database queries, especially analytics aggregations across multi-campus data, shall be optimized (e.g., indexed columns, efficient queries) to minimize server resource consumption. |
| NFR-4.3 | **Capacity:** The system shall support concurrent access by the target user population (scholars across multiple campuses, scholarship coordinators, and administrators) without significant performance degradation. |
| NFR-4.4 | **Peak-Load Handling:** The system shall maintain acceptable response times during peak usage periods (e.g., scholarship renewal deadlines) when large numbers of scholars simultaneously upload documents. |
| NFR-4.5 | **Data Retrieval Efficiency:** The system shall implement paginated data retrieval for scholar lists and records to avoid full-table loads that degrade performance. |

### 5.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-5.1 | **Modularity:** The system shall be implemented with clear separation of concerns across its functional modules (profiling, document submission, verification, dashboard, analytics, announcements, administration). |
| NFR-5.2 | **Reusability:** Common UI elements (e.g., status badges, notification components, filter controls) shall be implemented as reusable components. |
| NFR-5.3 | **Modifiability:** Database schema changes (e.g., new scholarship types, compliance categories, or additional campuses) shall be implementable through traceable, incremental migrations. |
| NFR-5.4 | **Testability:** Module logic, including analytics computations, shall be structured to support unit testing independent of the UI layer. |
| NFR-5.5 | **Documentation:** The system shall be accompanied by comprehensive technical documentation (architecture, database schema, API/module descriptions, deployment guide) to support maintenance by institutional IT staff beyond the initial development period. |
| NFR-5.6 | **Coding Standards:** The system codebase shall adhere to established coding standards and conventions to ensure long-term readability and maintainability. |

### 5.6 Portability

| ID | Requirement |
|---|---|
| NFR-6.1 | **Adaptability:** The system shall function correctly on current versions of major web browsers (e.g., Chrome, Edge, Firefox). |
| NFR-6.2 | **Installability:** The system shall be deployable to a standard web hosting environment with documented setup steps. |
| NFR-6.3 | **Device Compatibility:** The responsive design shall ensure consistent functionality across desktop, laptop, tablet, and mobile devices. |

### 5.7 Security

| ID | Requirement |
|---|---|
| NFR-7.1 | **Authentication Security:** User passwords shall be stored using a secure, salted hashing algorithm — never in plaintext. |
| NFR-7.2 | **Authorization Enforcement:** Role-based access restrictions shall be enforced at the application logic level, not only hidden in the UI, to prevent unauthorized access via direct URL navigation. |
| NFR-7.3 | **Data Transmission:** All client-server communication shall be encrypted via HTTPS/TLS. |
| NFR-7.4 | **Audit Logging:** User actions affecting scholar records (status changes, profile edits, account management) shall be logged with user identity and timestamp, supporting institutional accountability requirements. |
| NFR-7.5 | **Data Privacy Compliance:** Handling of scholar personal data shall comply with the Philippine Data Privacy Act of 2012 (RA 10173). |

---

## 6. Traceability Note

Each functional module in Section 4 corresponds to one of the **Core System Features** in Section 3 (as enumerated in the study's Scope and Limitation and elaborated across Chapters 1–3), and each NFR category in Section 5 corresponds to one of the six **ISO 25010** acceptability dimensions evaluated through the study's survey instrument (functionality, reliability, usability, efficiency, maintainability, portability), with 50 respondents drawn from three groups: 30 Scholars, 10 Scholarship Coordinators/Administrative Staff, and 10 IT Experts/Faculty.

**Extended features (13–20 / FR-13 through FR-21):** These modules enhance the original scope with real-time delivery, an in-app notification center, bulk onboarding, deadline and renewal lifecycle management, scholar–coordinator messaging, and RA 10173 data-privacy/consent handling. They deepen — and remain within — the descriptive, records-management scope of the study; they introduce no predictive/ML analytics, financial disbursement, or external integrations, and therefore do not cross the boundaries defined below.

**Explicit scope boundaries (from the paper):** The system does not cover enrollment processing, grading system integration, financial disbursement, PhilGEPS/CHED external integration, automated eligibility ranking, biometric authentication, automated document authenticity verification, or machine learning/predictive analytics. These are captured in FR-5.7 and reflected in the NFR boundaries above.
