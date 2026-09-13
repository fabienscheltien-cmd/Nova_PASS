import { createFileRoute } from "@tanstack/react-router";
import { initialiserSuperAdmin } from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const res = await initialiserSuperAdmin();
        return new Response(JSON.stringify(res), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
