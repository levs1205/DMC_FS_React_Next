import { NextResponse } from "next/server";
import { ApiError } from "@/lib/http/api-error";

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.statusCode });
  }

  console.error(error);
  return NextResponse.json(
    { message: "Error interno del servidor." },
    { status: 500 }
  );
}
