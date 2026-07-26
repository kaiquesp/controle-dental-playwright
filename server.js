/**
 * Ponto de entrada para hospedagem Node (Hostinger, etc.).
 * Repassa para o dashboard E2E em scripts/e2e-dashboard/server.mjs
 */
import('./scripts/e2e-dashboard/server.mjs')
  .then(({ startDashboard }) => startDashboard())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
