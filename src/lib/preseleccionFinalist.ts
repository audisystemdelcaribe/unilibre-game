import type { SupabaseClient } from "@supabase/supabase-js";

type EventScope = {
	season_id?: number;
	program_id?: number | null;
	faculty_id?: number | null;
	scope?: string;
};

/**
 * Verifica si el jugador es finalista en algún evento Preselección (game_mode_id=1)
 * de la misma temporada y ámbito que el evento de referencia (ej. Mente más Rápida).
 */
export async function isFinalistInPreseleccion(
	supabase: SupabaseClient,
	playerId: number,
	eventScope: EventScope
): Promise<boolean> {
	const seasonId = eventScope?.season_id;
	if (!seasonId) return false;

	let preseleccionQuery = supabase
		.from("events")
		.select("id")
		.eq("season_id", seasonId)
		.eq("game_mode_id", 1); // Preselección

	if (eventScope?.scope === "program" && eventScope?.program_id) {
		preseleccionQuery = preseleccionQuery.eq("program_id", eventScope.program_id).eq("scope", "program");
	} else if (eventScope?.scope === "faculty" && eventScope?.faculty_id) {
		preseleccionQuery = preseleccionQuery.eq("faculty_id", eventScope.faculty_id).eq("scope", "faculty");
	} else {
		preseleccionQuery = preseleccionQuery.eq("scope", eventScope?.scope || "global");
	}

	const { data: preseleccionEvents } = await preseleccionQuery;
	const preseleccionIds = (preseleccionEvents || []).map((e: { id: number }) => e.id);

	if (preseleccionIds.length === 0) return false;

	const { data: ep } = await supabase
		.from("event_players")
		.select("id")
		.eq("player_id", playerId)
		.eq("is_finalist", true)
		.in("event_id", preseleccionIds)
		.limit(1)
		.maybeSingle();

	return !!ep;
}
