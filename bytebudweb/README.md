# ByteBud

ByteBud is a React storefront with a Node.js/Express API and MongoDB Atlas database.

## Run locally

Install the frontend dependencies from the project root and start Vite:

```powershell
npm install
npm run dev
```

Configure the backend in `server/.env` (keep this file private):

```dotenv
MONGODB_URI=mongodb+srv://<database-user>:<password>@<cluster-host>/<database-name>
JWT_SECRET=<long-random-secret>
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
```

Then install and start the backend from `server/`:

```powershell
cd server
npm install
npm run seed
npm run dev
```

`npm run seed` can also be run from the project root; it forwards the command to `server/`.
The seed creates the demo admin, partner-school lookup records, courses, laptop models, a demo acquisition, and demo laptop units. The sample acquisition costs are zero and are not real financial data.

## Data model

`server/models.js` defines the MongoDB collections and embedded objects from the ByteBud ERD:

- `users`, `student_verifications`, and `password_resets`
- `suppliers`, `acquisitions`, `laptop_models`, `units`, and `courses`
- `carts`, `orders`, `warranties`, and `audit_logs`

The ERD's named IDs are stored as MongoDB `_id` values. References use ObjectIds, and nested structures such as laptop specs, order items, inspections, and warranty claims are embedded documents.

The `schools` collection is a backend helper for checking partner school email domains; it is not shown in the supplied ERD. The API implements authentication, session, and public home-catalog read routes. The storefront loads courses and listed units from that catalog route. Cart, order, password-reset, warranty, acquisition-management, and audit workflows have schemas but do not yet have API routes.
