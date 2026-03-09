import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Comodín Llamada - Simula "llamar a un amigo" que sugiere una opción.
 * Con ~60% de probabilidad sugiere la correcta.
 */
export const GET: APIRoute = async ({ url }) => {
    const questionId = url.searchParams.get("question_id");
    if (!questionId) {
        return new Response(JSON.stringify({ error: "question_id requerido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: answers } = await supabaseAdmin
        .from("answers")
        .select("id, is_correct")
        .eq("question_id", parseInt(questionId))
        .order("id");

    if (!answers || answers.length === 0) {
        return new Response(JSON.stringify({ suggested_index: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const letters = ["A", "B", "C", "D"];
    const correctIdx = answers.findIndex((a) => a.is_correct);
    const hintCorrect = Math.random() < 0.6;
    const suggestedIndex = hintCorrect && correctIdx >= 0
        ? correctIdx
        : Math.floor(Math.random() * answers.length);

    return new Response(
        JSON.stringify({
            suggested_letter: letters[Math.min(suggestedIndex, 3)],
            suggested_index: suggestedIndex,
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
};
