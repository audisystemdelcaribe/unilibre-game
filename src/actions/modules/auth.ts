// src/actions/modules/auth.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const authActions = {
    registerPlayer: defineAction({
        accept: 'form',
        input: z.object({
            email: z.string().email().refine(e => e.endsWith('@unilibre.edu.co'), {
                message: "Debe ser un correo institucional (@unilibre.edu.co)"
            }),
            password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
            full_name: z.string().min(3, "Nombre muy corto"),
            program_id: z.string(),
            semester: z.string(),
        }),
        handler: async (input, context) => {
            const { email, password, full_name, program_id, semester } = input;

            // Intentar registro en Supabase Auth
            const { data, error } = await context.locals.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: full_name,
                        program_id: parseInt(program_id),
                        semester: parseInt(semester),
                        role: 'player' // Por defecto son estudiantes
                    }
                }
            });

            if (error) throw new Error(error.message);

            return {
                success: true,
                message: "¡Registro exitoso! Ya puedes iniciar sesión."
            };
        }
    })
};