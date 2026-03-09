import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST: El público vota por una opción (participantes con cuenta que ya participaron)
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const user = await locals.getUser();
    const ct = request.headers.get("Content-Type") || "";
    const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
    const jsonError = (msg: string, status: number) =>
        new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } });
    const redirectTo = (url: string) => new Response(null, { status: 302, headers: { Location: url } });

    if (!user) {
        if (isForm) return redirectTo("/?error=sesion");
        return jsonError("Debes iniciar sesión", 401);
    }

    let round_id: number, question_id: number, answer_id: number;
    if (ct.includes("application/json")) {
        try {
            const body = await request.json();
            round_id = body.round_id;
            question_id = body.question_id;
            answer_id = body.answer_id;
        } catch {
            return new Response(JSON.stringify({ error: "Body inválido" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const form = await request.formData();
        round_id = parseInt(String(form.get("round_id") || "0"));
        question_id = parseInt(String(form.get("question_id") || "0"));
        answer_id = parseInt(String(form.get("answer_id") || "0"));
    } else {
        return new Response(JSON.stringify({ error: "Content-Type no soportado" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (!round_id || !question_id || !answer_id) {
        if (isForm) return redirectTo(round_id ? `/play/audience/${round_id}?error=datos` : "/play/ayudar?error=datos");
        return jsonError("round_id, question_id y answer_id requeridos", 400);
    }

    const { data: player } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

    if (!player?.id) {
        if (isForm) return redirectTo(`/play/audience/${round_id}?error=jugador`);
        return jsonError("Jugador no encontrado", 400);
    }

    const { data: round } = await supabaseAdmin
        .from("event_rounds")
        .select("event_id, current_question_id")
        .eq("id", round_id)
        .single();

    if (!round || Number(round.current_question_id) !== Number(question_id)) {
        if (isForm) return redirectTo(`/play/audience/${round_id}?error=pregunta`);
        return jsonError("Pregunta no activa", 400);
    }

    const { data: ans } = await supabaseAdmin.from("answers").select("question_id").eq("id", answer_id).single();
    if (!ans || Number(ans.question_id) !== Number(question_id)) {
        if (isForm) return redirectTo(`/play/audience/${round_id}?error=respuesta`);
        return jsonError("Respuesta inválida", 400);
    }

    const { error } = await supabaseAdmin.from("audience_lifeline_votes").upsert(
        { round_id, question_id, answer_id, player_id: player.id },
        { onConflict: "round_id,question_id,player_id" }
    );

    if (error) {
        if (isForm) return redirectTo(`/play/audience/${round_id}?error=db`);
        return jsonError(error.message, 500);
    }

    if (isForm) return redirectTo(`/play/audience/${round_id}?voted=1`);
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
