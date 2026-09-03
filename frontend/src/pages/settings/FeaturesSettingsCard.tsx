import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useFeatureConfig, useSetSectorFeatures, useSetUserFeatures } from '@/hooks/useFeatures';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner, Alert } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { FeatureConfigSector, FeatureConfigUser } from '@/hooks/useFeatures';
import type { PlatformFeatureDef } from '@/lib/platform-features';

function FeatureCheckboxList({
  catalog,
  enabledCeiling,
  disabled,
  onToggle,
  pending,
}: {
  catalog: PlatformFeatureDef[];
  enabledCeiling: string[];
  disabled: string[];
  onToggle: (key: string) => void;
  pending: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 pl-6 pt-2 sm:grid-cols-2">
      {catalog.map((f) => {
        const withinCeiling = enabledCeiling.includes(f.key);
        const checked = withinCeiling && !disabled.includes(f.key);
        return (
          <label
            key={f.key}
            className={cn(
              'flex items-center gap-2 text-sm',
              withinCeiling ? 'text-slate-700' : 'text-slate-400',
            )}
            title={withinCeiling ? undefined : 'Não contratado pela empresa — fale com o dono da plataforma'}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!withinCeiling || pending}
              onChange={() => onToggle(f.key)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {f.label}
            {!withinCeiling && <Badge tone="neutral" className="text-[10px]">não contratado</Badge>}
          </label>
        );
      })}
    </div>
  );
}

function SectorRow({
  sector,
  catalog,
  enabledCeiling,
}: {
  sector: FeatureConfigSector;
  catalog: PlatformFeatureDef[];
  enabledCeiling: string[];
}) {
  const [open, setOpen] = useState(false);
  const setSectorFeatures = useSetSectorFeatures();

  const toggle = (key: string) => {
    const next = sector.disabledFeatures.includes(key)
      ? sector.disabledFeatures.filter((k) => k !== key)
      : [...sector.disabledFeatures, key];
    setSectorFeatures.mutate({ sectorId: sector.id, disabledFeatures: next });
  };

  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-800"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        {sector.name}
        {sector.disabledFeatures.length > 0 && (
          <Badge tone="warning">{sector.disabledFeatures.length} bloqueada(s)</Badge>
        )}
      </button>
      {open && (
        <FeatureCheckboxList
          catalog={catalog}
          enabledCeiling={enabledCeiling}
          disabled={sector.disabledFeatures}
          onToggle={toggle}
          pending={setSectorFeatures.isPending}
        />
      )}
    </div>
  );
}

function UserRow({
  member,
  catalog,
  enabledCeiling,
}: {
  member: FeatureConfigUser;
  catalog: PlatformFeatureDef[];
  enabledCeiling: string[];
}) {
  const [open, setOpen] = useState(false);
  const setUserFeatures = useSetUserFeatures();

  const toggle = (key: string) => {
    const next = member.disabledFeatures.includes(key)
      ? member.disabledFeatures.filter((k) => k !== key)
      : [...member.disabledFeatures, key];
    setUserFeatures.mutate({ userId: member.id, disabledFeatures: next });
  };

  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-800"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        {member.name}
        <span className="text-xs font-normal text-slate-400">{member.email}</span>
        {member.disabledFeatures.length > 0 && (
          <Badge tone="warning">{member.disabledFeatures.length} bloqueada(s)</Badge>
        )}
      </button>
      {open && (
        <FeatureCheckboxList
          catalog={catalog}
          enabledCeiling={enabledCeiling}
          disabled={member.disabledFeatures}
          onToggle={toggle}
          pending={setUserFeatures.isPending}
        />
      )}
    </div>
  );
}

export function FeaturesSettingsCard() {
  const { data: config, isLoading } = useFeatureConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Ferramentas por setor e usuário</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !config ? (
          <Spinner />
        ) : (
          <div className="space-y-5">
            <Alert tone="info">
              Sua empresa tem acesso às ferramentas listadas em cinza claro/marcadas abaixo (contratadas com a
              plataforma). Desmarque uma ferramenta pra um setor ou usuário específico pra bloquear só pra eles —
              nunca é possível liberar algo que a empresa não contratou.
            </Alert>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Por setor</p>
              {config.sectors.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum setor cadastrado ainda (crie setores na aba de leads do CRM).</p>
              ) : (
                config.sectors.map((sector) => (
                  <SectorRow key={sector.id} sector={sector} catalog={config.catalog} enabledCeiling={config.enabledFeatures} />
                ))
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Por usuário</p>
              {config.users.map((member) => (
                <UserRow key={member.id} member={member} catalog={config.catalog} enabledCeiling={config.enabledFeatures} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
