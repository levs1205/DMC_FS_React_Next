import { NextResponse } from "next/server";
import { userService } from "@/modules/users/user.service";
import { handleRouteError } from "@/lib/http/handle-route-error";

export async function GET() {
  try {
    const users = await userService.listUsers();
    return NextResponse.json(users);
  } catch (error) {
    return handleRouteError(error);
  }
}
