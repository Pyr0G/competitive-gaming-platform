# CGP, platforma turniejowa CS2

Projekt studencki z przedmiotu Technologie Internetowe (UKW Bydgoszcz). Całość siedzi w jednym repo i działa jako jedna usługa: backend serwuje stronę i API pod tym samym adresem.

## Struktura

| Folder | Co jest w środku |
| --- | --- |
| `frontend/` | strona: `index.html`, `style.css`, `app.js` (turnieje, ogłoszenia, ranking, konto), `veto.js` (symulator veto map), grafiki w `assets/` |
| `backend/` | Node.js + Express: logowanie, maile, API dla turniejów i ogłoszeń |
| `database/` | `schema.sql` (tabele), `seed.sql` (dane przykładowe), opis bazy |
| `render.yaml` | konfiguracja hostingu na Render |

## Jak to działa

- Backend przy starcie sprawdza bazę. Jeśli jest pusta, sam wgrywa `schema.sql` i `seed.sql`.
- Ranking drużyn liczy się na stronie z wyników meczów, które przychodzą z `GET /api/tournaments`.
- Veto map działa tylko na stronie, nic nie zapisuje w bazie.
- Maile (aktywacja konta, reset hasła) idą przez API Brevo. Bez klucza linki lądują w logach serwera.
- Sesja to podpisany token w ciasteczku `cgp_session` (httpOnly).
- Strona działa też bez backendu (otwarta z dysku), wtedy formularze pokazują tryb demo.

## API

| Metoda i adres | Co robi |
| --- | --- |
| `GET /api/health` | sprawdza, czy serwer i baza żyją |
| `GET /api/tournaments` | turnieje z drabinkami i zapisanymi drużynami |
| `GET /api/ads` | aktywne ogłoszenia, `mine` mówi, czy to Twoje |
| `POST /api/ads` | nowe ogłoszenie (zalogowany, LFM tylko kapitan, max 3 naraz) |
| `DELETE /api/ads/:id` | zamknięcie swojego ogłoszenia || `POST /api/auth/register` | rejestracja, wysyła link aktywacyjny |
| `GET /api/auth/verify?token=` | aktywacja konta z linku w mailu |
| `POST /api/auth/login` | logowanie nickiem albo mailem |
| `POST /api/auth/logout` | wylogowanie |
| `GET /api/auth/me` | kto jest zalogowany |
| `POST /api/auth/resend` | ponowny link aktywacyjny |
| `POST /api/auth/forgot` | link do zmiany hasła |
| `POST /api/auth/reset` | ustawienie nowego hasła |

## Uruchomienie lokalnie

1. Skopiuj `.env.example` jako `.env` i wpisz `DATABASE_URL`.
2. `cd backend`, potem `npm install` i `npm run dev`.
3. Strona jest pod `http://localhost:3000`.

`npm run db:reset` czyści bazę i wgrywa ją od nowa.

## Zasady pisania kodu

- Bez komentarzy w kodzie. Kod ma być prosty i czytelny sam z siebie.
- Teksty na stronie po polsku, luźnym językiem, bez długich myślników i kropek środkowych.
- Zmiany w bazie zawsze w `schema.sql` i `seed.sql`, a opis w `database/README.md`.- Testowe konta mają hasło `haslo123`, maile w stylu `bartek@example.com`.
- Małe commity, każdy dotyczy jednej rzeczy.
