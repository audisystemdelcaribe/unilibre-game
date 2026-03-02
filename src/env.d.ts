/// <reference types="astro/client" />
declare namespace App {
    interface Locals {
        supabase: import("@supabase/supabase-js").SupabaseClient;
        getUser: () => Promise<import("@supabase/supabase-js").User | null>;
    }
}