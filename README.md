# Collaborative Project Management System (CPMS)

An academic project and team lifecycle management platform built with **Node.js, Express, MongoDB/Mongoose, EJS, Bootstrap 5, and jQuery**.

> 📖 **Comprehensive System Documentation:** For full architecture, 30-point workflow specifications, form validation matrices, and viva presentation scripts, see [DOCUMENTATION.md](./DOCUMENTATION.md).

---

## Key Highlights & Form Validations

- **Role-Based Workflows**: Tailored student and faculty dashboards with role protection.
- **Dual Student Registration**:
  - **Internal Student**: Mandatory Register Number, verified `@vitstudent.ac.in` institutional email.
  - **External Student**: Register Number hidden and optional, personal email validation (strictly excludes VIT domains `@vitstudent.ac.in` and `@vit.ac.in`).
- **Faculty Capacity Enforced**: Team capacity strictly constrained between **2 and 7**.
- **Interactive Mixed Collaboration Checkbox**: Mandatory confirmation checkbox required when a team blends Internal and External members:
  > *"This team is a collaboration between Internal and External students."*
- **Team Size Bounds**: Enforced strictly between **1 and 9 members**.
- **Project Workspace & Deliverables**: Sequential status pipeline (`TODO` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `COMPLETED`), dependency validation, deliverable versioning (`v1`, `v2`), and AI verification reports.
- **MongoDB Direct Inspection**: Structured schemas and indexes ready for live demonstration in MongoDB Compass or `mongosh`.

---

## Demo Test Credentials

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Faculty Guide** | `drpriya` | `password123` | Capacity: 4 teams |
| **Faculty Guide** | `drsuresh` | `password123` | Capacity: 5 teams |
| **Internal Student** | `rahul21` | `password123` | Reg No: `21BCE1001`, Email: `@vitstudent.ac.in` |
| **Internal Student** | `ananya21` | `password123` | Reg No: `21BCE1045`, Email: `@vitstudent.ac.in` |
| **External Student** | `alex_external` | `password123` | Email: `@gmail.com`, No Register No |

---

## Quick Start Guide

### Prerequisites
- Node.js (v18+)
- MongoDB Community Server (Running on `mongodb://127.0.0.1:27017`)

### 1. Installation
```bash
npm install
```

### 2. Seed Initial Database
Populate faculty, students, sample teams, and project workspaces into MongoDB:
```bash
npm run seed
```

### 3. Run Automated Validation Test Suite
Verify all 13 positive and negative validation assertions:
```bash
npm test
```

### 4. Start Server
```bash
npm start
# Or with auto-reload:
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## MongoDB Inspection Commands (For Faculty / Mam)

Run in PowerShell or terminal to inspect the database:

```bash
# View users and separated student types
mongosh "collaborative_pms" --eval "db.users.find({}, {fullName: 1, role: 1, studentType: 1, registerNumber: 1, email: 1})"

# View teams with the collaborationConfirmed flag
mongosh "collaborative_pms" --eval "db.teams.find({}, {name: 1, isMixedTeam: 1, collaborationConfirmed: 1})"
```
