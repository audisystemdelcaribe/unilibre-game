// src/actions/modules/live_sessions.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureStaff } from '../utils';

export const liveSessionsActions = {
    openClassroomSession: defineAction({
        accept: 'form',
        input: z.object({
            event_id: z.string(),
            classroom_group_id: z.string().optional(),
        }),
        handler: async (input, context) => {
            await ensureStaff(context);

            const { event_id, classroom_group_id } = input;
            const { data: evt } = await supabaseAdmin.from('events').select('game_mode_id').eq('id', parseInt(event_id)).single();
            const gm = evt?.game_mode_id;
            const groupId = gm === 3 ? 'Gran Final' : gm === 2 ? 'Silla Caliente' : (classroom_group_id?.trim() || '');
            if (!groupId || groupId.length < 2) throw new Error("El nombre del grupo es obligatorio");

            // 1. Generar un PIN aleatorio de 4 o 6 números
            // Verificamos que no exista uno igual activo (opcional pero recomendado)
            const session_pin = Math.floor(1000 + Math.random() * 9000).toString();

            // 2. Crear la fila en event_rounds que actuará como "Sala de espera"
            const { data: round, error } = await supabaseAdmin
                .from('event_rounds')
                .insert([{
                    event_id: parseInt(event_id),
                    round_number: 0, // Ronda 0 significa "Lobby / Sala de espera"
                    type: 'classroom_quiz',
                    status: 'waiting',
                    classroom_group_id: groupId,
                    session_pin: session_pin
                }])
                .select()
                .single();

            if (error) throw new Error(error.message);

            return {
                success: true,
                message: "¡Salón abierto con éxito!",
                pin: session_pin,
                round_id: round.id
            };
        }
    }),
    startGame: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            // 1. Cambiamos el estado a 'active'
            // 2. Opcional: Aquí podrías elegir la primera pregunta aleatoria
            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({ status: 'active', round_number: 1 })
                .eq('id', parseInt(round_id));

            if (error) throw new Error(error.message);
            return { success: true };
        }
    }),
    joinRoom: defineAction({
        accept: 'form',
        input: z.object({ pin: z.string(), as_audience: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional() }),
        handler: async ({ pin, as_audience }, context) => {
            const user = await context.locals.getUser();
            if (!user) throw new Error("Debes iniciar sesión");

            // 1. Buscar la ronda por PIN (con evento y modo de juego)
            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('*, events(game_mode_id)')
                .eq('session_pin', pin)
                .single();

            if (!round) throw new Error("PIN no válido");

            // 2. Buscar ID del jugador
            const { data: player } = await supabaseAdmin
                .from('players')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            if (!player?.id) throw new Error("Perfil de jugador no encontrado");

            const gameModeId = (round.events as { game_mode_id?: number })?.game_mode_id;
            const roundStatus = (round as { status?: string })?.status;

            // 2a. "Ayudar a participante": siempre ir como público
            if (as_audience) return { success: true, round_id: round.id, audience_only: true };

            // 2b. Mente más Rápida: solo finalistas (por game_mode 3 o por status fastest_finger)
            if (gameModeId === 3 || roundStatus === 'fastest_finger') {
                const { data: finalists } = await supabaseAdmin
                    .from('event_players')
                    .select('id')
                    .eq('player_id', player.id)
                    .eq('event_id', round.event_id)
                    .eq('is_finalist', true)
                    .limit(1);
                if (!finalists?.length) throw new Error("Solo los finalistas (ganadores de preselección) pueden participar en Mente más Rápida.");
            }

            // 2c. Silla Caliente (Clásico=2): ganador juega; otros con PIN van como público
            if (gameModeId === 2) {
                const { data: ac } = await supabaseAdmin
                    .from('active_contestants')
                    .select('player_id')
                    .eq('event_id', round.event_id)
                    .maybeSingle();
                if (!ac || ac.player_id !== player.id) {
                    return { success: true, round_id: round.id, audience_only: true };
                }
            }

            // 3. UPSERT DE SESIÓN (Ahora funcionará gracias al SQL de arriba)
            const { data: session, error: sErr } = await supabaseAdmin
                .from('game_sessions')
                .upsert({
                    player_id: player.id,
                    event_id: round.event_id,
                    round_id: round.id,
                    session_type: 'classroom',
                    finished: false // Vital para que coincida con el constraint
                }, { onConflict: 'player_id, event_id, finished' })
                .select()
                .single();

            if (sErr) throw new Error("Error al crear sesión: " + sErr.message);

            // 4. REGISTRAR EN EL EVENTO (Asegurando el grupo)
            await supabaseAdmin
                .from('event_players')
                .upsert({
                    event_id: round.event_id,
                    player_id: player.id,
                    classroom_group_id: round.classroom_group_id,
                    stage: 'lobby'
                }, { onConflict: 'event_id, player_id' });

            return { success: true, round_id: round.id };
        }
    }),
    nextQuestion: defineAction({
        accept: 'form',
        input: z.object({
            round_id: z.string(),
            question_id: z.string()
        }),
        handler: async ({ round_id, question_id }, context) => {
            await ensureStaff(context);
            const qId = parseInt(question_id);
            const rId = parseInt(round_id);
            try {
                await supabaseAdmin.from('round_questions_shown').insert({ round_id: rId, question_id: qId });
            } catch (_) { /* tabla puede no existir */ }
            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({
                    current_question_id: qId,
                    question_started_at: new Date().toISOString(),
                    status: 'active'
                })
                .eq('id', rId);

            if (error) throw new Error(error.message);
            return { success: true, message: "¡Pregunta lanzada a los estudiantes!" };
        }
    }),
    submitAnswer: defineAction({
        accept: 'form',
        input: z.object({
            round_id: z.string(),
            question_id: z.string(),
            answer_id: z.string(),
            session_id: z.string(),
        }),
        handler: async (input, context) => {
            console.log('[submitAnswer] INICIO - input:', JSON.stringify(input));
            const user = await context.locals.getUser();
            if (!user) throw new Error("Debes iniciar sesión");

            const now = Date.now();
            const { round_id, question_id, answer_id, session_id } = input;

            const sessionIdNum = parseInt(session_id, 10);
            if (isNaN(sessionIdNum)) throw new Error("Sesión inválida. Vuelve a unirte con el PIN.");

            // 1. Obtener datos (Carga rápida)
            const [roundRes, questionRes, answerRes, playerRes] = await Promise.all([
                supabaseAdmin.from('event_rounds').select('*, events(game_mode_id)').eq('id', parseInt(round_id)).single(),
                supabaseAdmin.from('questions').select('*, game_levels(points, time_limit)').eq('id', parseInt(question_id)).single(),
                supabaseAdmin.from('answers').select('is_correct, question_id').eq('id', parseInt(answer_id)).single(),
                supabaseAdmin.from('players').select('id').eq('auth_user_id', user?.id).single()
            ]);

            if (!roundRes.data) throw new Error("Ronda no encontrada");
            if (!roundRes.data?.question_started_at) throw new Error("Pregunta no iniciada");

            // Validar que la respuesta pertenece a la pregunta y es la pregunta actual
            const qId = parseInt(question_id);
            if (!answerRes.data) throw new Error("Respuesta no encontrada");
            if (answerRes.data.question_id !== qId) throw new Error("Respuesta inválida para esta pregunta");
            if (roundRes.data?.current_question_id !== qId) throw new Error("Esta pregunta ya no está activa");
            const startTime = new Date(roundRes.data.question_started_at).getTime();
            const responseMs = now - startTime;
            const limitMs = ((questionRes.data?.game_levels as any)?.time_limit || 30) * 1000;
            const isCorrect = answerRes.data?.is_correct ?? false;

            // Validar que la sesión pertenezca al jugador y al evento de la ronda (evitar IDOR)
            const { data: gameSession } = await supabaseAdmin
                .from('game_sessions')
                .select('id, player_id, event_id')
                .eq('id', sessionIdNum)
                .single();

            if (!playerRes.data?.id) throw new Error("Jugador no encontrado");
            if (!gameSession || gameSession.player_id !== playerRes.data.id) {
                throw new Error("Sesión de juego inválida");
            }
            if (gameSession.event_id !== roundRes.data.event_id) {
                throw new Error("La sesión no corresponde a esta ronda");
            }

            const isJuegoFinal = (roundRes.data?.events as { game_mode_id?: number })?.game_mode_id === 2;
            let points = 0;
            if (isCorrect) {
                const base = (questionRes.data.game_levels as any).points || 1000;
                if (isJuegoFinal) {
                    // Juego final: sin tiempo, puntos completos al ritmo del docente
                    points = base;
                } else {
                    // Preselección: más rápido = más puntos
                    const ratio = Math.max(0, (limitMs - responseMs) / limitMs);
                    points = Math.round(base * (0.05 + (ratio * 0.95)));
                }
            }

            // 2. Insertar respuesta (asegurar que event_players existe para total_time_ms)
            await supabaseAdmin.from('event_players').upsert({
                event_id: roundRes.data.event_id,
                player_id: playerRes.data.id,
                classroom_group_id: roundRes.data.classroom_group_id ?? '',
                stage: 'playing'
            }, { onConflict: 'event_id, player_id' });

            // Insertar vía RPC SECURITY DEFINER (bypasea RLS sin depender de la clave)
            const levelId = (questionRes.data as any)?.level_id ?? (questionRes.data?.game_levels as any)?.id ?? 1;
            const rpcParams = {
                p_game_session_id: sessionIdNum,
                p_round_id: parseInt(round_id, 10),
                p_event_id: roundRes.data.event_id,
                p_player_id: playerRes.data.id,
                p_classroom_group_id: roundRes.data.classroom_group_id ?? '',
                p_question_id: parseInt(question_id, 10),
                p_answer_id: parseInt(answer_id, 10),
                p_is_correct: isCorrect,
                p_response_time_ms: responseMs,
                p_money_at_question: points,
                p_level_id: typeof levelId === 'number' ? levelId : parseInt(String(levelId), 10) || 1
            };
            console.log('[submitAnswer] Llamando insert_game_answer con:', JSON.stringify(rpcParams));
            const { data: insertedId, error: insertErr } = await supabaseAdmin.rpc('insert_game_answer', {
                ...rpcParams
            });

            if (insertErr) {
                console.error('[submitAnswer] insert_game_answer FALLÓ:', {
                    message: insertErr.message,
                    details: insertErr.details,
                    code: insertErr.code,
                    hint: insertErr.hint
                });
                throw new Error(`Error al guardar respuesta: ${insertErr.message}`);
            }
            console.log('[submitAnswer] Respuesta guardada OK, id:', insertedId);

            // 3. LLAMAR A LA FUNCIÓN DE PUNTOS (Lo más importante)
            if (points > 0) {
                await supabaseAdmin.rpc('registrar_puntaje_ganado', {
                    p_session_id: sessionIdNum,
                    p_event_id: roundRes.data.event_id,
                    p_player_id: playerRes.data.id,
                    p_puntos: points
                });
            }

            // 4. Acumular tiempo total (para desempate y transparencia en ranking)
            const { error: timeErr } = await supabaseAdmin.rpc('add_player_time', {
                p_player_id: playerRes.data.id,
                p_event_id: roundRes.data.event_id,
                p_response_ms: responseMs
            });
            if (timeErr) console.error('add_player_time:', timeErr.message);

            const resp = { success: true, correct: isCorrect, points, time: (responseMs / 1000).toFixed(2), insertId: insertedId ?? null };
            console.log('[submitAnswer] ÉXITO - retornando:', resp);
            return resp;
        }
    }),
    // src/actions/modules/live_sessions.ts

    launchRandomQuestion: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            // 1. Obtener datos de la ronda y el programa
            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('*, events(program_id, game_mode_id)')
                .eq('id', parseInt(round_id))
                .single();

            if (!round) throw new Error("Ronda no encontrada");

            // 1b. Silla Caliente: obtener semestre del concursante activo para filtrar preguntas
            let playerSemester: number | null = null;
            const gameModeId = (round.events as { game_mode_id?: number })?.game_mode_id;
            if (gameModeId === 2) {
                const { data: ac } = await supabaseAdmin
                    .from('active_contestants')
                    .select('player_id')
                    .eq('event_id', round.event_id)
                    .maybeSingle();
                if (ac?.player_id) {
                    const { data: pl } = await supabaseAdmin
                        .from('players')
                        .select('semester')
                        .eq('id', ac.player_id)
                        .single();
                    if (pl?.semester != null) playerSemester = pl.semester;
                }
            }

            // 2. Preguntas ya usadas: round_questions_shown (o fallback a game_answers)
            let usedIds: number[] = [];
            try {
                const { data: shown } = await supabaseAdmin
                    .from('round_questions_shown')
                    .select('question_id')
                    .eq('round_id', round.id);
                if (shown && shown.length > 0) {
                    usedIds = [...new Set(shown.map((s: { question_id: number }) => s.question_id).filter(Boolean))];
                }
            } catch (_) { /* tabla puede no existir */ }
            if (usedIds.length === 0) {
                const { data: answered } = await supabaseAdmin
                    .from('game_answers')
                    .select('question_id')
                    .eq('round_id', round.id);
                const fromAnswers = (answered || []).map((a: { question_id: number }) => a.question_id).filter(Boolean);
                const currentQ = round.current_question_id ? [round.current_question_id] : [];
                usedIds = [...new Set([...fromAnswers, ...currentQ])];
            }

            // 3. Preguntas disponibles: Nivel 1 (difficulty_order=1), activas.
            const { data: firstLevel } = await supabaseAdmin
                .from('game_levels')
                .select('id')
                .eq('difficulty_order', 1)
                .maybeSingle();
            const firstLevelId = firstLevel?.id ?? 1;

            const programId = round.events?.program_id;
            let query = supabaseAdmin
                .from('questions')
                .select('id')
                .eq('level_id', firstLevelId)
                .eq('active', true);

            if (programId != null) {
                query = query.or(`program_id.eq.${programId},scope.eq.global`);
            } else {
                query = query.eq('scope', 'global');
            }

            // Silla Caliente: solo preguntas cuyo rango [min_semester, max_semester] incluya el semestre del estudiante
            if (playerSemester != null) {
                query = query.lte('min_semester', playerSemester).gte('max_semester', playerSemester);
            }

            const { data: allMatching } = await query;

            // Filtrar en JS para garantizar que NUNCA repetimos (más fiable que .not() de Supabase)
            const availableIds = (allMatching || [])
                .map((q: { id: number }) => q.id)
                .filter((id: number) => !usedIds.includes(id));

            if (availableIds.length === 0) {
                const hint = playerSemester != null ? ` (semestre ${playerSemester} o compatible)` : '';
                throw new Error(`¡Se agotaron las preguntas de este nivel para esta sesión${hint}! Puedes finalizar el juego o agregar más preguntas de Nivel 1.`);
            }

            // 4. Azar y actualización (solo de las no usadas)
            const chosenId = availableIds[Math.floor(Math.random() * availableIds.length)];
            const randomQ = allMatching?.find((q: { id: number }) => q.id === chosenId);

            if (!randomQ) throw new Error("Error al seleccionar pregunta");

            // Registrar que esta pregunta ya se mostró (evita repeticiones)
            try {
                await supabaseAdmin.from('round_questions_shown').insert({
                    round_id: round.id,
                    question_id: randomQ.id
                });
            } catch (_) { /* tabla puede no existir aún */ }

            // Actualizar stage a 'playing' cuando inicia el juego (desde waiting)
            await supabaseAdmin.from('event_players').update({ stage: 'playing' })
                .eq('event_id', round.event_id)
                .eq('classroom_group_id', round.classroom_group_id);

            await supabaseAdmin.from('event_rounds').update({
                current_question_id: randomQ.id,
                question_started_at: new Date().toISOString(),
                status: 'active'
            }).eq('id', round.id);

            return { success: true };
        }
    }),
    verifyClasicoAnswer: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);
            const rId = parseInt(round_id);

            const { data: round } = await supabaseAdmin.from('event_rounds').select('current_question_id').eq('id', rId).single();
            if (!round?.current_question_id) throw new Error("Ronda o pregunta no encontrada");

            const { data: sel } = await supabaseAdmin
                .from('student_answer_selection')
                .select('player_id, answer_id')
                .eq('round_id', rId)
                .eq('question_id', round.current_question_id)
                .limit(1)
                .single();

            if (!sel) throw new Error("El estudiante no ha marcado ninguna opción");

            const { data: answer } = await supabaseAdmin.from('answers').select('is_correct').eq('id', sel.answer_id).single();
            if (!answer) throw new Error("Respuesta no encontrada");

            const correct = answer.is_correct === true;
            const { data: roundFull } = await supabaseAdmin.from('event_rounds').select('*, events(program_id, season_id)').eq('id', rId).single();
            if (!roundFull) throw new Error("Ronda no encontrada");

            const { data: question } = await supabaseAdmin.from('questions').select('level_id').eq('id', round.current_question_id).single();
            const { data: level } = await supabaseAdmin.from('game_levels').select('id, money_value, points, difficulty_order').eq('id', question?.level_id || 1).single();
            const { data: gameSession } = await supabaseAdmin.from('game_sessions').select('id').eq('player_id', sel.player_id).eq('event_id', roundFull.event_id).eq('finished', false).maybeSingle();
            if (!gameSession) throw new Error("Sesión de juego no encontrada");

            if (correct) {
                await supabaseAdmin.rpc('insert_game_answer', { p_game_session_id: gameSession.id, p_round_id: rId, p_event_id: roundFull.event_id, p_player_id: sel.player_id, p_classroom_group_id: roundFull.classroom_group_id ?? '', p_question_id: round.current_question_id, p_answer_id: sel.answer_id, p_is_correct: true, p_response_time_ms: 0, p_money_at_question: level?.points || 1000, p_level_id: question?.level_id || 1 });
                await supabaseAdmin.rpc('registrar_puntaje_ganado', { p_session_id: gameSession.id, p_event_id: roundFull.event_id, p_player_id: sel.player_id, p_puntos: level?.points || 1000 });
                await supabaseAdmin.from('student_answer_selection').delete().eq('round_id', rId).eq('question_id', round.current_question_id);
                const currentOrder = level?.difficulty_order ?? 1;
                const { data: nextLevel } = await supabaseAdmin.from('game_levels').select('id').eq('difficulty_order', currentOrder + 1).maybeSingle();
                const nextLevelId = nextLevel?.id;
                const programId = (roundFull.events as any)?.program_id;
                let usedIds: number[] = [];
                const { data: shown } = await supabaseAdmin.from('round_questions_shown').select('question_id').eq('round_id', rId);
                if (shown?.length) usedIds = shown.map((s: any) => s.question_id).filter(Boolean);
                usedIds.push(round.current_question_id);
                if (!nextLevelId) {
                    const winPrize = level?.money_value ?? level?.points ?? 0;
                    await supabaseAdmin.from('game_sessions').update({ score: winPrize, finished: true }).eq('id', gameSession.id);
                    await supabaseAdmin.from('event_players').update({ score: winPrize, stage: 'finished' }).eq('event_id', roundFull.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '');
                    const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id').eq('event_id', roundFull.event_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '').order('score', { ascending: false }).order('total_time_ms', { ascending: true });
                    if (ranked?.length) { for (let i = 0; i < ranked.length; i++) { await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 }).eq('event_id', roundFull.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? ''); } }
                    const seasonId = (roundFull.events as { season_id?: number })?.season_id;
                    if (seasonId) {
                        const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', winPrize);
                        await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: winPrize, position: (count ?? 0) + 1 });
                    }
                    await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);
                    return { success: true, message: "¡Correcto! No hay más preguntas. ¡Ganó!", finished: true };
                }
                // Silla Caliente: filtrar por semestre del estudiante (min_semester <= semestre <= max_semester)
                const { data: plSem } = await supabaseAdmin.from('players').select('semester').eq('id', sel.player_id).single();
                const playerSemester = plSem?.semester ?? null;

                let query = supabaseAdmin.from('questions').select('id').eq('level_id', nextLevelId).eq('active', true);
                if (programId != null) query = query.or(`program_id.eq.${programId},scope.eq.global`);
                else query = query.eq('scope', 'global');
                if (playerSemester != null) query = query.lte('min_semester', playerSemester).gte('max_semester', playerSemester);
                const { data: available } = await query;
                const availableIds = (available || []).map((q: any) => q.id).filter((id: number) => !usedIds.includes(id));
                if (availableIds.length === 0) {
                    const winPrize = level?.money_value ?? level?.points ?? 0;
                    await supabaseAdmin.from('game_sessions').update({ score: winPrize, finished: true }).eq('id', gameSession.id);
                    await supabaseAdmin.from('event_players').update({ score: winPrize, stage: 'finished' }).eq('event_id', roundFull.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '');
                    const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id').eq('event_id', roundFull.event_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '').order('score', { ascending: false }).order('total_time_ms', { ascending: true });
                    if (ranked?.length) { for (let i = 0; i < ranked.length; i++) { await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 }).eq('event_id', roundFull.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? ''); } }
                    const seasonId = (roundFull.events as { season_id?: number })?.season_id;
                    if (seasonId) {
                        const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', winPrize);
                        await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: winPrize, position: (count ?? 0) + 1 });
                    }
                    await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);
                    return { success: true, message: "¡Correcto! No hay más preguntas. ¡Ganó!", finished: true };
                }
                const chosenId = availableIds[Math.floor(Math.random() * availableIds.length)];
                const { data: verifyQ } = await supabaseAdmin.from('questions').select('level_id').eq('id', chosenId).single();
                if (!verifyQ || verifyQ.level_id !== nextLevelId) throw new Error("Error al seleccionar pregunta del nivel correcto.");
                await supabaseAdmin.from('round_questions_shown').insert({ round_id: rId, question_id: chosenId });
                await supabaseAdmin.from('event_rounds').update({ current_question_id: chosenId, question_started_at: new Date().toISOString() }).eq('id', rId);
                return { success: true, message: "¡Correcto! Siguiente nivel." };
            } else {
                // Premio solo si llegó a un seguro: niveles que PASÓ correctamente (antes del que falló)
                const { data: allLevels } = await supabaseAdmin.from('game_levels').select('id, difficulty_order, money_value, is_safe_level').order('difficulty_order', { ascending: true });
                const currentOrder = allLevels?.find((l: any) => l.id === question?.level_id)?.difficulty_order ?? 1;
                const levelsPassed = (allLevels || []).filter((l: any) => l.difficulty_order < currentOrder);
                const safeLevelsPassed = levelsPassed.filter((l: any) => l.is_safe_level);
                let prizeMoney = 0;
                if (safeLevelsPassed.length > 0) prizeMoney = safeLevelsPassed[safeLevelsPassed.length - 1].money_value || 0;
                await supabaseAdmin.rpc('insert_game_answer', { p_game_session_id: gameSession.id, p_round_id: rId, p_event_id: roundFull.event_id, p_player_id: sel.player_id, p_classroom_group_id: roundFull.classroom_group_id ?? '', p_question_id: round.current_question_id, p_answer_id: sel.answer_id, p_is_correct: false, p_response_time_ms: 0, p_money_at_question: 0, p_level_id: question?.level_id || 1 });
                await supabaseAdmin.from('game_sessions').update({ score: prizeMoney, finished: true }).eq('id', gameSession.id);
                await supabaseAdmin.from('event_players').update({ score: prizeMoney, stage: 'finished' }).eq('event_id', roundFull.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '');
                await supabaseAdmin.from('student_answer_selection').delete().eq('round_id', rId).eq('question_id', round.current_question_id);
                const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id').eq('event_id', roundFull.event_id).eq('classroom_group_id', roundFull.classroom_group_id ?? '').order('score', { ascending: false }).order('total_time_ms', { ascending: true }).order('player_id', { ascending: true });
                if (ranked?.length) { for (let i = 0; i < ranked.length; i++) { await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 }).eq('event_id', roundFull.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', roundFull.classroom_group_id ?? ''); } }
                const seasonId = (roundFull.events as { season_id?: number })?.season_id;
                if (seasonId) {
                    const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', prizeMoney);
                    await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: prizeMoney, position: (count ?? 0) + 1 });
                }
                await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);
                return { success: true, message: `Incorrecto. Premio: $${prizeMoney.toLocaleString('es-CO')}`, finished: true };
            }
        }
    }),
    evaluateClasicoAnswer: defineAction({
        accept: 'form',
        input: z.object({
            round_id: z.string(),
            is_correct: z.enum(['true', 'false']),
        }),
        handler: async ({ round_id, is_correct }, context) => {
            await ensureStaff(context);

            const rId = parseInt(round_id);
            const correct = is_correct === 'true';

            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('*, events(program_id, season_id)')
                .eq('id', rId)
                .single();

            if (!round || !round.current_question_id) throw new Error("Ronda o pregunta no encontrada");

            const { data: sel } = await supabaseAdmin
                .from('student_answer_selection')
                .select('player_id, answer_id')
                .eq('round_id', rId)
                .eq('question_id', round.current_question_id)
                .limit(1)
                .single();

            if (!sel) throw new Error("El estudiante no ha marcado ninguna opción");

            const { data: question } = await supabaseAdmin
                .from('questions')
                .select('level_id')
                .eq('id', round.current_question_id)
                .single();

            const { data: answer } = await supabaseAdmin
                .from('answers')
                .select('is_correct')
                .eq('id', sel.answer_id)
                .single();

            const { data: level } = await supabaseAdmin
                .from('game_levels')
                .select('id, money_value, points, difficulty_order')
                .eq('id', question?.level_id || 1)
                .single();

            const { data: gameSession } = await supabaseAdmin
                .from('game_sessions')
                .select('id')
                .eq('player_id', sel.player_id)
                .eq('event_id', round.event_id)
                .eq('finished', false)
                .maybeSingle();

            if (!gameSession) throw new Error("Sesión de juego no encontrada");

            if (correct) {
                // Registrar respuesta correcta
                await supabaseAdmin.rpc('insert_game_answer', {
                    p_game_session_id: gameSession.id,
                    p_round_id: rId,
                    p_event_id: round.event_id,
                    p_player_id: sel.player_id,
                    p_classroom_group_id: round.classroom_group_id ?? '',
                    p_question_id: round.current_question_id,
                    p_answer_id: sel.answer_id,
                    p_is_correct: true,
                    p_response_time_ms: 0,
                    p_money_at_question: level?.points || 1000,
                    p_level_id: question?.level_id || 1,
                });

                await supabaseAdmin.rpc('registrar_puntaje_ganado', {
                    p_session_id: gameSession.id,
                    p_event_id: round.event_id,
                    p_player_id: sel.player_id,
                    p_puntos: level?.points || 1000,
                });

                await supabaseAdmin.from('student_answer_selection').delete()
                    .eq('round_id', rId).eq('question_id', round.current_question_id);

                // Lanzar siguiente pregunta (nivel + 1 por difficulty_order)
                const currentOrder = level?.difficulty_order ?? 1;
                const { data: nextLevel } = await supabaseAdmin
                    .from('game_levels')
                    .select('id')
                    .eq('difficulty_order', currentOrder + 1)
                    .maybeSingle();
                const nextLevelId = nextLevel?.id;
                const programId = (round.events as any)?.program_id;

                let usedIds: number[] = [];
                const { data: shown } = await supabaseAdmin.from('round_questions_shown').select('question_id').eq('round_id', rId);
                if (shown?.length) usedIds = shown.map((s: any) => s.question_id).filter(Boolean);
                usedIds.push(round.current_question_id);

                // Si no hay siguiente nivel o no hay preguntas para ese nivel → ganó
                if (!nextLevelId) {
                    const winPrize = level?.money_value ?? level?.points ?? 0;
                    await supabaseAdmin.from('game_sessions').update({ score: winPrize, finished: true }).eq('id', gameSession.id);
                    await supabaseAdmin.from('event_players').update({ score: winPrize, stage: 'finished' }).eq('event_id', round.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                    const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id').eq('event_id', round.event_id).eq('classroom_group_id', round.classroom_group_id ?? '').order('score', { ascending: false }).order('total_time_ms', { ascending: true });
                    if (ranked?.length) {
                        for (let i = 0; i < ranked.length; i++) {
                            await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 }).eq('event_id', round.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                        }
                    }
                    const seasonId = (round.events as { season_id?: number })?.season_id;
                    if (seasonId) {
                        const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', winPrize);
                        await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: winPrize, position: (count ?? 0) + 1 });
                    }
                    await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);
                    return { success: true, message: "¡Correcto! No hay más preguntas. ¡Ganó!", finished: true };
                }

                // Silla Caliente: filtrar por semestre del estudiante (min_semester <= semestre <= max_semester)
                const { data: plSem } = await supabaseAdmin.from('players').select('semester').eq('id', sel.player_id).single();
                const playerSemester = plSem?.semester ?? null;

                let query = supabaseAdmin.from('questions').select('id').eq('level_id', nextLevelId).eq('active', true);
                if (programId != null) query = query.or(`program_id.eq.${programId},scope.eq.global`);
                else query = query.eq('scope', 'global');
                if (playerSemester != null) query = query.lte('min_semester', playerSemester).gte('max_semester', playerSemester);
                const { data: available } = await query;

                const availableIds = (available || []).map((q: any) => q.id).filter((id: number) => !usedIds.includes(id));

                if (availableIds.length === 0) {
                    // No hay preguntas para el siguiente nivel: usa el premio del nivel actual
                    const winPrize = level?.money_value ?? level?.points ?? 0;
                    await supabaseAdmin.from('game_sessions').update({ score: winPrize, finished: true }).eq('id', gameSession.id);
                    await supabaseAdmin.from('event_players').update({ score: winPrize, stage: 'finished' }).eq('event_id', round.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                    const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id').eq('event_id', round.event_id).eq('classroom_group_id', round.classroom_group_id ?? '').order('score', { ascending: false }).order('total_time_ms', { ascending: true });
                    if (ranked?.length) {
                        for (let i = 0; i < ranked.length; i++) {
                            await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 }).eq('event_id', round.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                        }
                    }
                    const seasonId = (round.events as { season_id?: number })?.season_id;
                    if (seasonId) {
                        const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', winPrize);
                        await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: winPrize, position: (count ?? 0) + 1 });
                    }
                    await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);
                    return { success: true, message: "¡Correcto! No hay más preguntas. ¡Ganó!", finished: true };
                }

                const chosenId = availableIds[Math.floor(Math.random() * availableIds.length)];
                const { data: verifyQ } = await supabaseAdmin.from('questions').select('level_id').eq('id', chosenId).single();
                if (!verifyQ || verifyQ.level_id !== nextLevelId) {
                    console.error('[evaluateClasico] Nivel incoherente: chosenId=', chosenId, 'expected level=', nextLevelId, 'got=', verifyQ?.level_id);
                    throw new Error("Error al seleccionar pregunta del nivel correcto. Intenta de nuevo.");
                }
                await supabaseAdmin.from('round_questions_shown').insert({ round_id: rId, question_id: chosenId });
                await supabaseAdmin.from('event_rounds').update({
                    current_question_id: chosenId,
                    question_started_at: new Date().toISOString(),
                }).eq('id', rId);

                return { success: true, message: "¡Correcto! Siguiente nivel." };
            } else {
                // Incorrecto: premio solo si llegó a un seguro (niveles que PASÓ correctamente)
                const { data: allLevels } = await supabaseAdmin
                    .from('game_levels')
                    .select('id, difficulty_order, money_value, is_safe_level')
                    .order('difficulty_order', { ascending: true });

                const currentOrder = allLevels?.find((l: any) => l.id === question?.level_id)?.difficulty_order ?? 1;
                const levelsPassed = (allLevels || []).filter((l: any) => l.difficulty_order < currentOrder);
                const safeLevelsPassed = levelsPassed.filter((l: any) => l.is_safe_level);

                let prizeMoney = 0;
                if (safeLevelsPassed.length > 0) {
                    const lastSafe = safeLevelsPassed[safeLevelsPassed.length - 1];
                    prizeMoney = lastSafe.money_value || 0;
                }

                await supabaseAdmin.rpc('insert_game_answer', {
                    p_game_session_id: gameSession.id,
                    p_round_id: rId,
                    p_event_id: round.event_id,
                    p_player_id: sel.player_id,
                    p_classroom_group_id: round.classroom_group_id ?? '',
                    p_question_id: round.current_question_id,
                    p_answer_id: sel.answer_id,
                    p_is_correct: false,
                    p_response_time_ms: 0,
                    p_money_at_question: 0,
                    p_level_id: question?.level_id || 1,
                });

                await supabaseAdmin.from('game_sessions').update({ score: prizeMoney, finished: true }).eq('id', gameSession.id);
                await supabaseAdmin.from('event_players').update({ score: prizeMoney, stage: 'finished' }).eq('event_id', round.event_id).eq('player_id', sel.player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                await supabaseAdmin.from('student_answer_selection').delete().eq('round_id', rId).eq('question_id', round.current_question_id);

                const { data: ranked } = await supabaseAdmin.from('event_players').select('player_id')
                    .eq('event_id', round.event_id).eq('classroom_group_id', round.classroom_group_id ?? '')
                    .order('score', { ascending: false }).order('total_time_ms', { ascending: true }).order('player_id', { ascending: true });

                if (ranked?.length) {
                    for (let i = 0; i < ranked.length; i++) {
                        await supabaseAdmin.from('event_players').update({ final_rank: i + 1, is_finalist: i === 0 })
                            .eq('event_id', round.event_id).eq('player_id', ranked[i].player_id).eq('classroom_group_id', round.classroom_group_id ?? '');
                    }
                }

                const seasonId = (round.events as { season_id?: number })?.season_id;
                if (seasonId) {
                    const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', prizeMoney);
                    await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: sel.player_id, score: prizeMoney, position: (count ?? 0) + 1 });
                }

                await supabaseAdmin.from('event_rounds').update({ status: 'finished' }).eq('id', rId);

                return { success: true, message: `Incorrecto. Premio: $${prizeMoney.toLocaleString('es-CO')}`, finished: true };
            }
        }
    }),

    finishRound: defineAction({
        accept: 'form',
        input: z.object({ round_id: z.string() }),
        handler: async ({ round_id }, context) => {
            await ensureStaff(context);

            const rId = parseInt(round_id);
            const { data: round } = await supabaseAdmin
                .from('event_rounds')
                .select('event_id, classroom_group_id, events(game_mode_id, season_id)')
                .eq('id', rId)
                .single();

            if (!round) throw new Error("Ronda no encontrada");

            const evt = round.events as { game_mode_id?: number; season_id?: number } | null;
            const isClasico = evt?.game_mode_id === 2;

            // Si es Clásico (Silla Caliente): marcar game_sessions y event_players del participante activo
            if (isClasico) {
                const { data: ac } = await supabaseAdmin.from('active_contestants').select('player_id').eq('event_id', round.event_id).maybeSingle();
                if (ac?.player_id) {
                    const { data: gs } = await supabaseAdmin.from('game_sessions').select('id, score').eq('player_id', ac.player_id).eq('event_id', round.event_id).eq('finished', false).maybeSingle();
                    const { data: ep } = await supabaseAdmin.from('event_players').select('score').eq('event_id', round.event_id).eq('player_id', ac.player_id).eq('classroom_group_id', round.classroom_group_id ?? '').maybeSingle();
                    const finalScore = gs?.score ?? ep?.score ?? 0;

                    if (gs) {
                        await supabaseAdmin.from('game_sessions').update({ score: finalScore, finished: true }).eq('id', gs.id);
                    }
                    await supabaseAdmin.from('event_players').update({ score: finalScore, stage: 'finished' })
                        .eq('event_id', round.event_id).eq('player_id', ac.player_id).eq('classroom_group_id', round.classroom_group_id ?? '');

                    const seasonId = evt?.season_id;
                    if (seasonId && finalScore > 0) {
                        const { count } = await supabaseAdmin.from('season_rankings').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).gt('score', finalScore);
                        await supabaseAdmin.from('season_rankings').insert({ season_id: seasonId, player_id: ac.player_id, score: finalScore, position: (count ?? 0) + 1 });
                    }
                }
            }

            // Calcular y guardar final_rank (score DESC, total_time_ms ASC)
            const { data: ranked } = await supabaseAdmin
                .from('event_players')
                .select('player_id')
                .eq('event_id', round.event_id)
                .eq('classroom_group_id', round.classroom_group_id)
                .order('score', { ascending: false })
                .order('total_time_ms', { ascending: true })
                .order('player_id', { ascending: true });

            if (ranked?.length) {
                for (let i = 0; i < ranked.length; i++) {
                    const isWinner = i === 0;
                    await supabaseAdmin.from('event_players').update({
                        final_rank: i + 1,
                        is_finalist: isWinner,
                        ...(isClasico ? { stage: 'finished' as const } : {})
                    })
                        .eq('event_id', round.event_id)
                        .eq('player_id', ranked[i].player_id)
                        .eq('classroom_group_id', round.classroom_group_id);
                }
            }

            const { error } = await supabaseAdmin
                .from('event_rounds')
                .update({ status: 'finished' })
                .eq('id', rId);

            if (error) throw new Error(error.message);
            return { success: true, message: "Juego finalizado" };
        }
    })
};