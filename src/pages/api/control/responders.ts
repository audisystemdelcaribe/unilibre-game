import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * API para el panel de control: devuelve estudiantes conectados y/o que respondieron.
 * Usa supabaseAdmin para game_answers (bypassa RLS) y asegura que se vean las respuestas.
 */
export const GET: APIRoute = async ({ locals, url }) => {
    const roundId = url.searchParams.get("round_id");
    if (!roundId) {
        return new Response(JSON.stringify({ error: "round_id requerido" }), {
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

    const supabase = locals.supabase;

    // Verificar que sea staff (admin o docente)
    const { data: profile } = await supabase
        .from("players")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();

    if (profile?.role !== "admin" && profile?.role !== "docente") {
        return new Response(JSON.stringify({ error: "Acceso denegado" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: round } = await supabase
        .from("event_rounds")
        .select("event_id, classroom_group_id, current_question_id, status, events(game_mode_id)")
        .eq("id", roundId)
        .single();

    if (!round) {
        return new Response(JSON.stringify({ error: "Ronda no encontrada" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    const result: {
        connected: { player_id: number; name: string }[];
        responders: { player_id: number; name: string }[];
        current_question_id: number | null;
        status: string;
        fastest_finger_attempts?: { player_id: number; name: string; response_time_ms: number; is_correct: boolean }[];
        student_selection?: { player_id: number; name: string; answer_id: number; answer_text: string; letter: string } | null;
    } = {
        connected: [],
        responders: [],
        current_question_id: round.current_question_id,
        status: round.status || "waiting",
    };

    // Si es Mente más Rápida, traer intentos (supabaseAdmin evita RLS)
    if (round.status === "fastest_finger") {
        const { data: ffRound } = await supabaseAdmin
            .from("fastest_finger_rounds")
            .select("id")
            .eq("event_round_id", parseInt(roundId, 10))
            .maybeSingle();
        if (ffRound) {
            const { data: attempts } = await supabaseAdmin
                .from("fastest_finger_attempts")
                .select("player_id, response_time_ms, is_correct, players(name)")
                .eq("fastest_finger_round_id", ffRound.id);
            result.fastest_finger_attempts = (attempts || []).map((a) => ({
                player_id: a.player_id,
                name: (a.players as { name?: string })?.name || "Estudiante",
                response_time_ms: a.response_time_ms,
                is_correct: a.is_correct,
            }));
        }
    }

    // Siempre traer conectados (event_players)
    const { data: connected } = await supabase
        .from("event_players")
        .select("player_id, players(name)")
        .eq("event_id", round.event_id)
        .eq("classroom_group_id", round.classroom_group_id);

    if (connected) {
        result.connected = connected.map((c) => ({
            player_id: c.player_id,
            name: (c.players as { name?: string })?.name || "Estudiante",
        }));
    }

    // Si está activo y hay pregunta: selección del estudiante (Clásico) o quienes respondieron
    if (round.status === "active" && round.current_question_id) {
        const isClasico = (round?.events as { game_mode_id?: number })?.game_mode_id === 2;

        if (isClasico) {
            const { data: sel } = await supabaseAdmin
                .from("student_answer_selection")
                .select("player_id, answer_id, players(name)")
                .eq("round_id", parseInt(roundId, 10))
                .eq("question_id", round.current_question_id)
                .limit(1);
            if (sel && sel.length > 0) {
                const s = sel[0];
                const { data: ans } = await supabaseAdmin.from("answers").select("answer_text").eq("id", s.answer_id).single();
                const { data: ansList } = await supabaseAdmin.from("answers").select("id").eq("question_id", round.current_question_id).order("id");
                const idx = (ansList || []).findIndex((a: { id: number }) => a.id === s.answer_id);
                const letter = ["A", "B", "C", "D"][idx >= 0 ? idx : 0];
                result.student_selection = {
                    player_id: s.player_id,
                    name: (s.players as { name?: string })?.name || "Estudiante",
                    answer_id: s.answer_id,
                    answer_text: ans?.answer_text || "",
                    letter,
                };
            }
        }
        if (!isClasico) {
        const roundIdNum = parseInt(roundId, 10);
        const { data: answers } = await supabaseAdmin
            .from("game_answers")
            .select("player_id, players(name)")
            .eq("question_id", round.current_question_id)
            .eq("round_id", isNaN(roundIdNum) ? roundId : roundIdNum);

        if (answers) {
            const seen = new Set<number>();
            result.responders = answers
                .filter((a) => a.player_id && !seen.has(a.player_id) && seen.add(a.player_id))
                .map((a) => ({
                    player_id: a.player_id,
                    name: (a.players as { name?: string } | null)?.name || "Estudiante",
                }));
        }
        }
    }

    return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
