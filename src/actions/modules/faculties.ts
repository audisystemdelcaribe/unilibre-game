import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const facultiesActions = {
    saveFaculty: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(3, "Nombre muy corto"),
            description: z.string().optional(),
        }),
        handler: async (input) => {
            const { id, name, description } = input;
            const data = { name, description };

            if (id && id !== "") {
                const { error } = await supabaseAdmin.from('faculties').update(data).eq('id', parseInt(id));
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabaseAdmin.from('faculties').insert([data]);
                if (error) throw new Error(error.message);
            }
            return {
                success: true,
                message: id ? "Registro actualizado correctamente" : "Registro creado con éxito"
            };
        }
    }),

    deleteFaculty: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }) => {
            const { error } = await supabaseAdmin.from('faculties').delete().eq('id', parseInt(id));
            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};