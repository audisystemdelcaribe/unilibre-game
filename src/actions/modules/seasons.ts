import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const seasonsActions = {
    saveSeason: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            year: z.string(),
            semester: z.string(),
            name: z.string().optional(),
            status: z.enum(['active', 'finished']).default('active'),
        }),
        handler: async (input) => {
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
            return { success: true };
        }
    })
};