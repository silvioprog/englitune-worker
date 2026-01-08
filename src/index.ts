import { Hono } from "hono";
import { cors } from "hono/cors";
import validators from "./validators";
import getRandomTranscriptsWithSpeaker from "./queries";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", (c, next) => {
  return cors({
    origin: c.env.CORS_ORIGIN,
    allowMethods: ["GET", "OPTIONS"]
  })(c, next);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/favicon.ico", (c) => {
  return c.body(null, 204, {
    "Cache-Control": "public, max-age=604800, immutable"
  });
});

app.get("/", validators, async (c) => {
  return c.json(
    await getRandomTranscriptsWithSpeaker({
      db: c.env.DB,
      ...c.req.valid("query")
    })
  );
});

export default app;
