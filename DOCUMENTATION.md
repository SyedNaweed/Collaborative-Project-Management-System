# Collaborative Project Management System (CPMS)
## Complete Technical Documentation, Architecture Guide, and Form Validation Audit Report

---

# Table of Contents
1. [Project Overview and Objectives](#1-project-overview-and-objectives)
2. [Teacher ("Mam") Core Evaluation Checklist](#2-teacher-mam-core-evaluation-checklist)
3. [System Architecture & Technology Stack](#3-system-architecture--technology-stack)
4. [Complete 30-Workflow Specification](#4-complete-30-workflow-specification)
5. [Comprehensive Form Validation Audit & Fix Matrix](#5-comprehensive-form-validation-audit--fix-matrix)
6. [Conditional Student Type & Mixed Collaboration Logic](#6-conditional-student-type--mixed-collaboration-logic)
7. [MongoDB Database Schema & Inspection Guide](#7-mongodb-database-schema--inspection-guide)
8. [API and Route Specifications](#8-api-and-route-specifications)
9. [Automated Test Suite & Audit Results](#9-automated-test-suite--audit-results)
10. [End-to-End Demonstration Script for Faculty / Viva](#10-end-to-end-demonstration-script-for-faculty--viva)

---

# 1. Project Overview and Objectives

The **Collaborative Project Management System (CPMS)** is an end-to-end academic project lifecycle platform designed to connect **Students** (Internal and External) and **Faculty Guides**. It governs team formation, project proposal submissions, task assignment pipelines, prerequisite dependency tracking, deliverable submissions with automated versioning (`v1`, `v2`, etc.), AI-assisted verification reports, and faculty evaluation.

### Key Tenets
1. **Separation of Concerns:** Team membership is persistent across semesters/projects, whereas project participation can be `ACTIVE` or `FROZEN` per project without a student having to leave the team.
2. **Sequential Project Lifecycle:** A team can work on multiple projects over time, but strictly **one current project at a time**. Next projects are blocked until the current one is `COMPLETED`.
3. **Institutional Security & Scoping:** Strict validation of institutional email domains (`@vitstudent.ac.in` vs. `@vit.ac.in` vs. personal emails for external collaborators) and team names unique within each faculty's jurisdiction.

---

# 2. Teacher ("Mam") Core Evaluation Checklist

| Teacher Focus Area | Specific Requirement | Implementation & Verification |
| :--- | :--- | :--- |
| **1. Authentication & Login** | • Dual-role login for Student and Faculty<br>• Role-based dashboard redirection (`/student/dashboard` vs. `/faculty/dashboard`)<br>• Generic error messaging to prevent user enumeration | `routes/authRoutes.js`, `views/auth/login.ejs`<br>Tested with `rahul21` (Student) and `drpriya` (Faculty). |
| **2. Dual Registration & Validation** | • **Internal Student:** Mandatory Register Number, email ending in `@vitstudent.ac.in`<br>• **External Student:** Register number hidden & optional, accepts personal email, rejects `@vitstudent.ac.in` and `@vit.ac.in`<br>• **Faculty:** Capacity bounded strictly between **2 and 7**, `@vit.ac.in` email, employee ID | `middleware/validation.js`, `views/auth/student-register.ejs`, `views/auth/faculty-register.ejs`. |
| **3. The Collaboration Checkbox** | • Detects when a team is composed of both Internal and External students<br>• Shows dynamic alert and enforces mandatory declaration checkbox:<br>  > *"This team is a collaboration between Internal and External students."*<br>• Non-mixed teams (purely Internal or External) do not require it | `public/js/teamValidation.js`, `middleware/validation.js`, `views/student/create-team.ejs`. |
| **4. Live MongoDB Database** | • Database `collaborative_pms`<br>• Collections: `users`, `teams`, `projects`, `tasks`, `issues`, `otps`<br>• Clean indexes (`unique: true, sparse: true`) | Verified in local MongoDB server on port 27017 via `mongosh` and MongoDB Compass. |

---

# 3. System Architecture & Technology Stack

```
+---------------------------------------------------------------------------------+
|                                 BROWSER CLIENT                                  |
|   HTML5 + CSS3 (Bootstrap 5.3) + jQuery 3.7 + Bootstrap Icons + Custom Design   |
+----------------------------------------+----------------------------------------+
                                         | HTTP / REST AJAX
+----------------------------------------v----------------------------------------+
|                               NODE.JS & EXPRESS                                 |
|  - Middleware: auth.js (Session Role Guards), validation.js (Input sanitizing)  |
|  - Routers: authRoutes, studentRoutes, facultyRoutes, projectRoutes             |
|  - View Engine: EJS (Server-side rendering with reusable partials)              |
+----------------------------------------+----------------------------------------+
                                         | Mongoose ODM 8.9
+----------------------------------------v----------------------------------------+
|                          MONGODB COMMUNITY SERVER 7.x                           |
|       Database: collaborative_pms  |  Collections: users, teams, projects, etc. |
+---------------------------------------------------------------------------------+
```

### Stack Breakdown
- **Frontend:** HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons, JavaScript (ES6+), jQuery 3.7.1.
- **Backend:** Node.js v20+, Express.js 4.21.
- **Database:** MongoDB Community Server (Windows Service), Mongoose 8.9.2 ODM.
- **Security & Session:** `bcryptjs` (salt rounds 10), `express-session`, `connect-mongo` (session persistence).

---

# 4. Complete 30-Workflow Specification

### Workflow 1: System Overview
Unifies student–faculty project operations in one system: registrations, faculty guides, team formation, project proposals, task assignment, deliverable submissions with versioning, issue logging, AI-assisted verification, faculty evaluation, archiving, and student academic history.

### Workflow 2: System Entry and Authentication
Users enter credentials (username or email + password). Backend validates without revealing account existence. Successful login redirects students to `/student/dashboard` and faculty to `/faculty/dashboard`.

### Workflow 3: Faculty Registration
Faculty members provide full name, unique Employee ID, institutional email (`@vit.ac.in`), username, password, and team capacity (integer between 2 and 7). Registration redirects to the faculty login page.

### Workflow 4: Student Registration
Students register by selecting their student type (Internal or External). Submits name, email, username, password, and OTP. Internal students must provide their Register Number and `@vitstudent.ac.in` email. External students use personal emails with no register number.

### Workflow 5: Faculty Selection and Verification
Students view registered faculty members, current occupied team slots, total capacity, and available slots. Before team creation, backend checks that the selected faculty has available capacity slots.

### Workflow 6: Team Creation and Membership
One student initiates creation, selects an available faculty, names the team, and adds teammates. Allowed team size is strictly between **1 and 9 students**. Creator is automatically included.

### Workflow 7: Team Membership Lifecycle
Teams persist even after a project is finished. Students cannot leave while a project is ongoing. Once completed, a student can leave; their status becomes `LEFT` with a recorded timestamp while their project history is retained.

### Workflow 8: Project Creation & Direct Faculty Assignment
Faculty guides directly assign academic projects to student teams under their supervision. A team can execute multiple projects over time, but strictly **one current project at a time**. A new project can only be assigned if the previous one is marked `COMPLETED` or `REJECTED`.

### Workflow 9: Direct Faculty Project Allocation Model
Instead of requiring student proposals and approval cycles, the supervising Faculty Guide directly allocates the project:
1. **Direct Assignment:** Faculty selects a supervised team, enters the project title, description, and scope guidelines via the Faculty Dashboard.
2. **Immediate Activation:** Upon assignment, the project is created with status `APPROVED`, active team members are registered as `ACTIVE` participants, and `team.currentProject` is updated immediately.
3. **Workspace Unlocked:** The team gains immediate access to the Project Workspace to begin task creation, sprint planning, and deliverable submission without waiting for review gates.
4. **Scope Refinement:** The supervising faculty guide retains the ability to update and refine the project scope and instructions directly from the workspace or dashboard.

### Workflow 10: Project Workspace
Central hub for approved projects: Overview, Members & Statuses, Tasks, Submissions, Version History, Issues & Doubts, AI verification reports, and Final Evaluation.

### Workflow 11: Project Participation & Frozen Members
Team membership is distinct from project participation. For each project, members are marked:
- `ACTIVE`: Actively contributing to tasks and deliverables.
- `FROZEN`: Taking a break for this specific project without leaving the team. Can return to `ACTIVE` for subsequent projects.

### Workflow 12: Task Management
Work is divided into manageable tasks assigned to team members. Statuses transition sequentially:
`TODO` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `COMPLETED`.

### Workflow 13: Task Dependencies
Tasks can have prerequisite tasks. The backend blocks advancing a task to `IN_PROGRESS` or `COMPLETED` until all prerequisite tasks have reached `COMPLETED`.

### Workflow 14: Submission & Version History
Assigned students submit work (links, files, or summaries). Stored with incremental version numbers (`Version 1`, `Version 2`, etc.). All previous versions remain preserved.

### Workflow 15: Issues and Doubts
Students log doubts or technical bottlenecks visible to team and faculty. Tracked with status `OPEN` until a faculty or member adds a resolution, marking it `RESOLVED`.

### Workflow 16: Peer Review
Teammates evaluate peer work, submitting written commentary and ratings to inform faculty evaluation.

### Workflow 17: AI-Assisted Verification
Automatic advisory scan on deliverables: calculates similarity metrics, completeness flags, and delivers an advisory report to assist (not replace) faculty grading.

### Workflow 18: Final Evaluation
Faculty evaluates each student's contributions (tasks, submission versions, peer reviews, AI reports) and assigns a score (0 to 100) and remarks.

### Workflow 19: Project Completion and Archiving
Upon evaluation, project status transitions to `COMPLETED` and `isArchived: true`. Stored permanently in the historical archive.

### Workflow 20: Complete Student History
Preserves students' past teams, roles, project contributions, and faculty evaluations across their academic timeline.

### Workflow 21: Rejoining or Changing Teams
Students maintain a single persistent account when changing teams after project completion, subject to faculty approval.

### Workflow 22: Leaving a Team
Blocked if team has an ongoing project (`PROPOSED`, `APPROVED`, `IN_PROGRESS`). Allowed only when project is `COMPLETED`.

### Workflow 23: Account Management
Users update profile or password with OTP verification sent to their registered college email.

### Workflow 24: Forgot Password
Initiates recovery via username/email. Dispatches single-use OTP. Upon verification, permits resetting password.

### Workflow 25: Notifications
System dispatches updates for proposal approvals, task assignments, reviews, and evaluations.

### Workflow 26: Faculty Dashboard
Faculty control center: capacity stats, active teams, pending proposals, review actions, and evaluations.

### Workflow 27: Student Dashboard
Student control center: profile details, assigned guide, active team, tasks, deadlines, and project workspace access.

### Workflow 28: Core System Concept
Entities (`User`, `Team`, `Project`, `Task`, `Issue`) are decoupled yet interconnected.

### Workflow 29: Complete End-to-End Workflow
Registration $\rightarrow$ Faculty Choice $\rightarrow$ Team Formation $\rightarrow$ Proposal $\rightarrow$ Approval $\rightarrow$ Tasks $\rightarrow$ Submissions $\rightarrow$ AI Check $\rightarrow$ Evaluation $\rightarrow$ Archival.

### Workflow 30: Closing Summary
A unified academic management solution ensuring strict validation, capacity enforcement, and permanent history preservation.

---

# 5. Comprehensive Form Validation Audit & Fix Matrix

### A. Student Registration Form
- **Form Path:** [`views/auth/student-register.ejs`](file:///d:/dev/Collaborative%20Project%20Management%20System/views/auth/student-register.ejs)
- **Backend Middleware:** `validateStudentRegistration` in [`middleware/validation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/middleware/validation.js)

| Field Name | Type / Format | Validation Rule | Error Message Displayed |
| :--- | :--- | :--- | :--- |
| `studentType` | Radio (`INTERNAL` / `EXTERNAL`) | Required. Controls visibility & requirement of `registerNumber`. | "Please select a valid student type (Internal or External)." |
| `fullName` | String (Trimmed) | Required, minimum 2 characters. | "Full name is required." |
| `registerNumber` | String (Uppercase) | **INTERNAL:** Required, unique. **EXTERNAL:** Optional / omitted. | "Register Number is mandatory for Internal students." / "Register Number is already registered." |
| `email` | String (Lowercase) | **INTERNAL:** Must end with `@vitstudent.ac.in`.<br>**EXTERNAL:** Rejects `@vitstudent.ac.in` and `@vit.ac.in`. | "Internal students must use a valid VIT student email ending with @vitstudent.ac.in." / "External students must not use VIT institution emails." |
| `username` | String (Lowercase) | Required, $\ge 3$ chars, unique across database. | "Username is already taken." |
| `password` | String | Required, $\ge 6$ chars. | "Password must be at least 6 characters." |
| `confirmPassword`| String | Must strictly match `password`. | "Passwords do not match." |
| `otp` | String (6 digits) | Must match verified OTP record. | "Invalid or expired OTP." |

### B. Faculty Registration Form
- **Form Path:** [`views/auth/faculty-register.ejs`](file:///d:/dev/Collaborative%20Project%20Management%20System/views/auth/faculty-register.ejs)
- **Backend Middleware:** `validateFacultyRegistration` in [`middleware/validation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/middleware/validation.js)

| Field Name | Validation Rule | Error Message Displayed |
| :--- | :--- | :--- |
| `fullName` | Required, non-blank string. | "Faculty name is required." |
| `employeeId` | Required, unique, uppercase string. | "Employee ID is already registered." |
| `email` | Required, unique, must end with `@vit.ac.in`. | "Faculty email must end with @vit.ac.in." |
| `facultyCapacity`| Integer strictly between **2 and 7** inclusive. | "Team-handling capacity must be an integer between 2 and 7 inclusive." |
| `username` | Required, $\ge 3$ characters, unique. | "Username is already taken." |
| `password` | Required, $\ge 6$ characters, matches confirmPassword. | "Passwords do not match." |

### C. Login Form
- **Form Path:** [`views/auth/login.ejs`](file:///d:/dev/Collaborative%20Project%20Management%20System/views/auth/login.ejs)
- **Backend Handler:** `POST /auth/login` in [`routes/authRoutes.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/routes/authRoutes.js)

| Security Requirement | Implementation |
| :--- | :--- |
| **No Account Enumeration** | Returns generic message `"Invalid username or password."` whether username is missing or password fails. |
| **Role Redirection** | Authenticated session stores `userId` & `role`. Redirects `FACULTY` to `/faculty/dashboard` and `STUDENT` to `/student/dashboard`. |

### D. Team Creation Form
- **Form Path:** [`views/student/create-team.ejs`](file:///d:/dev/Collaborative%20Project%20Management%20System/views/student/create-team.ejs)
- **Backend Middleware:** `validateTeamCreation` in [`middleware/validation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/middleware/validation.js)

| Rule | Implementation & Behavior |
| :--- | :--- |
| **Team Size (1 to 9)** | Enforced on frontend table counter and backend array length validation. Rejects 0 or $>9$ members. |
| **Faculty Capacity** | Queries `Team.countDocuments({ faculty: id, isActive: true })`. If occupied $\ge$ capacity, request is rejected. |
| **Name Uniqueness** | Team name normalized to lowercase: `{ faculty: id, normalizedName: name.toLowerCase() }`. Duplicate rejected case-insensitively. |
| **Active Membership**| Checks each member; rejects students already in an active team under this faculty. |
| **Collaboration Checkbox** | If member profiles contain both `INTERNAL` and `EXTERNAL`, the confirmation checkbox is **mandatory**: `"This team is a collaboration between Internal and External students."` |

---

# 6. Conditional Student Type & Mixed Collaboration Logic

### A. Dynamic Registration Form (Internal vs External)
In [`public/js/authValidation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/public/js/authValidation.js):
```javascript
function updateStudentTypeUI() {
  const studentType = $('input[name="studentType"]:checked').val();
  const regContainer = $('#registerNumberContainer');
  const regInput = $('#registerNumber');

  if (studentType === 'INTERNAL') {
    regContainer.slideDown(200);
    regInput.prop('required', true);
    $('#emailHelpText').html('Internal students must use @vitstudent.ac.in');
  } else if (studentType === 'EXTERNAL') {
    regContainer.slideUp(200);
    regInput.prop('required', false);
    regInput.val(''); // Cleared to prevent stray values
    $('#emailHelpText').html('External students must use personal email. VIT emails are blocked.');
  }
}
```

### B. Team Collaboration Checkbox Evaluator
In [`public/js/teamValidation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/public/js/teamValidation.js):
```javascript
function reevaluateTeamComposition() {
  const hasInternal = memberProfiles.some(m => m.studentType === 'INTERNAL');
  const hasExternal = memberProfiles.some(m => m.studentType === 'EXTERNAL');
  const isMixed = hasInternal && hasExternal;

  const mixedAlertBox = $('#mixedTeamCallout');
  const confirmCheckbox = $('#collaborationConfirmed');

  if (isMixed) {
    mixedAlertBox.slideDown(250);
    confirmCheckbox.prop('required', true);
  } else {
    mixedAlertBox.slideUp(250);
    confirmCheckbox.prop('required', false);
    confirmCheckbox.prop('checked', false);
  }
}
```

### C. Backend Enforcement of Collaboration Checkbox
In [`middleware/validation.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/middleware/validation.js):
```javascript
const hasInternal = memberUsers.some((u) => u.studentType === 'INTERNAL');
const hasExternal = memberUsers.some((u) => u.studentType === 'EXTERNAL');
const isMixed = hasInternal && hasExternal;

if (isMixed) {
  const isConfirmed = collaborationConfirmed === true || collaborationConfirmed === 'true' || collaborationConfirmed === 'on';
  if (!isConfirmed) {
    errors.collaborationConfirmed =
      'This team contains both Internal and External students. You must confirm the declaration: "This team is a collaboration between Internal and External students."';
  }
}
```

---

# 7. MongoDB Database Schema & Inspection Guide

### Database Name: `collaborative_pms`
MongoDB Connection URL: `mongodb://127.0.0.1:27017/collaborative_pms`

### Collections Overview:
1. **`users`**: Contains all authenticated identities (Students & Faculty).
   - `username`: String (Unique)
   - `email`: String (Unique)
   - `role`: Enum `['STUDENT', 'FACULTY']`
   - `studentType`: Enum `['INTERNAL', 'EXTERNAL']` (for students)
   - `registerNumber`: String (Unique, Sparse - only for Internal students)
   - `employeeId`: String (Unique, Sparse - only for Faculty)
   - `facultyCapacity`: Number (2 to 7, for Faculty)
2. **`teams`**: Project teams and membership history.
   - `name`: String
   - `normalizedName`: String
   - `faculty`: ObjectId $\rightarrow$ `users`
   - `members`: Array of `{ student, studentType, status, joinedAt, leftAt }`
   - `isMixedTeam`: Boolean
   - `collaborationConfirmed`: Boolean
3. **`projects`**: Academic projects and workspaces.
   - `team`: ObjectId $\rightarrow$ `teams`
   - `faculty`: ObjectId $\rightarrow$ `users`
   - `title`, `description`
   - `status`: Enum `['PROPOSED', 'REVISION_REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']`
   - `participatingMembers`: Array of `{ student, participationStatus: 'ACTIVE' | 'FROZEN' }`
   - `evaluation`: `{ score, remarks, evaluatedAt }`
4. **`tasks`**: Task breakdown and deliverable submissions.
   - `project`: ObjectId $\rightarrow$ `projects`
   - `assignedTo`: ObjectId $\rightarrow$ `users`
   - `status`: Enum `['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']`
   - `dependencies`: Array of Task ObjectIds
   - `submissions`: Array of `{ version, content, submittedAt, aiReport }`
5. **`issues`**: Doubts and resolution tracking.
6. **`otps`**: Temporary OTP codes with 600-second TTL index.

### Live Inspection Commands via `mongosh`
To inspect the database in PowerShell or terminal:

1. **View Users (Showing Internal, External, and Faculty separation):**
```bash
mongosh "collaborative_pms" --eval "db.users.find({}, {fullName: 1, role: 1, studentType: 1, registerNumber: 1, email: 1})"
```

2. **View Teams (Showing the Mixed Collaboration flag):**
```bash
mongosh "collaborative_pms" --eval "db.teams.find({}, {name: 1, isMixedTeam: 1, collaborationConfirmed: 1})"
```

3. **View Projects & Active/Frozen Participation:**
```bash
mongosh "collaborative_pms" --eval "db.projects.find({}, {title: 1, status: 1, participatingMembers: 1})"
```

---

# 8. API and Route Specifications

| Method | Endpoint | Access Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/auth/login` | Public | Sign-in page |
| `POST`| `/auth/login` | Public | Authenticates credentials, sets session, redirects by role |
| `GET` | `/auth/student-register` | Public | Student registration page |
| `POST`| `/auth/student-register` | Public | Validates student data (internal/external), creates account |
| `GET` | `/auth/faculty-register` | Public | Faculty registration page |
| `POST`| `/auth/faculty-register` | Public | Validates faculty details (capacity 2-7), creates account |
| `POST`| `/auth/send-otp` | Public | Generates 6-digit OTP, saves in MongoDB |
| `POST`| `/auth/check-student` | Authenticated | Look up registered student profile by username |
| `GET` | `/student/dashboard` | `isStudent` | Student profile, team overview, assigned tasks |
| `GET` | `/student/select-faculty` | `isStudent` | Faculty directory with capacity slot indicators |
| `POST`| `/student/select-faculty` | `isStudent` | Registers student under a faculty guide |
| `GET` | `/student/create-team` | `isStudent` | Team creation form |
| `POST`| `/student/create-team` | `isStudent` | Validates team bounds, mixed collaboration checkbox, creates team |
| `POST`| `/student/leave-team` | `isStudent` | Leave team (allowed only if project completed) |
| `GET` | `/faculty/dashboard` | `isFaculty` | Faculty stats, active guided teams, project assignment |
| `POST`| `/faculty/assign-project` | `isFaculty` | Directly assigns academic project to guided team (`APPROVED` status) |
| `POST`| `/faculty/project/:projectId/update` | `isFaculty` | Updates assigned project title and description scope |
| `POST`| `/faculty/proposal-decision` | `isFaculty` | Approve, reject, or request proposal revisions (legacy support) |
| `POST`| `/faculty/evaluate-project` | `isFaculty` | Grade project (score 0-100, remarks) & archive |
| `GET` | `/project/:id/workspace` | Authenticated | Project workspace: overview, members, tasks, issues |
| `POST`| `/project/propose` | `isStudent` | Propose new project for active team |
| `POST`| `/project/:id/toggle-participation` | Authenticated | Toggle student status between `ACTIVE` and `FROZEN` |
| `POST`| `/project/:id/create-task` | Authenticated | Create task with dependency reference |
| `POST`| `/project/task/:taskId/status` | Authenticated | Move task status; blocks if dependencies incomplete |
| `POST`| `/project/task/:taskId/submit` | Authenticated | Submit deliverable; increments version (`v1`, `v2`) with AI report |
| `POST`| `/project/:id/create-issue` | Authenticated | Log new issue/doubt |
| `POST`| `/project/issue/:issueId/resolve` | Authenticated | Mark issue resolved with resolution notes |

---

# 9. Automated Test Suite & Audit Results

Running `npm test` executes [`tests/validation.test.js`](file:///d:/dev/Collaborative%20Project%20Management%20System/tests/validation.test.js):

```text
======================================================
 Starting CPMS Validation & Business Rules Audit Test 
======================================================

  ✔ PASS: 1. Valid Internal student registration succeeds
  ✔ PASS: 2. Internal registration without Register Number fails
  ✔ PASS: 3. Valid External registration without Register Number succeeds
  ✔ PASS: 4. Duplicate Internal Register Number fails
  ✔ PASS: 5. Faculty capacity below 2 fails
  ✔ PASS: 6. Faculty capacity above 7 fails
  ✔ PASS: 7. Valid faculty registration with capacity between 2 and 7 succeeds
  ✔ PASS: 8. Team size 0 is rejected
  ✔ PASS: 9. Duplicate team name under same faculty (case-insensitive) fails
  ✔ PASS: 10. Team size 10 is rejected (max limit is 9)
  ✔ PASS: 11. Internal registration with non-VIT student domain is rejected
  ✔ PASS: 12. External registration with VIT institutional domain is rejected
  ✔ PASS: 13. Password and Confirm Password mismatch is rejected

------------------------------------------------------
 Summary: 13 Passed, 0 Failed
------------------------------------------------------
```

---

# 10. End-to-End Demonstration Script for Faculty / Viva

When demonstrating the project to your faculty ("Mam"), follow this 5-minute walkthrough:

### Step 1: Explain the Architecture & Running Server
- Explain that the server is built on **Node.js, Express, MongoDB (Mongoose), EJS, and Bootstrap 5**.
- Show the terminal running `node server.js` on `http://localhost:3000`.

### Step 2: Demonstrate Student Registration & Conditional Fields
1. Navigate to `http://localhost:3000/auth/student-register`.
2. Toggle between **Internal Student** and **External Student**:
   - Highlight how **Register Number** appears only for Internal students and is strictly required.
   - For External students, Register Number hides and is optional.
   - Point out the domain hint: Internal requires `@vitstudent.ac.in`; External rejects it.
3. Click **Send OTP** to show real-time email verification code generation.

### Step 3: Demonstrate Login & Role Routing
1. Go to `http://localhost:3000/auth/login`.
2. Log in with Student credentials:
   - Username: `rahul21` | Password: `password123`
   - Notice the automatic redirect to the **Student Dashboard**.
3. Log out and log in with Faculty credentials:
   - Username: `drpriya` | Password: `password123`
   - Notice the automatic redirect to the **Faculty Dashboard** showing team capacity and review queues.

### Step 4: Demonstrate the Mandatory Collaboration Checkbox
1. Log in as `ananya21` (or `rahul21`) and open `http://localhost:3000/student/create-team`.
2. Add teammate `alex_external` (who is an External student).
3. Show the dynamic warning callout that instantly appears on screen with the required declaration:
   > *"This team is a collaboration between Internal and External students."*
4. Explain to your teacher that the backend strictly rejects team creation if this checkbox is unchecked when internal and external students collaborate!

### Step 5: Show the Live MongoDB Database
Open **MongoDB Compass** or terminal `mongosh`:
```bash
mongosh "collaborative_pms" --eval "db.users.find({}, {fullName: 1, role: 1, studentType: 1, registerNumber: 1, email: 1})"
```
Point out:
- `Dr. Priya Raman` with role `FACULTY` and capacity `4`.
- `Rahul Sharma` with `INTERNAL` student type and register number `21BCE1001`.
- `Alex Vance` with `EXTERNAL` student type and no register number.
- Show the `teams` collection having `isMixedTeam: true` and `collaborationConfirmed: true`.
