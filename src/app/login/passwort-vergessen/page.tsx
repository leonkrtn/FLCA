import { LoginKarte } from "../karte";
import { VergessenFormular } from "../formulare";

export default function Vergessen() {
  return (
    <LoginKarte titel="Passwort vergessen">
      <VergessenFormular />
    </LoginKarte>
  );
}
