import { jsonCors, optionsCors } from "../../../lib/cors";
import { loginUsuario } from "../../../lib/services/authService";

type LoginBody = {
  email: string;
  password: string;
};

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

export async function POST(request: Request) {
  try {
    const body: LoginBody = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return jsonCors(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 },
        request
      );
    }

    const result = await loginUsuario(email, password);

    if (!result) {
      return jsonCors(
        { error: "Credenciales inválidas" },
        { status: 401 },
        request
      );
    }

    return jsonCors(
      {
        message: "Login correcto",
        token: result.token,
        usuario: result.usuario,
      },
      { status: 200 },
      request
    );
  } catch (error) {
    console.error("Error en /api/login:", error);
    return jsonCors(
      { error: "Error interno del servidor" },
      { status: 500 },
      request
    );
  }
}
