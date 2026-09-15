import { NextResponse, type NextRequest } from "next/server";
import { validateQuery } from "@/lib/http/validate-query";
import { withApiRoute } from "@/lib/http/with-api-route";
import { studentSearchSchema } from "@/modules/analytics/analytics.schemas";
import { analyticsService } from "@/modules/analytics/analytics.service";
import { requireApiSession } from "@/modules/auth/auth.session";

/**
 * GET /api/analytics/student?q=ana&limit=10
 *
 * Alumnos que coinciden con el texto, con su actividad resumida (cuántas
 * reservas, cuánto suman, primera y última entrada).
 *
 * Es el paso previo de casi cualquier conversación: el usuario dice "Ana" y el
 * agente necesita un id para poder filtrar sin ambigüedad. Si hay dos Anas,
 * acá se ven las dos y el chatbot puede repreguntar en vez de elegir una al
 * azar y dar un número equivocado con total seguridad.
 *
 * Devuelve id, nombre y usuario. Nada más: la contraseña ni siquiera sale de
 * la base de datos.
 */
export const GET = withApiRoute(
  "/api/analytics/student",
  async (request: NextRequest) => {
    await requireApiSession("ADMIN");

    const query = validateQuery(
      studentSearchSchema,
      request.nextUrl.searchParams
    );
    const students = await analyticsService.searchStudents(query);

    return NextResponse.json(students);
  }
);
