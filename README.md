# Rank2Campus
Rank2Campus is a full-stack admission counselling and seat-allocation platform that supports student onboarding, document verification, college discovery, rank prediction, preference management, and admin-driven allocation workflows.

## Stack
- Frontend: React + Vite + React Router
- Backend: Node.js + Express + Mongoose
- Database: MongoDB (local or Atlas)
- Auth: JWT + bcrypt
- File upload: Multer
- AI counsellor: Gemini API (optional)

## Features
- Student registration and secure login
- Sign-up validates full name, Indian mobile number, email address, and password; sign-in uses email and password
- Student profile completion tracking
- College and branch discovery
- Rank prediction using historical cutoff data
- Preference saving and locking for an active admission round
- Document upload and admin review workflow
- Notifications for students and admins
- Admin dashboard and seat allocation engine
- Authenticated student/admin document downloads
- Bulk cutoff CSV import with row validation
- Admin historical cutoff library with filters, paging, and CSV export
- Student read-only cutoff history with rank comparison
- Student allocation offer acceptance and decline
- Floating Gemini AI advisor for general questions and context-grounded Rank2Campus data
- Three-document student submission with independent administrator verification
- In-app, audience-specific announcements and per-user read status
- Backward-compatible versioned API at `/api/v1`

## Allocation and round administration
Student choices must be saved and locked for the exact admission round before allocation. Admins must close preference intake before running the merit-ordered allocation; the allocation page shows per-round locked-preference and offer counts and lists skip reasons. Rounds with allocation records cannot be deleted or reopened so their audit history is preserved. A round with no allocation records can be deleted after confirmation; its dependent preference/application records are removed with it.

Offers reserve seats while provisional or accepted. Declined offers release the reserved seat, and starting a fresh cycle clears prior seat reservations along with the cycle's student records.

Students submit the Class 10 marksheet, Class 12 marksheet, and entrance scorecard together from Documents. Administrators review each file independently and must add a reason to reject one. A rejected file requires a new complete three-document submission. The profile avatar opens the signed-in account’s profile; announcements are shown in the in-app Notifications page rather than browser alerts.

## Requirements
- Node.js 20+
- MongoDB Atlas cluster access

## Local setup
1. Copy the example env files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. In MongoDB Atlas, create a database user and allow the machine or hosting service IP in Network Access. Copy the cluster connection string into `MONGODB_URI` in `backend/.env`; the application uses the `rank2campus` database. In Compass, open `rank2campus` rather than the URI's default `test` database. Do not share or commit the URI.
3. Set `JWT_SECRET` and the admin credentials in `backend/.env`.
4. Install dependencies and start the project:
   ```bash
   npm install
   npm run seed
   npm run dev
   ```
   This runs both the backend and frontend together.

Run backend API and validation tests with `npm test`. Admins can upload, browse, filter, and export historical cutoff records at `/admin/cutoffs/import`; students can browse and compare cutoffs from Cutoff history. The CSV required columns are `collegeCode`, `branchCode`, `year`, `category`, and `closingRank`. `collegeName`, `location`, `branchName`, `examName`, `round`, and `openingRank` are optional. Historical imports do not require a matching active college or branch; matching catalog branches are linked automatically, while unmatched rows retain their supplied codes and names as snapshots. Category labels are normalized (`GENERAL`/`GEN`/`UR` to `OPEN`, and `OBC` to `OBC-NCL`); supported groups are OPEN, EWS, OBC-NCL, SC, and ST. The floating AI adviser uses `GEMINI_API_KEY` and `GEMINI_MODEL` from `backend/.env`; it can answer general questions and uses stored Rank2Campus data for platform-specific answers.

## Manual run
Backend:
```bash
cd backend
npm install
npm run seed
npm run dev
```
Frontend:
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Health: http://localhost:5000/api/health
- Versioned health: http://localhost:5000/api/v1/health

## Demo login
The seed script creates an admin user from `backend/.env` values:
- Email: `SEED_ADMIN_EMAIL`
- Password: `SEED_ADMIN_PASSWORD`

Change these credentials before using the app in a real environment.

The backend requires `MONGODB_URI` in every environment and will not fall back to a local database. For production, also set `NODE_ENV=production`, a unique `JWT_SECRET` of at least 32 characters, and `CLIENT_URL`.

## Important notice
- Seeded data is demo-only and should not be used as official admission data.
- The rank predictor is advisory and cannot guarantee admission outcomes.
