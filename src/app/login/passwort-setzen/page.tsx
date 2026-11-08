import { LoginKarte } from "../karte";
import { SetzenFormular } from "../formulare";

export default function Setzen() {
  return (
    <LoginKarte titel="Passwort festlegen">
      <SetzenFormular />
    </LoginKarte>
  );
}
