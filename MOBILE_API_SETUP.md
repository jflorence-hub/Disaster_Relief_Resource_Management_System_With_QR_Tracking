# Mobile API integration notes

The Flutter apps call the Laravel API in this project and therefore read/write the same MySQL database as the Laravel/Inertia website. They do not connect directly to MySQL.

## Setup

1. Configure `.env` locally from `.env.example`; do not commit or share real credentials.
2. Ensure the database connection points to the same database used by the website.
3. Run `php artisan migrate` after backing up the database. The added migrations create family email/PIN-reset fields and family-to-admin messages.
4. Configure Laravel SMTP mail settings before using Family PIN recovery. Gmail users should use a Google App Password, not their normal account password.
5. Run the Laravel server: `php artisan serve --host=0.0.0.0 --port=8000` for local device testing.
6. Run either Flutter app with `--dart-define=API_BASE_URL=http://10.0.2.2:8000/api` on an Android emulator, or use the computer's LAN IP for a physical phone.

## Added/used API endpoints

- `POST /api/login` — staff login, returns bearer token.
- `GET /api/me`, `POST /api/logout` — authenticated staff session.
- `GET /api/puroks`, `GET /api/locations` — registration dropdowns / location list.
- `POST /api/family/register`, `POST /api/family/login` — family registration and phone/Family ID + PIN login.
- `POST /api/family/forgot-password`, `POST /api/family/reset-password` — email PIN reset code flow.
- `GET /api/family/me`, `GET /api/family/distributions` — authenticated family profile and history/schedule.
- `GET /api/family/messages`, `POST /api/family/messages` — family concerns and admin replies. Admins can view/reply on the website Messages page.
- Staff-only: `GET /api/staff/families`, `GET /api/distributions/history`, `POST /api/distributions/lookup`, `POST /api/distributions/confirm`, `POST /api/qr/lookup`, `POST /api/qr/scan`, `GET /api/qr/scans`.

## Access and important notes

- API tokens are stored hashed in the database; apps send the plain token using `Authorization: Bearer ...`.
- Staff API routes require a `staff` account with an assigned Purok, matching the existing permission middleware.
- Family reset codes expire after 10 minutes. SMTP must be configured for the code to be delivered.
- The mobile app API URLs must use the `/api` prefix. Do not use the separate React mock frontend's Vite URL as the API host.
- Back up the database before running migrations on a database containing real data.
