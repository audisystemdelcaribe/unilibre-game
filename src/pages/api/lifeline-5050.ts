import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Comodín 50:50 - Devuelve los IDs de 2 respuestas incorrectas para ocultar.
 * El cliente nunca recibe cuál es la correcta.
 */
export const GET: APIRoute = async ({ locals, url }) => {
    const questionId = url.searchParams.get("question_id");
    if (!questionId) {
        return new Response(JSON.stringify({ error: "question_id requerido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const user = await locals.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: answers } = await supabaseAdmin
        .from("answers")
        .select("id, is_correct")
        .eq("question_id", parseInt(questionId));

    if (!answers || answers.length < 3) {
        return new Response(JSON.stringify({ error: "Pregunta no válida" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const incorrect = answers.filter((a) => !a.is_correct);
    if (incorrect.length < 2) {
        return new Response(JSON.stringify({ hide_ids: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Elegir 2 incorrectas al azar
    const shuffled = [...incorrect].sort(() => Math.random() - 0.5);
    const hideIds = shuffled.slice(0, 2).map((a) => a.id);

    return new Response(JSON.stringify({ hide_ids: hideIds }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
