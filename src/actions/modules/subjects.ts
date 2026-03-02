// src/actions/modules/subjects.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const subjectsActions = {

    saveSubject: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string().optional(),
            name: z.string().min(2),
            description: z.string().optional(),
            program_links: z.string(), // El JSON stringificado
        }),
        handler: async (input) => {
            const { id, name, description, program_links } = input;
            const links = JSON.parse(program_links);

            if (links.length === 0) {
                throw new Error("Debes vincular la materia a por lo menos un programa.");
            }

            // 1. Guardar Materia
            let subjectId: number;
            if (id && id !== "") {
                subjectId = parseInt(id);
                await supabaseAdmin.from('subjects').update({ name, description }).eq('id', subjectId);
            } else {
                const { data, error } = await supabaseAdmin.from('subjects').insert([{ name, description }]).select().single();
                if (error) throw new Error(error.message);
                subjectId = data.id;
            }

            // 2. Sincronizar Vínculos (Borrar y Re-insertar)
            await supabaseAdmin.from('program_subjects').delete().eq('subject_id', subjectId);

            const insertData = links.map((l: any) => ({
                program_id: parseInt(l.program_id),
                subject_id: subjectId,
                semester: parseInt(l.semester)
            }));

            const { error: linkError } = await supabaseAdmin.from('program_subjects').insert(insertData);
            if (linkError) throw new Error(linkError.message);

            return { success: true };
        }
    }),

    deleteSubject: defineAction({
        accept: 'form',
        input: z.object({
            id: z.string(),
        }),
        handler: async ({ id }) => {
            const subjectId = parseInt(id);

            // 1. Eliminar primero todas las asociaciones en program_subjects
            // Esto es necesario para evitar errores de integridad referencial
            const { error: linkError } = await supabaseAdmin
                .from('program_subjects')
                .delete()
                .eq('subject_id', subjectId);

            if (linkError) {
                console.error("Error al eliminar asociaciones:", linkError.message);
                throw new Error("No se pudieron eliminar los vínculos con los programas.");
            }

            // 2. Ahora eliminar la materia de la tabla subjects
            const { error: subjectError } = await supabaseAdmin
                .from('subjects')
                .delete()
                .eq('id', subjectId);

            if (subjectError) {
                console.error("Error al eliminar materia:", subjectError.message);
                throw new Error("No se pudo eliminar la materia.");
            }

            return { success: true };
        }
    })

};