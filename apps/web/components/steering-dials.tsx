"use client";

import type { SteeringInputs } from "@prompt-engineer/validators";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNIVERSAL_DIALS, CATEGORY_DIALS, type DialDefinition } from "@/lib/steering-dials";

interface SteeringDialsProps {
  steeringInputs: SteeringInputs;
  onChange: (inputs: SteeringInputs) => void;
}

export function SteeringDials({ steeringInputs, onChange }: SteeringDialsProps) {
  const categoryDials = steeringInputs.taskType
    ? CATEGORY_DIALS[steeringInputs.taskType]
    : [];

  const handleUniversalSlider = (key: string, value: number[]) => {
    onChange({ ...steeringInputs, [key]: value[0] });
  };

  const handleCategoryDial = (key: string, value: number | boolean | string) => {
    onChange({
      ...steeringInputs,
      categoryDials: { ...steeringInputs.categoryDials, [key]: value },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {UNIVERSAL_DIALS.map((dial) => (
        <SliderDial
          key={dial.key}
          dial={dial}
          value={(steeringInputs[dial.key as keyof SteeringInputs] as number) ?? dial.defaultValue ?? 50}
          onChange={(v) => handleUniversalSlider(dial.key, v)}
        />
      ))}

      {categoryDials.length > 0 && (
        <div className="border-t border-white/[0.06] pt-5 flex flex-col gap-5">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {steeringInputs.taskType} options
          </span>
          {categoryDials.map((dial) => (
            <DialControl
              key={dial.key}
              dial={dial}
              value={steeringInputs.categoryDials?.[dial.key]}
              onChange={(v) => handleCategoryDial(dial.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SliderDial({
  dial,
  value,
  onChange,
}: {
  dial: DialDefinition;
  value: number;
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">{dial.label}</label>
        <span className="text-xs font-mono text-violet-400/80">{value}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-600 w-16 text-right">{dial.minLabel}</span>
        <Slider
          value={[value]}
          onValueChange={onChange}
          min={dial.min ?? 0}
          max={dial.max ?? 100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-zinc-600 w-16">{dial.maxLabel}</span>
      </div>
    </div>
  );
}

function DialControl({
  dial,
  value,
  onChange,
}: {
  dial: DialDefinition;
  value: unknown;
  onChange: (value: number | boolean | string) => void;
}) {
  if (dial.type === "slider") {
    return (
      <SliderDial
        dial={dial}
        value={(value as number) ?? dial.defaultValue ?? 50}
        onChange={(v) => onChange(v[0])}
      />
    );
  }

  if (dial.type === "toggle") {
    const checked = (value as boolean) ?? dial.defaultChecked ?? false;
    return (
      <label className="flex items-center justify-between cursor-pointer group">
        <span className="text-sm font-medium text-zinc-300">{dial.label}</span>
        <button
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
            checked
              ? "bg-gradient-to-r from-violet-600 to-cyan-600 shadow-sm shadow-violet-500/20"
              : "bg-white/[0.08]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>
    );
  }

  if (dial.type === "select" && dial.options) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">{dial.label}</label>
        <Select
          value={(value as string) ?? dial.defaultOption}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dial.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}
