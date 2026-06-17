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

**Explicit scope boundaries (from the paper):** The system does not cover enrollment processing, grading system integration, financial disbursement, PhilGEPS/CHED external integration, automated eligibility ranking, biometric authentication, automated document authenticity verification, or machine learning/predictive analytics. These are captured in FR-5.7 and reflected in the NFR boundaries above.
