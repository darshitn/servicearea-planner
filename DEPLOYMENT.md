# Atlas and Render deployment

Use this walkthrough after the source changes have been pushed and the local two-account browser walkthrough has passed.

## 1. Configure MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with a strong password and read/write access to the `servicearea_planner` database. This is a separate account from your Atlas management login.
3. Copy the driver connection string. Include `servicearea_planner` as the database name. URI-encode special characters in the database password.
4. Under Network Access, allow the hosting service's documented outbound addresses. Add your own current address separately only if you are connecting locally.
5. Keep the connection string in secret environment settings. Do not paste it into GitHub, screenshots, or chat.

## 2. Create the hosted Node service

1. In Render, select New, Web Service, and connect your GitHub repository through Git Provider. Private repositories are supported.
2. Select the branch containing the verified changes and the Node runtime.
3. Set the build command to `npm ci --include=dev && npm run build`.
4. Set the start command to `npm start`.
5. Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `MONGODB_URI` to the secret Atlas connection string. The repository pins Node 24.21.0 in `.node-version`. An existing Render `NODE_VERSION` overrides this file, so remove that override or set it to `24.21.0`.
6. Set `APP_ORIGIN` to the exact generated HTTPS origin, without a trailing slash. If the URL is assigned after creation, add this value and redeploy before testing account actions.
7. Verify the proxy topology with the host's documentation/support, then set `TRUST_PROXY` to the appropriate trusted IP ranges or hop count. This determines which client IP the login limiter uses. A hop count of `1` is appropriate only when every inbound request reaches Express through exactly one trusted proxy. A blanket `true` is rejected.
8. Let the host provide `PORT`. Set the health-check path to `/api/health`.

The application uses one origin for React and Express. It does not require a separate static-site deployment. Login cookies require HTTPS in production.

## 3. Acceptance checks

1. Open the HTTPS URL and create a coordinator account and team.
2. Log out, refresh, and verify the dashboard stays inaccessible until login.
3. Log in again, create a technician invitation, and open it in a separate browser profile.
4. Register the technician. In the coordinator's existing window, open New work order and verify the new technician appears without reloading.
5. Assign a visit and verify the technician can update its status and completion notes, while creating, deleting and reassigning are denied.
6. Create a second coordinator/team and verify its schedule is separate.
7. Verify an invitation cannot be used twice, and that a blocked cross-origin request cannot change data.
8. Restart/redeploy the service and verify accounts, visits and login attempt limits persist.
9. Check the interface on a phone. Keep a local demonstration available for presentation.

## Operations

Choose an appropriate backup plan for the Atlas tier you select and verify how to restore it before storing real customer records. The current version has no email verification, self-service password recovery, member removal or invitation revocation. Use a controlled demonstration with fictional records until those operations are addressed.

## Official references

- [Render Express deployment](https://render.com/docs/deploy-node-express-app)
- [Render web services](https://render.com/docs/web-services)
- [Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Express trusted proxy configuration](https://expressjs.com/en/guide/behind-proxies/)
