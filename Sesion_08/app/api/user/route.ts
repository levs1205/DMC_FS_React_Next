import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { userService } from "@/modules/users/user.service";
import { requireApiSession } from "@/modules/auth/auth.sessions";

export async function GET() {
  try {
    await requireApiSession("ADMIN");
    const users = await userService.listUsers();
    return NextResponse.json(users);
  } catch (error) {
    return handleRouteError(error);
  }
}
