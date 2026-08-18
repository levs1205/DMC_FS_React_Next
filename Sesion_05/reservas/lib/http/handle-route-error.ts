import { NextResponse } from "next/server";
import { ApiError } from "@/lib/http/api-error";

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.statusCode },
    );
  } 

  return NextResponse.json(
    { message: "Internal Server Error" },
    { status: 500 },
  );
}
