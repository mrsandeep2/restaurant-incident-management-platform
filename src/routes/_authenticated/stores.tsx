import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, Store as StoreIcon, Trash2, Loader2 } from "lucide-react";
import { listStores, upsertStore, deleteStore } from "@/lib/stores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/_authenticated/stores")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <StoresPage />
    </RoleGate>
  ),
});

function StoresPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStores);
  const upFn = useServerFn(upsertStore);
  const delFn = useServerFn(deleteStore);
  const { data: stores = [], isLoading } = useQuery({ queryKey: ["stores"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");

  const create = useMutation({
    mutationFn: () => upFn({ data: { name, code, location, active: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      setOpen(false);
      setName(""); setCode(""); setLocation("");
      toast.success("Store added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Store removed");
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl">Stores</h1>
          <p className="mt-1 text-muted-foreground">Manage the locations your team reports against.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-accent text-accent-foreground border-0">
              <Plus className="h-4 w-4" /> Add store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-2xl">New store</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Bistro" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DT-01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City" />
                </div>
              </div>
              <Button
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate()}
                className="w-full gradient-accent text-accent-foreground border-0"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : stores.length === 0 ? (
          <div className="glass col-span-full rounded-2xl p-12 text-center">
            <StoreIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-serif text-2xl">No stores yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first location to start tagging incidents.</p>
          </div>
        ) : (
          stores.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass flex items-center justify-between rounded-2xl p-4"
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{[s.code, s.location].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}