"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { cn } from "../cn";

export interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string;
  /** 0–100 while "uploading"; undefined when idle. Week 1 simulates progress locally. */
  progress?: number;
  error?: string;
}

export interface UploaderProps {
  files: UploadFileItem[];
  onFilesChange: (files: UploadFileItem[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Full uploader shell (vendor product form, admin banners):
 * drag-and-drop, multiple files, previews, reorder-safe ids,
 * per-file type/size errors with retry (remove + re-add), progress
 * slot, and Phase 3 reorder controls (move earlier / later buttons,
 * keyboard- and screen-reader-friendly). Actual upload to storage
 * lands in Week 5; Week 1 validates + previews.
 */
export function Uploader({
  files,
  onFilesChange,
  maxFiles = 8,
  maxSizeMB = 5,
  accept = DEFAULT_ACCEPT,
  label = "Upload images",
}: UploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = accept.split(",").map((t) => t.trim());
    const next: UploadFileItem[] = [];
    for (const file of Array.from(incoming)) {
      if (files.length + next.length >= maxFiles) break;
      if (!accepted.includes(file.type)) {
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: "",
          error: `Unsupported type: ${file.type || "unknown"}. Use JPG, PNG or WebP.`,
        });
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: "",
          error: `File is larger than ${maxSizeMB} MB.`,
        });
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) });
    }
    onFilesChange([...files, ...next]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onFilesChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cream-200 bg-cream-50 px-4 py-8 text-center",
          dragOver && "border-leaf-600 bg-leaf-50",
        )}
      >
        <ImagePlus className="size-8 text-leaf-700" aria-hidden="true" />
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="text-xs text-neutral-600">
          Drag and drop, or click to browse — up to {maxFiles} images, {maxSizeMB} MB each (JPG, PNG, WebP).
        </p>
        <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={onInput} />
      </div>
      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Selected images">
          {files.map((item, index) => (
            <li key={item.id} className="relative overflow-hidden rounded-xl border border-cream-200 bg-white">
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-cream-100 p-2 text-center text-xs text-red-700">
                  {item.error ?? "Preview unavailable"}
                </div>
              )}
              {typeof item.progress === "number" ? (
                <div
                  className="absolute inset-x-0 bottom-0 h-1 bg-leaf-200"
                  role="progressbar"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-leaf-700" style={{ width: `${item.progress}%` }} />
                </div>
              ) : null}
              <p className="truncate px-2 py-1 text-xs text-neutral-600">{item.file.name}</p>
              <span className="absolute start-1 top-1 flex gap-1">
                <button
                  type="button"
                  aria-label={`Move ${item.file.name} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="cursor-pointer rounded-full bg-white p-1 shadow hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.file.name} later`}
                  disabled={index === files.length - 1}
                  onClick={() => move(index, 1)}
                  className="cursor-pointer rounded-full bg-white p-1 shadow hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                onClick={() =>
                  onFilesChange(files.filter((f) => f.id !== item.id))
                }
                className="absolute end-1 top-1 cursor-pointer rounded-full bg-white p-1 shadow hover:bg-cream-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
