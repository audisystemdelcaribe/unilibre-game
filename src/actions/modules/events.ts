import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureStaff } from '../utils';

export const eventsActions = {
    saveEvent: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(3, "El nombre es muy corto"),
            description: z.string().optional().nullable(),
            event_date: z.string(),
            season_id: z.string(),
            game_mode_id: z.string(),
            scope: z.string(),
            faculty_id: z.string().optional().nullable(),
            program_id: z.string().optional().nullable(),

        }),
        handler: async (input, context) => {
            await ensureStaff(context);
            const { id, name, description, event_date, season_id, game_mode_id, scope, faculty_id, program_id } = input;

            let final_f_id = null;
            let final_p_id = null;

            if (scope === 'faculty') {
                final_f_id = parseInt(faculty_id!);
            } else if (scope === 'program') {
                final_f_id = faculty_id ? parseInt(faculty_id) : null;
                final_p_id = parseInt(program_id!);
            }

            const eventData = {
                name,
                description: description || null,
                event_date,
                season_id: parseInt(season_id),
                game_mode_id: parseInt(game_mode_id),
                scope,
                faculty_id: final_f_id,
                program_id: final_p_id,
                // Ya no enviamos access_code aquí
            };

            if (id && id !== "") {
                const { error } = await supabaseAdmin.from('events').update(eventData).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
                return { success: true, message: "Evento maestro actualizado" };
            } else {
                const { error } = await supabaseAdmin.from('events').insert([eventData]);
                if (error) throw new Error(error.message);
                return { success: true, message: "Evento maestro creado" };
            }
        }
    }),

    deleteEvent: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureStaff(context);
            const { error } = await supabaseAdmin.from('events').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true, message: "Evento eliminado" };
        }
    })
};