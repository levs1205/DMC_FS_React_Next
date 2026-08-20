import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { userService } from "@/modules/users/user.service";

export async function GET() {
  try {
    const users = await userService.listUsers();
    return NextResponse.json(users);
  } catch (error) {
    return handleRouteError(error);
  }
}
