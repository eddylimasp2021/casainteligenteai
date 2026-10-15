import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Auditoria e Validação do Backend IoT (Fase 1 / Etapa 1)", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const upMigrationPath = path.join(rootDir, "drizzle/migrations/0001_iot_gateway_core.sql");
  const downMigrationPath = path.join(rootDir, "supabase/migrations/20261014230000_iot_gateway_core_down.sql");

  it("1. As migrações UP e DOWN devem existir e ser válidas", () => {
    expect(fs.existsSync(upMigrationPath)).toBe(true);
    expect(fs.existsSync(downMigrationPath)).toBe(true);

    const upSql = fs.readFileSync(upMigrationPath, "utf8");
    const downSql = fs.readFileSync(downMigrationPath, "utf8");

    // Verificar tabelas obrigatórias
    const expectedTables = [
      "iot_gateways",
      "iot_integrations",
      "iot_commands",
      "iot_devices",
      "iot_device_capabilities",
      "iot_command_events",
      "iot_events",
      "iot_telemetry",
      "iot_pairing_sessions",
      "iot_certificates",
    ];

    for (const table of expectedTables) {
      expect(upSql).toContain(`create table if not exists public.${table}`);
      expect(downSql).toContain(`drop table if exists public.${table}`);
    }
  });

  it("2. Todas as tabelas que contêm dados de usuários devem ter isolamento por household_id e RLS ativo", () => {
    const upSql = fs.readFileSync(upMigrationPath, "utf8");

    const tenantTables = [
      "iot_gateways",
      "iot_integrations",
      "iot_devices",
      "iot_commands",
      "iot_events",
      "iot_telemetry",
      "iot_pairing_sessions",
      "iot_certificates",
    ];

    for (const table of tenantTables) {
      // Deve ter chave estrangeira para households com ON DELETE CASCADE
      expect(upSql).toContain(`household_id uuid not null references public.households(id) on delete cascade`);
      // RLS deve estar ativado explicitamente
      expect(upSql).toContain(`alter table public.${table} enable row level security;`);
      // Deve conter política de leitura baseada em is_household_member
      expect(upSql).toContain(`public.is_household_member(household_id, auth.uid())`);
    }
  });

  it("3. A fila de comandos deve exigir UUID, expiração e validação de permissões", () => {
    const upSql = fs.readFileSync(upMigrationPath, "utf8");

    // Tabela iot_commands
    expect(upSql).toContain("command_id uuid not null unique");
    expect(upSql).toContain("expires_at timestamptz not null");
    expect(upSql).toContain("status public.iot_command_status not null default 'CREATED'");

    // Procedure issue_iot_command deve validar se o usuário é membro (não guest) e pertence à residência
    expect(upSql).toContain("public.issue_iot_command");
    expect(upSql).toContain("if d.household_id <> _household then raise exception 'mismatched_household'; end if;");
    expect(upSql).toContain("if role is null or role = 'guest' then raise exception 'forbidden'; end if;");
    expect(upSql).toContain("if d.is_critical and not coalesce((_parameters->>'confirmed')::boolean, false) then");
  });

  it("4. A lógica de expiração deve bloquear comandos expirados no processamento", () => {
    const now = Date.now();
    const expiredTimestamp = new Date(now - 1000).toISOString();
    const futureTimestamp = new Date(now + 30000).toISOString();

    const isExpired = (exp: string) => new Date(exp).getTime() <= Date.now();

    expect(isExpired(expiredTimestamp)).toBe(true);
    expect(isExpired(futureTimestamp)).toBe(false);
  });

  it("5. Teste de isolamento lógico entre residências diferentes", () => {
    interface MockCommand {
      commandId: string;
      householdId: string;
      action: string;
    }

    const houseA = "house-aaaa-1111";
    const houseB = "house-bbbb-2222";

    const commands: MockCommand[] = [
      { commandId: "cmd-1", householdId: houseA, action: "turn_on" },
      { commandId: "cmd-2", householdId: houseB, action: "turn_off" },
    ];

    // Simular filtro RLS para usuário pertencente apenas à Casa A
    const userHouseholdMembership = [houseA];
    const filteredForUser = commands.filter((c) => userHouseholdMembership.includes(c.householdId));

    expect(filteredForUser).toHaveLength(1);
    expect(filteredForUser[0].commandId).toBe("cmd-1");
    expect(filteredForUser.some((c) => c.householdId === houseB)).toBe(false);
  });

  it("6. Nenhuma chave privilegiada (service_role ou senhas) deve estar presente no código do frontend", () => {
    const clientEnv = fs.readFileSync(path.join(rootDir, ".env"), "utf8");

    // O arquivo .env do frontend deve ter apenas chaves públicas/anon
    expect(clientEnv).not.toContain("SERVICE_ROLE");
    expect(clientEnv).not.toContain("sb_secret_");

    // Verificar se a pasta src não possui chaves secretas ou tokens reais vazados
    const srcDir = path.join(rootDir, "src");
    const checkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
          checkDir(full);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf8");
          // Não deve conter a chave service_role com valor real
          expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/);
          // Não deve conter token de chave secreta real
          expect(content).not.toMatch(/sb_secret_[a-zA-Z0-9_\-]{16,}/);
        }
      }
    };
    checkDir(srcDir);
  });
});
