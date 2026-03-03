import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils';

export const seasonsActions = {
    saveSeason: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            year: z.string().min(4),
            semester: z.string(),
            name: z.string().optional(),
            status: z.enum(['active', 'finished']).default('active'),
        }),
        handler: async (input, context) => {
            await ensureAdmin(context); // Seguridad

            const { id, year, semester, name, status } = input;
            const data = {
                year: parseInt(year),
                semester: parseInt(semester),
                name: name || `${year}-${semester}`,
                status
            };

            if (id && id !== "") {
                const { error } = await supabaseAdmin.from('seasons').update(data).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabaseAdmin.from('seasons').insert([data]);
                if (error) throw new Error(error.message);
            }
            return {
                success: true,
                message: id ? "Registro actualizado correctamente" : "Registro creado con éxito"
            };
        }
    }),

    deleteSeason: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context);
            const { error } = await supabaseAdmin.from('seasons').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};