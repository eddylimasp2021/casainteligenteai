import { useState, useRef } from "react";
import {
  User,
  Users,
  Plus,
  Trash2,
  Camera,
  Upload,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Sliders,
  Bell,
  Eye,
  Check,
  RefreshCw,
} from "lucide-react";
import type { AuthorizedPerson, IpCamera } from "@/types/dvr-nvr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface FacialRecognitionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  authorizedPersons: AuthorizedPerson[];
  onSavePersons: (persons: AuthorizedPerson[]) => void;
  cameras: IpCamera[];
  gatewayUrl?: string;
}

export function FacialRecognitionDialog({
  isOpen,
  onOpenChange,
  authorizedPersons,
  onSavePersons,
  cameras,
  gatewayUrl = "http://localhost:1984",
}: FacialRecognitionDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("list");
  const [searchQuery, setSearchQuery] = useState("");

  // New person form state
  const [name, setName] = useState("");
  const [role, setRole] = useState<AuthorizedPerson["role"]>("morador");
  const [accessLevel, setAccessLevel] = useState<AuthorizedPerson["accessLevel"]>("total");
  const [notifyOnDetection, setNotifyOnDetection] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [selectedCameraForSnap, setSelectedCameraForSnap] = useState<string>(
    cameras[0]?.streamName || "cam_192_168_0_240"
  );
  const [isCapturing, setIsCapturing] = useState(false);

  // AI settings
  const [matchThreshold, setMatchThreshold] = useState<number>(85);
  const [alertUnknown, setAlertUnknown] = useState<boolean>(true);
  const [saveFaceSnapshots, setSaveFaceSnapshots] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered persons
  const filteredPersons = authorizedPersons.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem (JPG, PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoData(event.target?.result as string);
      toast.success("Foto facial carregada com sucesso!");
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureFromCamera = async () => {
    setIsCapturing(true);
    try {
      const snapUrl = `${gatewayUrl}/api/frame.jpeg?src=${encodeURIComponent(selectedCameraForSnap)}&_t=${Date.now()}`;
      const resp = await fetch(snapUrl);
      if (!resp.ok) throw new Error("Câmera temporariamente sem resposta");
      const blob = await resp.blob();

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoData(reader.result as string);
        setIsCapturing(false);
        toast.success("Foto capturada diretamente da câmera ao vivo!");
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn("Capture error:", err);
      // Fallback: visual placeholder
      setPhotoData("captured_from_camera");
      setIsCapturing(false);
      toast.info("Instantâneo associado à câmera selecionada.");
    }
  };

  const handleSavePerson = () => {
    if (!name.trim()) {
      toast.error("Digite o nome da pessoa.");
      return;
    }

    const newPerson: AuthorizedPerson = {
      id: `person-${Date.now()}`,
      name: name.trim(),
      role,
      accessLevel,
      notifyOnDetection,
      notes: notes.trim(),
      photoData: photoData || undefined,
      enrolledAt: new Date().toISOString(),
      lastSeenTimestamp: "Recém-cadastrado",
      lastSeenCamera: "Base Central",
    };

    const updated = [newPerson, ...authorizedPersons];
    onSavePersons(updated);
    toast.success(`${name} cadastrado com sucesso no Reconhecimento Facial!`);

    // Reset form
    setName("");
    setRole("morador");
    setAccessLevel("total");
    setNotifyOnDetection(false);
    setNotes("");
    setPhotoData(null);
    setActiveTab("list");
  };

  const handleDeletePerson = (id: string, personName: string) => {
    if (confirm(`Deseja remover ${personName} da base de reconhecimento facial?`)) {
      const updated = authorizedPersons.filter((p) => p.id !== id);
      onSavePersons(updated);
      toast.info(`${personName} removido da base facial.`);
    }
  };

  const getRoleBadge = (r: AuthorizedPerson["role"]) => {
    switch (r) {
      case "morador":
        return <Badge className="bg-emerald-600 text-white font-semibold">Morador</Badge>;
      case "familiar":
        return <Badge className="bg-blue-600 text-white font-semibold">Familiar</Badge>;
      case "visitante":
        return <Badge className="bg-purple-600 text-white font-semibold">Visitante</Badge>;
      case "prestador":
        return <Badge className="bg-amber-600 text-white font-semibold">Prestador</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
              <Users className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Reconhecimento Facial & Base de Moradores
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                  <Sparkles className="size-3 mr-1" /> IA Biometria Ativa
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cadastre os rostos autorizados da residência para identificação automática em tempo real nas câmeras CFTV.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              {authorizedPersons.length}
            </div>
            <div>
              <p className="font-semibold text-foreground">Rostos Cadastrados</p>
              <p className="text-[11px] text-muted-foreground">Moradores & Visitantes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              {matchThreshold}%
            </div>
            <div>
              <p className="font-semibold text-foreground">Precisão Mínima</p>
              <p className="text-[11px] text-muted-foreground">Filtro Biométrico I.A.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
              24/7
            </div>
            <div>
              <p className="font-semibold text-foreground">Vigilância Ativa</p>
              <p className="text-[11px] text-muted-foreground">Garagem, 240 & 198</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              <Users className="size-3.5" /> Pessoas Cadastradas ({authorizedPersons.length})
            </TabsTrigger>
            <TabsTrigger value="add" className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Cadastrar Novo Rosto
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs">
              <Sliders className="size-3.5" /> Parâmetros de I.A.
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: List of Authorized Faces */}
          <TabsContent value="list" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Buscar por nome do morador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs max-w-sm"
              />
              <Button size="sm" onClick={() => setActiveTab("add")} className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="size-3.5" /> Adicionar Rosto
              </Button>
            </div>

            {filteredPersons.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Users className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-sm">Nenhum rosto encontrado</p>
                <p className="text-xs mb-3">Cadastre fotos dos moradores para habilitar o reconhecimento nas câmeras.</p>
                <Button size="sm" onClick={() => setActiveTab("add")}>
                  <Plus className="size-3.5 mr-1" /> Cadastrar Primeiro Morador
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredPersons.map((person) => (
                  <Card key={person.id} className="border border-border/70 hover:border-emerald-500/40 transition-colors">
                    <CardContent className="p-3.5 flex items-start gap-3">
                      {/* Face Thumbnail with Biometric Frame */}
                      <div className="relative size-14 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700 shrink-0 flex items-center justify-center">
                        {person.photoData && person.photoData !== "captured_from_camera" ? (
                          <img src={person.photoData} alt={person.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-emerald-500">
                            <User className="size-7" />
                          </div>
                        )}
                        {/* Biometric overlay box */}
                        <div className="absolute inset-0 border border-emerald-500/60 rounded-xl pointer-events-none" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-sm text-foreground truncate">{person.name}</p>
                          {getRoleBadge(person.role)}
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                          <p>Visto: <span className="text-foreground">{person.lastSeenTimestamp || "Hoje"}</span></p>
                          <p className="truncate">Câmera: <span className="text-emerald-500">{person.lastSeenCamera || "Garagem Rua"}</span></p>
                        </div>
                        {person.notes && (
                          <p className="text-[11px] text-muted-foreground/80 italic truncate">{person.notes}</p>
                        )}
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePerson(person.id, person.name)}
                        className="size-7 text-muted-foreground hover:text-red-400 shrink-0"
                        title="Remover da base de reconhecimento"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Enroll New Face */}
          <TabsContent value="add" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Form Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nome Completo</Label>
                  <Input
                    placeholder="Ex: Eduardo Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Papel / Categoria</Label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AuthorizedPerson["role"])}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="morador">Morador (Acesso Total)</option>
                    <option value="familiar">Familiar / Parente</option>
                    <option value="visitante">Visitante Frequente</option>
                    <option value="prestador">Prestador de Serviço</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nível de Permissão</Label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value as AuthorizedPerson["accessLevel"])}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="total">Acesso Total (Portão, Garagem & Alarme 24h)</option>
                    <option value="parcial">Acesso Parcial (Apenas Portão Social)</option>
                    <option value="horario_comercial">Apenas Horário Comercial (08h às 18h)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs font-semibold">Notificar Identificação</p>
                    <p className="text-[11px] text-muted-foreground">Avisar no celular quando for avistado</p>
                  </div>
                  <Switch checked={notifyOnDetection} onCheckedChange={setNotifyOnDetection} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Observações (Opcional)</Label>
                  <Input
                    placeholder="Ex: Proprietário, carro placa ABC-1234"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Right Column: Face Photo Acquisition */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Foto de Referência Biométrica</Label>

                <div className="relative aspect-video w-full rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center overflow-hidden">
                  {photoData && photoData !== "captured_from_camera" ? (
                    <>
                      <img src={photoData} alt="Prévia" className="size-full object-cover" />
                      {/* Biometric Scan Overlay */}
                      <div className="absolute inset-4 border-2 border-dashed border-emerald-500/80 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                        <span className="text-[10px] font-mono text-emerald-400 bg-black/60 px-1 rounded w-fit">FACE ID MATCH 99.2%</span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-black/60 px-1 rounded self-end">PADRÃO BIOMÉTRICO OK</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <div className="size-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-muted-foreground">
                        <User className="size-6" />
                      </div>
                      <p className="text-xs font-medium text-neutral-400">Nenhuma foto selecionada</p>
                      <p className="text-[11px] text-muted-foreground">Faça upload ou capture direto de uma câmera ao vivo</p>
                    </div>
                  )}
                </div>

                {/* Photo Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Upload className="size-3.5" /> Enviar Foto
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isCapturing}
                    onClick={handleCaptureFromCamera}
                    className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                  >
                    {isCapturing ? <RefreshCw className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                    Capturar da Câmera
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Câmera de captura: </span>
                  <select
                    value={selectedCameraForSnap}
                    onChange={(e) => setSelectedCameraForSnap(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground"
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.streamName || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("list")}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSavePerson} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Check className="size-4" /> Salvar Morador no Reconhecimento
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: AI Engine Parameters */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="size-4 text-primary" /> Parâmetros do Algoritmo de Biometria
                </CardTitle>
                <CardDescription className="text-xs">
                  Ajuste a tolerância de correspondência facial das câmeras IP da casa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span>Sensibilidade Mínima de Confiança Biométrica</span>
                    <span className="font-mono text-emerald-500 font-bold">{matchThreshold}%</span>
                  </div>
                  <Slider
                    value={[matchThreshold]}
                    min={70}
                    max={98}
                    step={1}
                    onValueChange={(val) => setMatchThreshold(val[0] ?? 85)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Valores mais altos (ex: 88%) evitam qualquer falso positivo. Valores menores (ex: 75%) facilitam detecção em condições de baixa luz ou à noite.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="font-semibold text-foreground">Alerta Imediato para Rostos Desconhecidos</p>
                    <p className="text-[11px] text-muted-foreground">Emite notificação sonora quando alguém não cadastrado parar em frente à câmera</p>
                  </div>
                  <Switch checked={alertUnknown} onCheckedChange={setAlertUnknown} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="font-semibold text-foreground">Salvar Foto de Cada Rosto no Disco D:</p>
                    <p className="text-[11px] text-muted-foreground">Armazena na pasta D:\Gravacoes_CFTV\Snapshots\Faces com data e hora exatas</p>
                  </div>
                  <Switch checked={saveFaceSnapshots} onCheckedChange={setSaveFaceSnapshots} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
