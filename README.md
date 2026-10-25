# Collaborative Project Management System (CPMS)

An academic project and team lifecycle management platform built with **Node.js, Express, MongoDB/Mongoose, EJS, Bootstrap 5, and jQuery**.

## Key Highlights & Form Validations

- **Role-Based Workflows**: Tailored student and faculty dashboards.
- **Dual Student Registration**:
  - **Internal Student**: Mandatory Register Number, verified `@vitstudent.ac.in` email.
  - **External Student**: Register Number hidden and optional, personal email validation (strictly excludes VIT domains).
- **Faculty Capacity Enforced**: Team capacity strictly constrained between **2 and 7**.
- **Interactive Mixed Collaboration Checkbox**: Mandatory confirmation checkbox required when a team blends Internal and External members:
  > *"This team is a collaboration between Internal and External students."*
- **Team Size Bounds**: Enforced between 1 and 9 members.
- **MongoDB Direct Inspection**: Structured schemas ready for live demonstration in MongoDB Compass / `mongosh`.

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Community Server (Running on `localhost:27017`)

### Installation & Run
```bash
npm install
npm run dev
# Or start server:
npm start
```
Default URL: `http://localhost:3000`
