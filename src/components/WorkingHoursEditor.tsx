import type { DayHours, WeeklyHours } from '../types';
import { DOW_FULL, DOW_ORDER, validateDayHours, weekSummary } from '../lib/schedule';
import { Btn, Icon, Toggle } from './ui';

const timeInput =
  'w-[104px] rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] font-semibold text-ink transition-colors focus:border-moss tnum';

export function WorkingHoursEditor({ value, onChange, accent = '#157f63' }: {
  value: WeeklyHours;
  onChange: (wh: WeeklyHours) => void;
  accent?: string;
}) {
  const setDay = (dow: number, patch: Partial<DayHours>) => {
    onChange({ ...value, [dow]: { ...value[dow], ...patch } });
  };

  const copyDay = (from: number) => {
    const src = value[from];
    const next = { ...value };
    for (let d = 0; d < 7; d++) next[d] = { ...src };
    onChange(next);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-bold"
          style={{ background: `${accent}18`, color: accent }}>
          <Icon name="clock" size={13} />
          {weekSummary(value)}
        </span>
        <div className="flex gap-1.5">
          <Btn variant="outline" size="sm" icon="copy" onClick={() => copyDay(1)}>Replicar segunda</Btn>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {DOW_ORDER.map((dow, i) => {
          const d = value[dow];
          const err = validateDayHours(d);
          return (
            <div key={dow} className={`${i > 0 ? 'border-t border-line' : ''} ${d.closed ? 'bg-paper/70' : 'bg-white'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5">
                <div className="flex w-[132px] items-center justify-between">
                  <span className={`text-[13.5px] font-bold ${d.closed ? 'text-inkfaint' : 'text-ink'}`}>
                    {DOW_FULL[dow]}
                  </span>
                </div>
                <Toggle checked={!d.closed} onChange={(open) => setDay(dow, { closed: !open })} />
                <span className={`text-[11.5px] font-bold uppercase tracking-wide ${d.closed ? 'text-inkfaint' : 'text-moss'}`}>
                  {d.closed ? 'Fechado' : 'Aberto'}
                </span>

                {!d.closed && (
                  <div className="anim-fadeIn flex flex-wrap items-center gap-2">
                    <input type="time" step={900} value={d.start}
                      onChange={(e) => setDay(dow, { start: e.target.value })} className={timeInput} aria-label={`Abertura ${DOW_FULL[dow]}`} />
                    <span className="text-inkfaint">–</span>
                    <input type="time" step={900} value={d.end}
                      onChange={(e) => setDay(dow, { end: e.target.value })} className={timeInput} aria-label={`Fechamento ${DOW_FULL[dow]}`} />

                    <span className="mx-1 h-5 w-px bg-line" />
                    <button
                      onClick={() => setDay(dow, { hasBreak: !d.hasBreak })}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-bold transition-colors ${d.hasBreak ? 'border-amber/30 bg-ambersoft text-amber' : 'border-line bg-card text-inkfaint hover:text-ink'}`}>
                      <Icon name="clock" size={12} />
                      Intervalo
                    </button>
                    {d.hasBreak && (
                      <span className="anim-fadeIn flex items-center gap-2">
                        <input type="time" step={900} value={d.breakStart}
                          onChange={(e) => setDay(dow, { breakStart: e.target.value })} className={timeInput} aria-label="Início do intervalo" />
                        <span className="text-inkfaint">–</span>
                        <input type="time" step={900} value={d.breakEnd}
                          onChange={(e) => setDay(dow, { breakEnd: e.target.value })} className={timeInput} aria-label="Fim do intervalo" />
                      </span>
                    )}

                    <button onClick={() => copyDay(dow)} title={`Copiar horário de ${DOW_FULL[dow]} para todos os dias`}
                      className="ml-auto rounded-md p-1.5 text-inkfaint transition-colors hover:bg-ink/5 hover:text-ink">
                      <Icon name="copy" size={14} />
                    </button>
                  </div>
                )}
              </div>
              {err && (
                <p className="anim-drawIn flex items-center gap-1.5 px-3.5 pb-2.5 text-[12px] font-semibold text-danger">
                  <Icon name="alert" size={12} /> {err}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
