# ImmoPi - Dual Environment Setup (Production + Test)

**Goal:** Run two completely separate ImmoPi instances (Production + Test) from a single codebase with minimal complexity.

---

## Architecture Overview

```
+-------------------+     +-------------------+
|   Production      |     |     Test          |
|   Port: 8000      |     |     Port: 8001     |
+--------+----------+     +--------+----------+
         |                         |
         v                         v
+-------------------------------+
|        Shared Codebase         |
|   (Node.js/Express + SQLite)  |
+-------------------------------+
         |                         |
         v                         v
+-------------------+     +-------------------+
| production.db     |     | test.db           |
+-------------------+     +-------------------+
```

- **Single codebase** - Both environments use the same source files
- **Separate SQLite files** - `databases/production.db` and `databases/test.db`
- **Environment detection** - Via `NODE_ENV` variable (`production` or `test`)
- **No data migration** - Just separate instances running simultaneously

---

## Configuration Strategy

- **Ports**: Production = 8000, Test = 8001
- **Database paths**: 
  - Production: `./databases/production.db`
  - Test: `./databases/test.db`
- **Environment variable**: `NODE_ENV=production` or `NODE_ENV=test`
- **Optional DNS**: Add `test.<ip>` to `/etc/hosts` pointing to same IP

---

## Implementation Phases

### Phase 1: Environment Configuration
- [ ] Create `databases/` directory
- [ ] Create empty `databases/production.db` (copy existing if needed)
- [ ] Create empty `databases/test.db`
- [ ] Add `databases/` to `.gitignore`
- [ ] Modify app to read `process.env.NODE_ENV` (default: `production`)
- [ ] Modify database connection to use:
  - `./databases/production.db` when `NODE_ENV=production`
  - `./databases/test.db` when `NODE_ENV=test`
- [ ] Modify Express server to use:
  - Port `8000` when `NODE_ENV=production`
  - Port `8001` when `NODE_ENV=test`

### Phase 2: Start/Stop Scripts
- [ ] Create `scripts/` directory
- [ ] Create `scripts/start_prod.sh`:
  ```bash
  #!/bin/bash
  export NODE_ENV=production
  node src/server.js
  ```
- [ ] Create `scripts/stop_prod.sh`:
  ```bash
  #!/bin/bash
  pkill -f "NODE_ENV=production.*node src/server.js"
  ```
- [ ] Create `scripts/start_test.sh`:
  ```bash
  #!/bin/bash
  export NODE_ENV=test
  node src/server.js
  ```
- [ ] Create `scripts/stop_test.sh`:
  ```bash
  #!/bin/bash
  pkill -f "NODE_ENV=test.*node src/server.js"
  ```
- [ ] Make all scripts executable: `chmod +x scripts/*.sh`

### Phase 3: Package.json Scripts (Optional)
- [ ] Add to `package.json`:
  ```json
  "scripts": {
    "start:prod": "NODE_ENV=production node src/server.js",
    "start:test": "NODE_ENV=test node src/server.js",
    "stop:prod": "pkill -f 'NODE_ENV=production.*node src/server.js'",
    "stop:test": "pkill -f 'NODE_ENV=test.*node src/server.js'"
  }
  ```

### Phase 4: DNS Configuration (Optional)
- [ ] Add to development machine's `/etc/hosts`:
  ```
  192.168.1.100 test.192.168.1.100
  ```
- [ ] Test server accessible at both `http://192.168.1.100:8001` and `http://test.192.168.1.100:8001`

### Phase 5: Verification
- [ ] Start production: `./scripts/start_prod.sh` and verify at `http://<ip>:8000`
- [ ] Start test: `./scripts/start_test.sh` and verify at `http://<ip>:8001`
- [ ] Insert test data in test server and verify it does NOT appear in production
- [ ] Verify production data remains intact when test server is running
- [ ] Test stop scripts for both environments

---

## File Changes Summary

**New Files:**
- `databases/production.db`
- `databases/test.db`
- `scripts/start_prod.sh`
- `scripts/stop_prod.sh`
- `scripts/start_test.sh`
- `scripts/stop_test.sh`

**Modified Files:**
- `src/server.js` (or main entry point) - Read `NODE_ENV` and set port/DB path
- Database connection file(s) - Use environment-specific DB path
- `.gitignore` - Add `databases/`
- `package.json` (optional) - Add start/stop scripts

**Total:** ~4-6 files modified, ~4-6 files created

---

## Usage After Implementation

```bash
# Start production server
./scripts/start_prod.sh

# Stop production server
./scripts/stop_prod.sh

# Start test server
./scripts/start_test.sh

# Stop test server
./scripts/stop_test.sh

# Or using npm (if package.json scripts added)
npm run start:prod
npm run start:test
```

---

## Completion Criteria

- [ ] Production server runs independently on port 8000
- [ ] Test server runs independently on port 8001
- [ ] Both servers use separate SQLite database files
- [ ] Production data remains isolated from test operations
- [ ] Test server can be started/stopped without affecting production
- [ ] All start/stop scripts work correctly
