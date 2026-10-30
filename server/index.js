'use strict';
// Local development entry. On Vercel the app is exported via api/index.js instead.
const app = require('./app');
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Art4Print running → http://localhost:${PORT}`));
