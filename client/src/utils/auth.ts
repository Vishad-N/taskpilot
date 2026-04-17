import { jwtDecode } from "jwt-decode";

type TokenPayload = {
  role: string;
};

export function getUserRole() {

  const token = localStorage.getItem("token");

  if (!token) return null;

  const decoded = jwtDecode<TokenPayload>(token);

  return decoded.role;
}
