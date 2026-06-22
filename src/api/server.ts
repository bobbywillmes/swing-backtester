import { createApiApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApiApp();

app.listen(port, () => {
  console.log(`Swing Backtester API listening on http://127.0.0.1:${port}`);
});
