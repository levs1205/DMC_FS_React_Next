import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/http/with-api-route";
import { requireApiSession } from "@/modules/auth/auth.session";
import { userService } from "@/modules/users/user.service";

export const GET = withApiRoute("/api/user", async () => {
  await requireApiSession("ADMIN");

  const users = await userService.listUsers();
  return NextResponse.json(users);
});
