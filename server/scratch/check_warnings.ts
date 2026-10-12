import { db } from '../src/db/client';
db.query("SELECT * FROM scan_logs WHERE level = 'warn' ORDER BY created_at DESC LIMIT 5").then(res => {
  console.dir(res.rows, {depth: null});
  process.exit(0);
});
