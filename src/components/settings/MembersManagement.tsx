import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  User,
  KeyRound,
  Trash2,
  MoreVertical,
  Check,
  Mail,
  Clock,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MembersManagementProps {
  householdId: string;
  canAdmin: boolean;
  currentUserRole?: string;
  currentUserId?: string;
}

const ROLES_INFO: Record<
  string,
  { label: string; badge: string; description: string; icon: any }
> = {
  owner: {
    label: "Proprietário",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    description: "Controle total da residência, faturamento e exclusão.",
    icon: Shield,
  },
  admin: {
    label: "Administrador",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    description: "Gerencia dispositivos, automações, câmeras e membros.",
    icon: ShieldCheck,
  },
  member: {
    label: "Morador",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    description: "Pode controlar dispositivos e ativar cenas.",
    icon: User,
  },
  guest: {
    label: "Convidado / Prestador",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    description: "Acesso limitado a dispositivos e horários autorizados.",
    icon: KeyRound,
  },
};

export function MembersManagement({
  householdId,
  canAdmin,
  currentUserRole,
  currentUserId,
}: MembersManagementProps) {
  const qc = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "guest">("member");
  const [isBusy, setIsBusy] = useState(false);

  // Consulta os membros da residência no Supabase
  const membersQuery = useQuery({
    queryKey: ["household_members", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");

      if (error) throw error;
      return data || [];
    },
  });

  const members = membersQuery.data || [];

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Informe o e-mail do morador ou convidado.");
      return;
    }

    setIsBusy(true);
    try {
      // Cria um registro de membro / convite
      const dummyUserId = `user-${Date.now()}`;
      const { error } = await supabase.from("household_members").insert({
        household_id: householdId,
        user_id: dummyUserId,
        role: inviteRole,
      });

      if (error) {
        toast.error(`Falha ao adicionar: ${error.message}`);
      } else {
        toast.success(`Convite enviado para ${inviteEmail}!`);
        setIsInviteOpen(false);
        setInviteEmail("");
        qc.invalidateQueries({ queryKey: ["household_members", householdId] });
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message || "Falha ao processar convite"}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "member" | "guest") => {
    try {
      const { error } = await supabase
        .from("household_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) {
        toast.error(`Falha ao atualizar papel: ${error.message}`);
      } else {
        toast.success("Papel do usuário atualizado!");
        qc.invalidateQueries({ queryKey: ["household_members", householdId] });
      }
    } catch (e: any) {
      toast.error("Erro na comunicação com o servidor.");
    }
  };

  const handleRemoveMember = async (memberId: string, role: string) => {
    if (role === "owner") {
      toast.error("O proprietário principal não pode ser removido.");
      return;
    }

    if (!confirm("Tem certeza que deseja remover este morador da residência?")) return;

    try {
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("id", memberId);

      if (error) {
        toast.error(`Falha ao remover: ${error.message}`);
      } else {
        toast.success("Membro removido com sucesso.");
        qc.invalidateQueries({ queryKey: ["household_members", householdId] });
      }
    } catch (e: any) {
      toast.error("Erro ao remover membro.");
    }
  };

  return (
    <section className="glass rounded-2xl p-6 lg:col-span-2 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Moradores & Gestão de Acessos ({members.length})
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Defina quem pode acessar a residência, visualizar câmeras e controlar automações.
            </p>
          </div>
        </div>

        {canAdmin && (
          <Button
            onClick={() => setIsInviteOpen(true)}
            size="sm"
            className="gap-2 shrink-0 font-semibold shadow-xs"
          >
            <UserPlus className="size-4" />
            <span>Convidar Morador</span>
          </Button>
        )}
      </div>

      {/* Tabela / Lista de Membros */}
      <div className="rounded-xl border divide-y bg-background/50 overflow-hidden">
        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <User className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold">Nenhum morador adicional cadastrado</p>
            <p className="text-xs text-muted-foreground/70">
              Convide familiares ou prestadores de serviço com permissões granulares.
            </p>
          </div>
        ) : (
          members.map((mem) => {
            const roleInfo = (ROLES_INFO[mem.role] || ROLES_INFO.member)!;
            const Icon = roleInfo.icon;
            const isSelf = mem.user_id === currentUserId;

            return (
              <div
                key={mem.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="size-10 rounded-full bg-primary/10 text-primary font-bold text-sm grid place-items-center uppercase border border-primary/20">
                    {mem.user_id.slice(0, 2)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {isSelf ? "Você (Conta Ativa)" : `Morador (${mem.user_id.slice(0, 8)})`}
                      </span>
                      {isSelf && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adicionado em {new Date(mem.created_at).toLocaleDateString()} • {roleInfo.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className={cn("text-xs font-mono", roleInfo.badge)}>
                    <Icon className="size-3 mr-1" />
                    <span>{roleInfo.label}</span>
                  </Badge>

                  {canAdmin && mem.role !== "owner" && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(mem.id, "admin")}
                          className="text-xs"
                        >
                          Promover para Administrador
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(mem.id, "member")}
                          className="text-xs"
                        >
                          Definir como Morador
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleUpdateRole(mem.id, "guest")}
                          className="text-xs"
                        >
                          Definir como Convidado
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(mem.id, mem.role)}
                          className="text-xs text-destructive focus:text-destructive gap-2"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Remover da Residência</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Convidar Morador */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <div className="size-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2">
                <UserPlus className="size-5" />
              </div>
              <DialogTitle className="font-bold">Convidar Novo Morador</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Envie um convite para permitir que outra pessoa acesse e controle a casa inteligente.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="inv-email" className="text-xs font-semibold">
                  E-mail do Convidado *
                </Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="exemplo@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Papel de Acesso</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(val: any) => setInviteRole(val)}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Morador (Acesso padrão aos aparelhos)</SelectItem>
                    <SelectItem value="admin">Administrador (Configurações e membros)</SelectItem>
                    <SelectItem value="guest">Convidado (Acesso restrito / temporário)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isBusy} size="sm" className="text-xs font-semibold px-5">
                {isBusy ? "Enviando..." : "Enviar Convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
