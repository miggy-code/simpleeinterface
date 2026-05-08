import { NextResponse } from "next/server";

export class AppError extends Error {
  status: number;
  expose: boolean;

  constructor(message: string, opts?: { status?: number; expose?: boolean }) {
    super(message);
    this.name = this.constructor.name;
    this.status = opts?.status ?? 500;
    this.expose = opts?.expose ?? this.status < 500;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, { status: 400, expose: true });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, { status: 404, expose: true });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, { status: 409, expose: true });
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, { status: 500, expose: true });
  }
}

export function toErrorResponse(
  err: unknown,
  fallbackMessage = "Internal server error"
) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.expose ? err.message : fallbackMessage },
      { status: err.status }
    );
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
