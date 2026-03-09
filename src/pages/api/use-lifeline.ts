import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST: Activar comodín sin recargar la página (evita resetear estado)
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const user = await locals.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: profile } = await locals.supabase
        .from("players")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();

    if (profile?.role !== "admin" && profile?.role !== "docente") {
        return new Response(JSON.stringify({ error: "Solo staff puede activar comodines" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    let body: { round_id: string; question_id: string; lifeline_code: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Body inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { round_id, question_id, lifeline_code } = body;
    if (!round_id || !question_id || !lifeline_code) {
        return new Response(JSON.stringify({ error: "round_id, question_id y lifeline_code requeridos" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const rId = parseInt(round_id);
    const qId = parseInt(question_id);
    const code = lifeline_code.toLowerCase();

    const { data: existing } = await supabaseAdmin
        .from("round_lifeline_usage")
        .select("id")
        .eq("round_id", rId)
        .eq("lifeline_code", code)
        .limit(1)
        .maybeSingle();
    if (existing) {
        return new Response(JSON.stringify({ error: "Este comodín ya fue usado en esta sesión" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (code === "llamada") {
        const { error } = await supabaseAdmin.from("round_lifeline_usage").upsert(
            { round_id: rId, question_id: qId, lifeline_code: "llamada", metadata: { used: true } },
            { onConflict: "round_id,question_id,lifeline_code" }
        );
        if (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (code === "publico") {
        const { error } = await supabaseAdmin.from("round_lifeline_usage").upsert(
            { round_id: rId, question_id: qId, lifeline_code: "publico", metadata: { used: true } },
            { onConflict: "round_id,question_id,lifeline_code" }
        );
        if (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Comodín no soportado por esta API" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
    });
};
