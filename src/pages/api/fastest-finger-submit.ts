import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const POST: APIRoute = async ({ request, locals }) => {
    const user = await locals.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: "Debes iniciar sesión" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const formData = await request.formData();
    const ff_round_id = formData.get("ff_round_id")?.toString();
    const event_round_id = formData.get("event_round_id")?.toString();
    const selected_order = formData.get("selected_order")?.toString();
    const response_time_ms = formData.get("response_time_ms")?.toString();

    if (!selected_order || !response_time_ms) {
        return new Response(JSON.stringify({ error: "Datos incompletos" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const eventRoundId = event_round_id ? parseInt(event_round_id) : NaN;
    const responseTimeMs = parseInt(response_time_ms);
    let selectedOrder: number[];
    try {
        selectedOrder = JSON.parse(selected_order) as number[];
    } catch {
        return new Response(JSON.stringify({ error: "Orden inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: player } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

    if (!player?.id) {
        return new Response(JSON.stringify({ error: "Jugador no encontrado" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Buscar por event_round_id (más fiable) o por id
    let ffRound: { id: number; sequence_id: number; event_round_id: number } | null = null;
    if (!isNaN(eventRoundId)) {
        const res = await supabaseAdmin
            .from("fastest_finger_rounds")
            .select("id, sequence_id, event_round_id")
            .eq("event_round_id", eventRoundId)
            .maybeSingle();
        ffRound = res.data;
    }
    if (!ffRound && ff_round_id) {
        const ffRoundId = parseInt(ff_round_id);
        if (!isNaN(ffRoundId)) {
            const res = await supabaseAdmin
                .from("fastest_finger_rounds")
                .select("id, sequence_id, event_round_id")
                .eq("id", ffRoundId)
                .maybeSingle();
            ffRound = res.data;
        }
    }

    if (!ffRound) {
        return new Response(JSON.stringify({ error: "Reto no encontrado" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Verificar que el jugador es finalista en Preselección (solo finalistas pueden participar en Mente más Rápida)
    const { data: round } = await supabaseAdmin
        .from("event_rounds")
        .select("event_id, events(season_id, program_id, faculty_id, scope)")
        .eq("id", ffRound.event_round_id)
        .single();
    if (round?.events) {
        const { isFinalistInPreseleccion } = await import("@/lib/preseleccionFinalist");
        const isFinalist = await isFinalistInPreseleccion(supabaseAdmin, player.id, round.events as Record<string, unknown>);
        if (!isFinalist) {
            return new Response(JSON.stringify({ error: "Solo los finalistas pueden participar en Mente más Rápida" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    const ffRoundId = ffRound.id;

    const { data: items } = await supabaseAdmin
        .from("fastest_finger_items")
        .select("id, correct_position")
        .eq("sequence_id", ffRound.sequence_id)
        .order("correct_position");

    const correctOrder = (items || []).map((i: { id: number }) => i.id);
    const isCorrect =
        selectedOrder.length === correctOrder.length &&
        selectedOrder.every((id, idx) => id === correctOrder[idx]);

    const { data: existingAttempt } = await supabaseAdmin
        .from("fastest_finger_attempts")
        .select("id")
        .eq("fastest_finger_round_id", ffRoundId)
        .eq("player_id", player.id)
        .maybeSingle();

    if (existingAttempt) {
        const { error } = await supabaseAdmin
            .from("fastest_finger_attempts")
            .update({
                selected_order: selectedOrder,
                response_time_ms: responseTimeMs,
                is_correct: isCorrect,
            })
            .eq("fastest_finger_round_id", ffRoundId)
            .eq("player_id", player.id);
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    } else {
        const { error } = await supabaseAdmin
            .from("fastest_finger_attempts")
            .insert({
                fastest_finger_round_id: ffRoundId,
                player_id: player.id,
                selected_order: selectedOrder,
                response_time_ms: responseTimeMs,
                is_correct: isCorrect,
            });
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    return new Response(
        JSON.stringify({
            success: true,
            correct: isCorrect,
            time: (responseTimeMs / 1000).toFixed(2),
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
};
