# Nixyah — Setup & Run Guide

## 🚀 Quick Start

### 1️⃣ **Backend API** (Node.js + Neon PostgreSQL)

```bash
# Terminal 1 — Start Backend Server
cd /Users/macbookpro/Downloads/Ivory-Diaspora
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pnpm --filter @workspace/api-server dev
# Listens on http://localhost:3333/api
```

### 2️⃣ **Mobile App** (Expo + React Native)

```bash
# Terminal 2 — Start Expo Dev Server
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd artifacts/mobile
export $(cat ../../.env | grep EXPO_PUBLIC)
pnpm exec expo start
```

#### Test the app:
- **Web browser**: Press `w` in Expo terminal → http://localhost:8081
- **iOS Simulator**: Press `i` in Expo terminal
- **Android Emulator**: Press `a` in Expo terminal
- **Real Device**: Scan the QR code with Expo Go app

---

## 📋 Prerequisites

- **Node.js**: v20.19.4+ (managed by nvm)
- **pnpm**: v10.32.1+ (installed via corepack)
- **Neon Account**: PostgreSQL database URL in `.env`

---

## ⚙️ Configuration

### `.env` File (Workspace Root)

Create a `.env` file at the repository root with:

```dotenv
# Neon PostgreSQL Connection
DATABASE_URL=postgresql://user:password@host/database?sslmode=require&channel_binding=require

# Backend Server
PORT=3333
JWT_SECRET=your_secret_key

# Expo Mobile API URL
EXPO_PUBLIC_API_URL=http://localhost:3333/api
```

**Note**: The `.env` file is auto-loaded by:
- Backend (via `dotenv` in `artifacts/api-server/src/index.ts`)
- Mobile (manually sourced before running Expo)

---

## 🗄️ Database Setup

### Create Database Schema

```bash
# Run Drizzle migrations to Neon
cd /Users/macbookpro/Downloads/Ivory-Diaspora
export DATABASE_URL='your_actual_neon_url_here'
pnpm --filter @workspace/db push
```

### Seed Sample Data (Optional)

```bash
pnpm --filter @workspace/api-server run seed
```

---

## 🧪 Test Endpoints

### Register a Client

```bash
curl -X POST http://localhost:3333/api/auth/register/client \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "location": "Abidjan"
  }'
```

### Register a Chef

```bash
curl -X POST http://localhost:3333/api/auth/register/chef \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chef Marie",
    "email": "marie@example.com",
    "password": "password123",
    "specialty": "Cuisine Ivoirienne",
    "location": "Abidjan",
    "zone": "Plateau",
    "bio": "Chef passionnée",
    "priceRange": "5000-15000 CFA"
  }'
```

### Get All Chefs

```bash
curl http://localhost:3333/api/chefs
```

### Get Stories

```bash
curl http://localhost:3333/api/stories
```

### Health Check

```bash
curl http://localhost:3333/api/healthz
```

---

## 📁 Project Structure

```
Ivory-Diaspora/
├── artifacts/
│   ├── api-server/        # Express.js backend
│   │   └── src/
│   │       ├── index.ts   # Entry + dotenv loading
│   │       ├── server.ts  # Server startup
│   │       ├── app.ts     # Express app + CORS
│   │       └── routes/    # Auth, chefs, stories, orders, chats
│   └── mobile/            # React Native + Expo
│       └── constants/
│           └── api.ts     # API client with base URL
├── lib/
│   ├── db/                # Drizzle ORM + Neon connection
│   ├── api-client-react/  # Shared API client
│   └── api-zod/           # Zod validation schemas
├── .env                   # ← Main config file (auto-loaded by backend + manually by Expo)
├── .env.example           # Template
├── .env.local             # Local overrides (optional, not used if .env exists)
└── pnpm-workspace.yaml    # Monorepo root
```

---

## 🛠️ Troubleshooting

### Backend fails to start: "DATABASE_URL must be set"
- Verify `.env` exists at repository root with valid `DATABASE_URL`
- Restart the backend after updating `.env`

### Mobile can't fetch chefs: "Network request failed"
- Verify backend is running: `curl http://localhost:3333/api/healthz`
- Ensure `EXPO_PUBLIC_API_URL=http://localhost:3333/api` is set
- For real devices, replace `localhost` with your machine's IP (e.g., `http://192.168.1.42:3333/api`)

### Package version mismatch warning
- `react-native-keyboard-controller@1.20.7` vs expected `1.18.5` — safe to ignore for dev

---

## 📝 Common Commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Type check all | `pnpm run typecheck` |
| Build all | `pnpm run build` |
| Lint backend | `tsc -p artifacts/api-server` |
| Start backend | `pnpm --filter @workspace/api-server dev` |
| Start mobile | `cd artifacts/mobile && pnpm exec expo start` |
| Push DB migrations | `pnpm --filter @workspace/db push` |

---

## 📱 Testing Checklist

- [ ] Backend running on port 3333
- [ ] `/api/healthz` responds with `{"status":"ok"}`
- [ ] Mobile app connects to backend URL
- [ ] Client registration works (`/auth/register/client`)
- [ ] Chef registration works (`/auth/register/chef`)
- [ ] Chefs list loads (`/chefs`)
- [ ] Stories load (`/stories`)

---

## 💡 Notes

- **CORS**: Enabled on all routes via `app.use(cors())` in `src/app.ts`
- **JWT**: Used for auth (`Authorization: Bearer <token>`)
- **SSL Mode**: Neon requires `sslmode=require&channel_binding=require`
- **Environment**: Set all `EXPO_PUBLIC_*` variables before running Expo
