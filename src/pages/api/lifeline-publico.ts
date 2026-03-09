import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Comodín Público - Simula votación del público con barras.
 * La opción correcta suele tener mayor porcentaje.
 */
export const GET: APIRoute = async ({ url }) => {
    const questionId = url.searchParams.get("question_id");
    if (!questionId) {
        return new Response(JSON.stringify({ error: "question_id requerido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { data: answers } = await supabaseAdmin
        .from("answers")
        .select("id, is_correct")
        .eq("question_id", parseInt(questionId))
        .order("id");

    if (!answers || answers.length === 0) {
        return new Response(JSON.stringify({ votes: { A: 25, B: 25, C: 25, D: 25 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    const letters = ["A", "B", "C", "D"];
    const correctIdx = answers.findIndex((a) => a.is_correct);

    // Generar porcentajes: correcta alta, otras distribuidas
    const base = [15, 15, 15, 15];
    if (correctIdx >= 0) {
        base[correctIdx] = 45 + Math.floor(Math.random() * 25);
    }
    const total = base.reduce((a, b) => a + b, 0);
    const votes: Record<string, number> = {};
    letters.forEach((l, i) => {
        votes[l] = Math.round((base[i] / total) * 100);
    });
    // Ajustar para que sume 100
    const sum = Object.values(votes).reduce((a, b) => a + b, 0);
    if (sum !== 100 && letters.length > 0) {
        votes[letters[0]] = (votes[letters[0]] || 0) + (100 - sum);
    }

    return new Response(JSON.stringify({ votes }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};
