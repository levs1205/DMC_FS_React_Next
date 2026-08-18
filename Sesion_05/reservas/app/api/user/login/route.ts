import { NextResponse, type NextRequest } from "next/server"
import { ApiError } from "@/lib/http/api-error"
import { handleRouteError } from "@/lib/http/handle-route-error"
import { userService } from "@/modules/users/user.service"
import type { UserLogin} from "@/modules/users/user.types"


export async function POST (request: NextRequest){

    try
    {
        let body: Partial<UserLogin>;
        
        try {
            body = await request.json();
        } catch (error) {
            throw new ApiError("Error en el body", 400);
        }


        const user = await userService.login(
            {
                user: body.user ?? "",
                password: body.password ?? ""
            }
        );

        return NextResponse.json(user);

    }
    catch(error){
        return handleRouteError(error);
    }

}