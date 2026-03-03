import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const programsActions = {
    saveProgram: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(3),
            description: z.string().optional(),
            faculty_id: z.string(),
        }),
        handler: async (input) => {
            const { id, name, description, faculty_id } = input;
            const data = {
                name,
                description,
                faculty_id: parseInt(faculty_id)
            };

            if (id && id !== "") {
                const { error } = await supabaseAdmin.from('programs').update(data).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabaseAdmin.from('programs').insert([data]);
                if (error) throw new Error(error.message);
            }
            return {
                success: true,
                message: id ? "Registro actualizado correctamente" : "Registro creado con éxito"
            };
        }
    }),

    deleteProgram: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }) => {
            const { error } = await supabaseAdmin.from('programs').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};