import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ensureAdmin } from '../utils'; // Importamos el guardián

export const subjectsActions = {

    saveSubject: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(2),
            description: z.string().optional(),
            program_links: z.string(),
        }),
        handler: async (input, context) => {
            // SEGURIDAD: Si no es admin, Astro lanza el error aquí mismo
            await ensureAdmin(context);

            const { id, name, description, program_links } = input;
            const links = JSON.parse(program_links);

            if (links.length === 0) throw new Error("Debes seleccionar un programa");

            let subjectId: number;
            if (id && id !== "") {
                subjectId = parseInt(id);
                await supabaseAdmin.from('subjects').update({ name, description }).eq('id', subjectId);
            } else {
                const { data, error } = await supabaseAdmin.from('subjects').insert([{ name, description }]).select().single();
                if (error) throw new Error(error.message);
                subjectId = data.id;
            }

            await supabaseAdmin.from('program_subjects').delete().eq('subject_id', subjectId);
            const insertData = links.map((l: any) => ({
                program_id: parseInt(l.program_id),
                subject_id: subjectId,
                semester: parseInt(l.semester)
            }));

            await supabaseAdmin.from('program_subjects').insert(insertData);
            return {
                success: true,
                message: id ? "Registro actualizado correctamente" : "Registro creado con éxito"
            };
        }
    }),

    deleteSubject: defineAction({
        accept: 'form',
        input: z.object({ id: z.string() }),
        handler: async ({ id }, context) => {
            await ensureAdmin(context); // SEGURIDAD
            const subjectId = parseInt(id);
            await supabaseAdmin.from('program_subjects').delete().eq('subject_id', subjectId);
            const { error } = await supabaseAdmin.from('subjects').delete().eq('id', subjectId);
            if (error) throw new Error(error.message);
            return { success: true };
        }
    })
};