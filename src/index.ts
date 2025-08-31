import { getParams, ParamsError } from "./params";
import { getRandomTranscriptsWithSpeaker } from "./queries";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    try {
      const { isFavicon, limit, excluded } = getParams(request);
      if (isFavicon) {
        return new Response(null, {
          headers: { "Cache-Control": "public, max-age=604800, immutable" },
          status: 204
        });
      }
      return Response.json(
        await getRandomTranscriptsWithSpeaker(env.DB, limit, excluded)
      );
    } catch (error) {
      if (error instanceof ParamsError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      console.error(error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }
} satisfies ExportedHandler<Env>;
