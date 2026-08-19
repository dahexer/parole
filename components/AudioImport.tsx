"use client";

import { useRef, useState } from "react";
import type { Language } from "@/lib/analysisTypes";

const ACCEPT = ".mp3,.wav,.m4a,.mp4,.webm,.ogg,.aac,audio/*";

export function AudioImport({ language, disabled, onFile }: { language: Language; disabled: boolean; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const copy = language === "it" ? {
    title: "Importa un file audio",
    body: "Trascina qui MP3, WAV, M4A, MP4, WebM, OGG o AAC (massimo 25 MB)",
    choose: "Scegli file",
  } : {
    title: "Import an audio file",
    body: "Drop MP3, WAV, M4A, MP4, WebM, OGG or AAC here (maximum 25 MB)",
    choose: "Choose file",
  };
  const accept = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };
  return (
    <div
      className={`audio-import ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) accept(event.dataTransfer.files);
      }}
    >
      <div><strong>{copy.title}</strong><small>{copy.body}</small></div>
      <button type="button" className="secondary-control" disabled={disabled} onClick={() => inputRef.current?.click()}>{copy.choose}</button>
      <input ref={inputRef} className="sr-only" type="file" accept={ACCEPT} disabled={disabled} onChange={(event) => accept(event.target.files)} />
    </div>
  );
}
