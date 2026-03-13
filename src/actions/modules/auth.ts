// src/actions/modules/auth.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

// Mensaje único para requisitos de contraseña (se muestra en validación y en errores de Supabase)
const PASSWORD_REQUIREMENTS_MSG =
    "Caracteres permitidos: letras (a-z, A-Z), números (0-9) y símbolos (!@#$%^&*()_+-=[]{};':\"|<>?,./~). Mínimo 6 caracteres.";

// Solo caracteres que acepta Supabase Auth (evita emojis y caracteres que generan error)
const PASSWORD_ALLOWED_REGEX = /^[\x20-\x7E]*$/;

export const authActions = {
    registerPlayer: defineAction({
        accept: 'form',
        input: z.object({
            email: z.string().email().refine(e => e.endsWith('@unilibre.edu.co'), {
                message: "Debe ser un correo institucional (@unilibre.edu.co)"
            }),
            password: z
                .string()
                .min(6, "La contraseña debe tener al menos 6 caracteres. " + PASSWORD_REQUIREMENTS_MSG)
                .refine(p => PASSWORD_ALLOWED_REGEX.test(p), {
                    message: "La contraseña contiene caracteres no permitidos. " + PASSWORD_REQUIREMENTS_MSG
                }),
            full_name: z.string().min(3, "Nombre muy corto").max(200, "Nombre muy largo"),
            program_id: z.string().min(1, "Selecciona un programa"),
            semester: z.string().refine(s => {
                const n = parseInt(s, 10);
                return !isNaN(n) && n >= 1 && n <= 12;
            }, { message: "El semestre debe estar entre 1 y 12" }),
        }),
        handler: async (input, context) => {
            const { email, password, full_name, program_id, semester } = input;

            const progId = parseInt(program_id, 10);
            const sem = parseInt(semester, 10);
            if (isNaN(progId) || isNaN(sem)) {
                throw new Error("Datos de programa o semestre inválidos");
            }

            const { data: programExists } = await context.locals.supabase
                .from("programs")
                .select("id")
                .eq("id", progId)
                .single();
            if (!programExists) {
                throw new Error("El programa seleccionado no existe");
            }

            // Intentar registro en Supabase Auth
            const { data, error } = await context.locals.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: full_name,
                        program_id: progId,
                        semester: sem,
                        role: 'player' // Por defecto son estudiantes
                    }
                }
            });

            if (error) {
                // Traducir errores de contraseña de Supabase a mensaje claro con caracteres permitidos
                const msg = error.message || "";
                const isPasswordError =
                    /password|contraseña|weak|weak password|character|caracter|requirement|requisito/i.test(msg) ||
                    msg.includes("6 characters") ||
                    msg.includes("at least");
                if (isPasswordError) {
                    throw new Error("La contraseña no cumple los requisitos. " + PASSWORD_REQUIREMENTS_MSG);
                }
                throw new Error(error.message);
            }

            return {
                success: true,
                message: "¡Registro exitoso! Ya puedes iniciar sesión."
            };
        }
    })
};