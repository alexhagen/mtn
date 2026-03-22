# Self-Hosting MTN

This guide explains how to run MTN with your own local Supabase instance using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mtn.git
cd mtn
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local Supabase configuration:

```bash
# For local self-hosted setup
VITE_SUPABASE_URL=http://localhost:3000
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_STORAGE_MODE=cloud
VITE_CORS_PROXY_URL=https://your-worker.workers.dev
```

### 3. Start Supabase Services

```bash
docker compose up -d
```

This will start:
- **Postgres** (port 5432): Database with Supabase extensions
- **GoTrue** (port 9999): Authentication server
- **PostgREST** (port 3000): REST API

### 4. Run Database Migrations

The migrations will run automatically when Postgres starts (via the `docker-entrypoint-initdb.d` volume mount). If you need to run them manually:

```bash
docker exec -i mtn-postgres psql -U postgres -d postgres < supabase/migrations/20260321_initial_schema.sql
```

### 5. Install Dependencies and Start Web App

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Configuration

### OAuth Providers

To enable OAuth sign-in (Google, GitHub, Apple), you need to:

1. Create OAuth apps with each provider
2. Add the credentials to your `.env.local` or `docker-compose.yml`

Example for Google:

```yaml
# In docker-compose.yml, under the 'auth' service environment:
GOTRUE_EXTERNAL_GOOGLE_ENABLED: true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: your-google-client-id
GOTRUE_EXTERNAL_GOOGLE_SECRET: your-google-secret
```

Or use environment variables:

```bash
# .env.local
GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_SECRET=your-google-secret
```

### JWT Secret

Generate a secure JWT secret (at least 32 characters):

```bash
openssl rand -base64 32
```

Add it to your environment:

```bash
JWT_SECRET=your-generated-secret
```

### Database Password

Change the default Postgres password:

```bash
POSTGRES_PASSWORD=your-secure-password
```

## Accessing Services

- **Web App**: http://localhost:5173
- **PostgREST API**: http://localhost:3000
- **GoTrue Auth**: http://localhost:9999
- **Postgres**: localhost:5432

## Database Management

### Connect to Postgres

```bash
docker exec -it mtn-postgres psql -U postgres -d postgres
```

### View Tables

```sql
\dt
```

### Check RLS Policies

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

### Backup Database

```bash
docker exec mtn-postgres pg_dump -U postgres postgres > backup.sql
```

### Restore Database

```bash
docker exec -i mtn-postgres psql -U postgres -d postgres < backup.sql
```

## Troubleshooting

### Services Won't Start

Check logs:

```bash
docker compose logs -f
```

### Authentication Not Working

1. Verify GoTrue is running: `curl http://localhost:9999/health`
2. Check JWT secret matches between GoTrue and PostgREST
3. Ensure OAuth redirect URIs match your site URL

### Database Connection Errors

1. Check Postgres is healthy: `docker ps`
2. Verify connection string in `.env.local`
3. Ensure migrations ran successfully

### CORS Issues

If you're running the web app on a different port or domain, update the `GOTRUE_URI_ALLOW_LIST` in `docker-compose.yml`.

## Stopping Services

```bash
docker compose down
```

To remove volumes (deletes all data):

```bash
docker compose down -v
```

## Production Deployment

For production self-hosting:

1. Use a reverse proxy (nginx, Caddy) with SSL
2. Set strong passwords and JWT secrets
3. Configure proper OAuth redirect URIs
4. Set up regular database backups
5. Use Docker secrets or a secrets manager for sensitive values
6. Configure firewall rules to restrict database access

Example nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name mtn.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://localhost:9999/;
        proxy_set_header Host $host;
    }

    location /rest/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
    }
}
```

## Updating

To update your self-hosted instance:

```bash
git pull origin main
npm install
docker compose pull
docker compose up -d
```

Run any new migrations:

```bash
docker exec -i mtn-postgres psql -U postgres -d postgres < supabase/migrations/new_migration.sql
```

## Support

For issues with self-hosting, please open an issue on GitHub: https://github.com/yourusername/mtn/issues
