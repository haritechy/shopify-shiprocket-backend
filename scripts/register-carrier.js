'use strict';
// Backward-compatible alias: create or update safely instead of creating duplicates.
require('dotenv').config();
require('./sync-carrier').syncCarrier().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
