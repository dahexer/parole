import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-aac",
  "audio/m4a",
  "video/mp4",
];

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    const language = incoming.get("language") === "en" ? "en" : "it";
    const messages = language === "en" ? {
      notConfigured: "Remote mode is not configured on the server.",
      missing: "Audio file is missing.",
      empty: "The audio file is empty.",
      large: "The audio segment is too large.",
      format: "Unsupported audio format.",
      authentication: "The OpenAI API key is invalid or no longer active.",
      quota: "OpenAI rejected the request because the project has no available quota or has reached a rate limit.",
      rejected: "OpenAI could not process this audio file. Check the format and transcription model.",
      unavailable: "The transcription service is temporarily unavailable.",
    } : {
      notConfigured: "La modalità remota non è configurata sul server.",
      missing: "File audio mancante.",
      empty: "Il file audio è vuoto.",
      large: "Il segmento audio è troppo grande.",
      format: "Formato audio non supportato.",
      authentication: "La chiave API OpenAI non è valida o non è più attiva.",
      quota: "OpenAI ha rifiutato la richiesta perché il progetto non ha quota disponibile o ha raggiunto un limite.",
      rejected: "OpenAI non è riuscito a elaborare questo file audio. Controlla il formato e il modello di trascrizione.",
      unavailable: "Il servizio di trascrizione non è momentaneamente disponibile.",
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: messages.notConfigured }, { status: 503 });
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: messages.missing }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: messages.empty }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: messages.large }, { status: 413 });
    }

    const baseType = audio.type.split(";")[0];
    if (baseType && !ALLOWED_AUDIO_TYPES.includes(baseType)) {
      return NextResponse.json({ error: messages.format }, { status: 415 });
    }

    const body = new FormData();
    body.append("file", audio, audio.name || "segment.webm");
    const transcriptionModel = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
    body.append("model", transcriptionModel);
    body.append("language", language);
    // Segment timestamps via verbose_json are supported by Whisper. The GPT-4o
    // transcription models use JSON; requesting Whisper-only options makes the
    // provider reject otherwise valid audio uploads.
    if (transcriptionModel === "whisper-1") {
      body.append("response_format", "verbose_json");
      body.append("timestamp_granularities[]", "segment");
    } else {
      body.append("response_format", "json");
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(120_000),
    });

    const result = (await openAIResponse.json()) as {
      text?: string;
      duration?: number;
      segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
      error?: { message?: string };
    };
    if (!openAIResponse.ok) {
      console.error("OpenAI transcription error", openAIResponse.status);
      const error = openAIResponse.status === 401 || openAIResponse.status === 403
        ? messages.authentication
        : openAIResponse.status === 429
          ? messages.quota
          : openAIResponse.status === 400
            ? messages.rejected
            : messages.unavailable;
      return NextResponse.json(
        { error },
        { status: openAIResponse.status === 429 ? 429 : openAIResponse.status === 401 || openAIResponse.status === 403 ? 503 : 502 },
      );
    }

    return NextResponse.json({
      text: result.text?.trim() ?? "",
      durationMs: typeof result.duration === "number" ? Math.round(result.duration * 1_000) : null,
      segments: result.segments?.flatMap((segment, index) => {
        const text = segment.text?.trim();
        if (!text) return [];
        return [{
          id: `transcription-${Date.now()}-${segment.id ?? index}`,
          text,
          startMs: typeof segment.start === "number" ? Math.round(segment.start * 1_000) : null,
          endMs: typeof segment.end === "number" ? Math.round(segment.end * 1_000) : null,
        }];
      }) ?? [],
    });
  } catch (error) {
    console.error("Transcription route error", error);
    return NextResponse.json(
      { error: "The audio segment could not be processed / Non è stato possibile elaborare il segmento audio." },
      { status: 500 },
    );
  }
}
