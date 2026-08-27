import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateBody } from "@/lib/http/validate-body";
import { loginSchema } from "@/modules/users/user.schemas";
import { userService } from "@/modules/users/user.service";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const credentials = validateBody(loginSchema, body);
    const user = await userService.login(credentials);

    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
