// config/db.js
const oracledb = require("oracledb");

// Optional: point to Instant Client if you installed it separately
if (process.env.ORACLE_CLIENT_DIR) {
  oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_DIR });
}

// Create the pool immediately, but expose it via a promise to avoid race conditions
const poolPromise = (async () => {
  const pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectString: process.env.DB_CONNECT || "localhost:1521/FREEPDB1",
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
    stmtCacheSize: 50,
    queueTimeout: 10000, // ms to wait for a free connection
    homogeneous: true,
  });

  // Health check
  const conn = await pool.getConnection();
  await conn.execute("SELECT 1 FROM dual");
  await conn.close();
  console.log("Database connected");

  return pool;
})().catch((err) => {
  console.error("Database connection failed:", err.message || err);
  // Re-throw so callers awaiting getPool/execute see the error
  throw err;
});

// Helper to run a statement with binds
async function execute(sql, binds = {}, options = {}) {
  const pool = await poolPromise;
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: false, // set true per-call for DML when you want
      ...options,
    });
    return result;
  } finally {
    await conn.close();
  }
}

// Expose the pool (promise) if you need direct access
function getPool() {
  return poolPromise;
}

// Graceful shutdown
async function close() {
  const pool = await poolPromise;
  await pool.close(0);
}

process.on("SIGINT", async () => {
  try {
    await close();
    console.log("Oracle pool closed");
    process.exit(0);
  } catch (e) {
    console.error("Error closing Oracle pool", e);
    process.exit(1);
  }
});

module.exports = { execute, getPool, close, oracledb };
