import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getMe, updateProfile } from "@/lib/users.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const updFn = useServerFn(updateProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (me?.profile) {
      setName(me.profile.full_name ?? "");
      setPhone(me.profile.phone ?? "");
    }
  }, [me]);

  const mut = useMutation({
    mutationFn: () => updFn({ data: { full_name: name, phone } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated");
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Your profile and account preferences.</p>
      </div>
      <div className="glass space-y-4 rounded-3xl p-6">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={me?.profile?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gradient-accent text-accent-foreground border-0">
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
      <div className="glass rounded-3xl p-6">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your roles</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {me?.roles?.map((r) => (
            <span key={r} className="rounded-full bg-terracotta/15 px-3 py-1 text-xs capitalize text-terracotta">
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}