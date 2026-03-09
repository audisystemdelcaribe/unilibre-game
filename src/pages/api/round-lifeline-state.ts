import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Estado de comodines usados en una ronda/pregunta.
 * El estudiante consulta para aplicar 50:50 (ocultar 2 respuestas).
 */
export const GET: APIRoute = async ({ url }) => {
    const roundId = url.searchParams.get("round_id");
    const questionId = url.searchParams.get("question_id");
    if (!roundId || !questionId) {
        return new Response(JSON.stringify({ error: "round_id y question_id requeridos" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data } = await supabaseAdmin
        .from("round_lifeline_usage")
        .select("lifeline_code, metadata")
        .eq("round_id", parseInt(roundId))
        .eq("question_id", parseInt(questionId));

    const used: Record<string, unknown> = {};
    (data || []).forEach((r) => {
        used[r.lifeline_code] = r.metadata || true;
    });

    return new Response(JSON.stringify({ used }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
