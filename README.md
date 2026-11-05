# ServiceArea Planner

**CIA assignment · N DARSHIT · 2102508605**

A coordinator can open a day's schedule, see which staff member is visiting each customer, and plan the route one service area at a time. Visits within an area appear in appointment order. The coordinator decides how to travel between areas.

Coordinators create a team, invite technicians and assign visits to team members. Technicians can update the status and notes of their assigned visits. Use consistent area names, since grouping uses the area field.

## Run the assignment

Install Node.js 22.12 or later. From the project folder, run the following commands.

```powershell
npm ci
npm run demo
```

Open **http://127.0.0.1:4000**. On first use, the demo downloads a MongoDB server binary. The Windows download is about 600 MB. Subsequent launches reuse the cached binary.

Create a coordinator account using **Create team**. The local database is saved in `.local/demo-data/`. Existing visits created before teams were introduced remain in the database but are not shown in team workspaces. Stop the demo with Ctrl+C.

Create a technician invitation from the dashboard and share its link. Invitations are single-use and expire after 24 hours. The technician can register through the link and then be assigned visits.

## Hosted configuration

Use a Node hosting service with HTTPS and an external MongoDB database. Set these values in the host's environment configuration:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- `MONGODB_URI`: Atlas connection string, stored as a secret
- `NODE_ENV=production`: enables secure session cookies
- `APP_ORIGIN`: the exact public HTTPS origin, without a trailing slash
- `PORT`: supplied by the host
- `HOST=0.0.0.0`: required by typical web-service hosts
- `TRUST_PROXY`: verified trusted proxy IP ranges or hop count for the chosen host. Leave unset for direct connections. Never set blindly to `true`.

The database user needs permission to create indexes and read and write application collections. The app serves React and the API from the same origin. Never commit the real connection string or `.env` file.

Email verification and password reset, member removal, invitation revocation, and real-time updates are not implemented. Authentication attempt limits are stored in MongoDB and shared across server processes. Deployment still requires verification of the host's proxy configuration and the browser workflow over HTTPS.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Atlas and hosting walkthrough.

## Demonstrate the workflow

1. Register a coordinator and open today's itinerary.
2. Select **New work order**. Enter a customer, job, address and assigned staff member. Choose an existing area and a time between two visits to see the new order inserted in the right place.
3. Edit the visit and select **Completed**. Try saving with empty completion notes, then enter the work performed and save. Filter by **Completed** to show the updated visit.
4. Move the visit to tomorrow. Switch between the dates, refresh the browser and check that the change persists. Use **Delete visit** inside the edit form to remove a work order.

## How it works

- **React** requests work orders for the selected local date. The itinerary groups area names case-insensitively, sorts visits by start time, and can filter the results by status.
- **Express** validates the complete order on creation or after a partial update. Both ends of the time window must fall on the same day, the end must be later than the start, and a completed order must include a note. Failed requests return a JSON error and an appropriate HTTP status.
- **MongoDB** stores one document per work order. The date, area and start time are indexed for the daily list. Dates use `YYYY-MM-DD` and times use 24-hour `HH:MM` so a local appointment stays on its intended day.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/health` | Checks MongoDB connectivity |
| GET | `/api/work-orders?date=2026-11-04` | Returns work orders for that date |
| POST | `/api/work-orders` | Creates a work order and returns its ID |
| PATCH | `/api/work-orders/:id` | Updates the specified fields and returns the saved order |
| DELETE | `/api/work-orders/:id` | Removes the selected order |

## Use an existing MongoDB instance

Copy `.env.example` to `.env`. Set `MONGODB_URI` to a URI that includes the database name, or supply a separate `MONGODB_DB`. The normal server defaults to a local MongoDB instance and listens on the loopback interface.

```powershell
npm run build
npm start
```

For front-end development, run `npm run api` and `npm run dev` in separate terminals. Vite prints the development URL and forwards API requests to Express. Existing standalone seed records do not belong to a team.

## Verify the implementation

```powershell
npm test
npm run build
```

The integration suite starts a separate temporary MongoDB server. It exercises the REST API over HTTP, including invalid requests, persistence across independent client connections, date filtering, ordering, repeatable seeding and deletion.

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | Daily itinerary, date navigation, status filtering and summary counts |
| `src/OrderDialog.jsx` | Create, edit, complete and delete a visit |
| `server/app.js` | REST endpoints and error handling |
| `server/work-orders.js` | Work-order validation and API representation |
| `server/start.js` | Database connection, index and HTTP server lifecycle |
| `scripts/demo.js` | Starts the disk-backed local demo |
| `tests/work-orders.test.js` | HTTP and MongoDB integration checks |
