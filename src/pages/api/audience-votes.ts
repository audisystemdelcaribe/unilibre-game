import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET: Obtener votos del público para una pregunta (para mostrar gráfica de barras)
 */
export const GET: APIRoute = async ({ url, locals }) => {
    const roundId = url.searchParams.get("round_id");
    const questionId = url.searchParams.get("question_id");
    if (!roundId || !questionId) {
        return new Response(JSON.stringify({ error: "round_id y question_id requeridos" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: answers } = await supabaseAdmin
        .from("answers")
        .select("id, answer_text")
        .eq("question_id", parseInt(questionId))
        .order("id");

    const letters = ["A", "B", "C", "D"];
    const votes: Record<string, number> = {};
    letters.forEach((l, i) => { votes[l] = 0; });

    try {
        const { data: voteRows } = await supabaseAdmin
            .from("audience_lifeline_votes")
            .select("answer_id")
            .eq("round_id", parseInt(roundId))
            .eq("question_id", parseInt(questionId));

        const answerIds = (answers || []).map((a: { id: number }) => a.id);
        (voteRows || []).forEach((v: { answer_id: number }) => {
            const idx = answerIds.indexOf(v.answer_id);
            if (idx >= 0) votes[letters[idx]] = (votes[letters[idx]] || 0) + 1;
        });
    } catch (_) {}

    const total = Object.values(votes).reduce((a, b) => a + b, 0);
    const labels = (answers || []).map((a: { answer_text: string }, i: number) => letters[i] + ": " + (a.answer_text || "").slice(0, 20));

    return new Response(JSON.stringify({ votes, total, labels, letters }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
