import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Devuelve si la ronda de Mente más Rápida terminó y si el usuario actual es el ganador.
 */
export const GET: APIRoute = async ({ url, locals }) => {
    const user = await locals.getUser();
    if (!user) {
        return new Response(JSON.stringify({ finished: false, isWinner: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const roundId = url.searchParams.get("round_id");
    if (!roundId) {
        return new Response(JSON.stringify({ finished: false, isWinner: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const rId = parseInt(roundId);
    if (isNaN(rId)) {
        return new Response(JSON.stringify({ finished: false, isWinner: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: player } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

    if (!player?.id) {
        return new Response(JSON.stringify({ finished: false, isWinner: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: round } = await supabaseAdmin
        .from("event_rounds")
        .select("status, event_id, events(season_id, program_id, faculty_id, scope)")
        .eq("id", rId)
        .single();

    if (!round || round.status !== "finished") {
        return new Response(
            JSON.stringify({ finished: false, isWinner: false }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    const evt = round.events as {
        season_id?: number;
        program_id?: number | null;
        faculty_id?: number | null;
        scope?: string;
    };
    const seasonId = evt?.season_id;
    if (!seasonId) {
        return new Response(
            JSON.stringify({ finished: true, isWinner: false }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    let clasicoQuery = supabaseAdmin
        .from("events")
        .select("id")
        .eq("season_id", seasonId)
        .eq("game_mode_id", 2);

    if (evt?.scope === "program" && evt?.program_id) {
        clasicoQuery = clasicoQuery.eq("program_id", evt.program_id).eq("scope", "program");
    } else if (evt?.scope === "faculty" && evt?.faculty_id) {
        clasicoQuery = clasicoQuery.eq("faculty_id", evt.faculty_id).eq("scope", "faculty");
    } else {
        clasicoQuery = clasicoQuery.eq("scope", evt?.scope || "global");
    }

    const { data: clasicoEvent } = await clasicoQuery.limit(1).maybeSingle();

    if (!clasicoEvent) {
        return new Response(
            JSON.stringify({ finished: true, isWinner: false }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    const { data: ac } = await supabaseAdmin
        .from("active_contestants")
        .select("player_id")
        .eq("event_id", clasicoEvent.id)
        .maybeSingle();

    const isWinner = ac?.player_id === player.id;

    return new Response(
        JSON.stringify({ finished: true, isWinner }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
