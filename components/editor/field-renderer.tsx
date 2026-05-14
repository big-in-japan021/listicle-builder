"use client";

import { useCallback } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  emptyItemForList,
  getPath,
  setPath,
  type SpecPath,
} from "@/lib/spec-utils";
import {
  isGroup,
  isList,
  type Field,
  type GroupField,
  type LeafField,
  type ListField,
} from "@/lib/template-schema";
import type { Spec } from "@/lib/types";

type CommonProps = {
  spec: Spec;
  /** Caminho completo até o pai (vazio na raiz, "list_items.2" dentro de um item). */
  pathPrefix: SpecPath | "";
  onChange: (next: Spec) => void;
};

function joinPath(prefix: string, key: string): string {
  if (!prefix) return key;
  return `${prefix}.${key}`;
}

export function FieldRenderer({ field, ...rest }: CommonProps & { field: Field }) {
  if (isGroup(field)) return <GroupRenderer field={field} {...rest} />;
  if (isList(field)) return <ListRenderer field={field} {...rest} />;
  return <LeafRenderer field={field} {...rest} />;
}

function GroupRenderer({
  field,
  spec,
  pathPrefix,
  onChange,
}: CommonProps & { field: GroupField }) {
  const groupPath = joinPath(pathPrefix, field.key);
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {field.label}
        </h3>
        {field.help ? (
          <p className="text-xs text-muted-foreground">{field.help}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {field.fields.map((child) => (
          <FieldRenderer
            key={child.key}
            field={child}
            spec={spec}
            pathPrefix={groupPath}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function ListRenderer({
  field,
  spec,
  pathPrefix,
  onChange,
}: CommonProps & { field: ListField }) {
  const listPath = joinPath(pathPrefix, field.key);
  const items = (getPath(spec, listPath) as unknown[] | undefined) ?? [];
  const min = field.min ?? 0;
  const max = field.max ?? 99;
  const canRemove = items.length > min;
  const canAdd = items.length < max;

  const handleAdd = () => {
    const next = [...items, emptyItemForList(field, items.length)];
    onChange(setPath(spec, listPath, next));
  };

  const handleRemove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(setPath(spec, listPath, next));
  };

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {field.label}{" "}
            <span className="text-xs font-normal normal-case text-muted-foreground/80">
              ({items.length}
              {field.recommended_count
                ? ` — recomendado ${field.recommended_count[0]}–${field.recommended_count[1]}`
                : ""}
              )
            </span>
          </h3>
          {field.help ? (
            <p className="text-xs text-muted-foreground">{field.help}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!canAdd}
        >
          + Adicionar
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((_, i) => (
          <Card
            key={`${listPath}.${i}`}
            className="flex flex-col gap-3 border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Item {i + 1}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => handleRemove(i)}
                disabled={!canRemove}
              >
                Remover
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {field.fields.map((child) => (
                <FieldRenderer
                  key={child.key}
                  field={child}
                  spec={spec}
                  pathPrefix={`${listPath}.${i}`}
                  onChange={onChange}
                />
              ))}
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Nenhum item. Clique em &ldquo;Adicionar&rdquo;.
          </p>
        )}
      </div>
    </section>
  );
}

function LeafRenderer({
  field,
  spec,
  pathPrefix,
  onChange,
}: CommonProps & { field: LeafField }) {
  const path = joinPath(pathPrefix, field.key);
  const raw = getPath(spec, path);
  const handleChange = useCallback(
    (value: unknown) => onChange(setPath(spec, path, value)),
    [onChange, spec, path]
  );

  switch (field.type) {
    case "text":
      return (
        <FieldShell field={field}>
          <Input
            value={asString(raw)}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </FieldShell>
      );

    case "html":
      return (
        <FieldShell field={field}>
          <Textarea
            value={asString(raw)}
            rows={field.rows ?? 3}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="font-mono text-xs"
          />
        </FieldShell>
      );

    case "number":
      return (
        <FieldShell field={field}>
          <Input
            type="number"
            value={asString(raw)}
            onChange={(e) => {
              const v = e.target.value;
              handleChange(v === "" ? 0 : Number(v));
            }}
          />
        </FieldShell>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-3 py-1">
          <Checkbox
            id={path}
            checked={Boolean(raw)}
            onCheckedChange={(c) => handleChange(c === true)}
          />
          <Label htmlFor={path} className="cursor-pointer text-sm font-normal">
            {field.label}
          </Label>
        </div>
      );

    case "image":
      return <ImageField field={field} value={asString(raw)} onChange={handleChange} />;

    case "image_ai":
      return <ImageAiField field={field} value={asString(raw)} onChange={handleChange} />;

    case "string_list":
      return (
        <StringListField
          field={field}
          value={Array.isArray(raw) ? (raw as string[]) : []}
          onChange={handleChange}
        />
      );

    default:
      return null;
  }
}

function FieldShell({
  field,
  children,
}: {
  field: LeafField;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground">{field.label}</Label>
      {children}
      {field.help ? (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      ) : null}
    </div>
  );
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function ImageField({
  field,
  value,
  onChange,
}: {
  field: LeafField;
  value: string;
  onChange: (v: string) => void;
}) {
  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onChange(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <FieldShell field={field}>
      <div className="flex flex-col gap-2">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer"
          )}
        >
          {value ? "Trocar imagem" : "Subir imagem"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {value ? (
          <div className="flex items-center gap-2">
            <img
              src={value}
              alt={field.label}
              className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange("")}
            >
              Remover
            </Button>
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}

function ImageAiField({
  field,
  value,
  onChange,
}: {
  field: LeafField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell field={field}>
      <div className="flex flex-col gap-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL da imagem (ou deixe vazio — IA vai gerar no Sprint 5)"
        />
        <p className="text-[11px] italic text-muted-foreground">
          Slot de imagem IA. No Sprint 5 será preenchido automaticamente; por enquanto
          cole uma URL ou deixe vazio.
        </p>
      </div>
    </FieldShell>
  );
}

function StringListField({
  field,
  value,
  onChange,
}: {
  field: LeafField;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...value];
    next[i] = val;
    onChange(next);
  };
  const add = () => onChange([...value, ""]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <FieldShell field={field}>
      <div className="flex flex-col gap-2">
        {value.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder={field.placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => remove(i)}
            >
              ×
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Adicionar bullet
        </Button>
      </div>
    </FieldShell>
  );
}
