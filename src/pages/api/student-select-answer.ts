import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * El estudiante marca su respuesta (sin enviar). Solo guarda la selección.
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const user = await locals.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    let body: { round_id: string; question_id: string; answer_id: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Body inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { round_id, question_id, answer_id } = body;
    if (!round_id || !question_id || !answer_id) {
        return new Response(JSON.stringify({ error: "round_id, question_id y answer_id requeridos" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: player } = await locals.supabase
        .from("players")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

    if (!player) {
        return new Response(JSON.stringify({ error: "Jugador no encontrado" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { error } = await supabaseAdmin.from("student_answer_selection").upsert(
        {
            round_id: parseInt(round_id),
            question_id: parseInt(question_id),
            player_id: player.id,
            answer_id: parseInt(answer_id),
        },
        { onConflict: "round_id,question_id,player_id" }
    );

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
