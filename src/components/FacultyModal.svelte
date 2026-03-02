<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Label } from "$lib/components/ui/label";
    import { Loader2, Plus, Pencil } from "lucide-svelte";
    import { actions } from "astro:actions";

    let { faculty = null } = $props();

    let isOpen = $state(false);
    let isSaving = $state(false);
    let name = $state(faculty?.name ?? "");
    let description = $state(faculty?.description ?? "");

    // Función para abrir el modal manualmente
    function toggleModal() {
        console.log("Intentando abrir modal de:", faculty?.name || "Nueva Facultad");
        isOpen = true;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        isSaving = true;
        const { error } = await actions.saveFaculty({ id: faculty?.id, name, description });

        if (!error) {
            isOpen = false;
            window.location.reload();
        } else {
            alert(error.message);
            isSaving = false;
        }
    }
</script>

<!-- USAMOS UN BOTÓN NORMAL EN LUGAR DE DIALOG.TRIGGER PARA ASEGURAR COMPATIBILIDAD -->
{#if !faculty}
    <Button onclick={toggleModal} class="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2">
        <Plus size={18} /> Nueva Facultad
    </Button>
{:else}
    <Button variant="ghost" size="icon" onclick={toggleModal} class="text-zinc-400 hover:text-blue-600">
        <Pencil size={18} />
    </Button>
{/if}

<Dialog.Root bind:open={isOpen}>
    <Dialog.Content class="sm:max-w-[425px] border-zinc-800 bg-zinc-950 text-white backdrop-blur-xl">
        <Dialog.Header>
            <Dialog.Title class="text-2xl font-black italic">{faculty ? 'EDITAR' : 'NUEVA'} FACULTAD</Dialog.Title>
        </Dialog.Header>

        <form onsubmit={handleSubmit} class="space-y-6 pt-4">
            <div class="space-y-2">
                <Label>Nombre</Label>
                <Input bind:value={name} class="bg-zinc-900 border-zinc-800" required />
            </div>

            <div class="space-y-2">
                <Label>Descripción</Label>
                <Textarea bind:value={description} class="bg-zinc-900 border-zinc-800" />
            </div>

            <div class="flex justify-end gap-3">
                <Button type="button" variant="ghost" onclick={() => isOpen = false}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} class="bg-white text-black font-bold">
                    {#if isSaving} <Loader2 class="animate-spin mr-2" size={18} /> {/if}
                    Guardar
                </Button>
            </div>
        </form>
    </Dialog.Content>
</Dialog.Root>