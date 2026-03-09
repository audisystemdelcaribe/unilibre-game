import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Estado de comodines usados en una ronda.
 * - used: metadata por pregunta actual (ej. 50:50 hide_ids)
 * - used_in_round: códigos de comodines ya usados en la sesión (para mostrar inactivos)
 */
export const GET: APIRoute = async ({ url }) => {
    const roundId = url.searchParams.get("round_id");
    const questionId = url.searchParams.get("question_id");
    if (!roundId) {
        return new Response(JSON.stringify({ error: "round_id requerido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const rId = parseInt(roundId);
    const qId = questionId ? parseInt(questionId) : null;

    // Comodines usados en toda la ronda (para mostrar inactivos al estudiante)
    const { data: roundUsage } = await supabaseAdmin
        .from("round_lifeline_usage")
        .select("lifeline_code")
        .eq("round_id", rId);
    const used_in_round = [...new Set((roundUsage || []).map((r) => r.lifeline_code))];

    // Metadata para la pregunta actual (ej. 50:50 hide_ids)
    let used: Record<string, unknown> = {};
    if (qId) {
        const { data: qUsage } = await supabaseAdmin
            .from("round_lifeline_usage")
            .select("lifeline_code, metadata")
            .eq("round_id", rId)
            .eq("question_id", qId);
        (qUsage || []).forEach((r) => {
            used[r.lifeline_code] = r.metadata || true;
        });
    }

    return new Response(JSON.stringify({ used, used_in_round }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
