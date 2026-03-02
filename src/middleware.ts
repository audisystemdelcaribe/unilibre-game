import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Faltan las variables de entorno de Supabase en .env");
    }

    // 1. Inicializar cliente usando las cabeceras de Astro
    context.locals.supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                // En Astro Middleware, extraemos las cookies del header 'cookie'
                getAll() {
                    return parseCookieHeader(context.request.headers.get("Cookie") ?? "");
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        context.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // 2. Definir helper para obtener el usuario
    context.locals.getUser = async () => {
        const { data: { user } } = await context.locals.supabase.auth.getUser();
        return user;
    };

    const user = await context.locals.getUser();
    const url = new URL(context.request.url);

    // 3. Protección de rutas simple
    if (url.pathname.startsWith("/dashboard") && !user) {
        return context.redirect("/");
    }

    // Si ya está logueado y va al login, mandarlo al dashboard
    if (url.pathname === "/" && user) {
        return context.redirect("/dashboard");
    }

    return next();
});