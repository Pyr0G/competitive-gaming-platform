# Hosting na R740

Użyj osobnej maszyny wirtualnej z Linuksem i sieci, która nie ma dostępu do zarządzania R740, iDRAC, Hyper-V, Omady, NAS ani innych usług w LAN. Docker sam nie ustawia takiej izolacji. Na zaporze tej maszyny i sieci zablokuj połączenia aplikacji do tych adresów. Dostęp wychodzący ogranicz do wymaganych usług, w tym DNS, HTTPS do Brevo oraz aktualizacji wykonywanych przez administratora.

## Pliki

`docker-compose.yml` jest do lokalnej bazy z przykładowymi danymi. `docker-compose.production.yml` uruchamia aplikację i osobną bazę bez danych demo w osobnym projekcie Compose `cgp-production`. Nie łącz tych plików przez kilka opcji `-f`.

Produkcja publikuje tylko `127.0.0.1:3000`. Baza nie ma portu na hoście, działa w wewnętrznej sieci Dockera i nie dostaje dostępu do sieci aplikacji. Aplikacja używa roli `cgp_app`, a nie właściciela bazy. Hasło właściciela nie trafia do kontenera aplikacji. Połączenie z bazą bez TLS jest przeznaczone wyłącznie do tej prywatnej sieci w jednej maszynie wirtualnej.

Kontener aplikacji działa jako użytkownik `node`, ma system plików tylko do odczytu, usunięte dodatkowe uprawnienia i tymczasowy katalog o rozmiarze 16 MiB. Aplikacja i baza mają osobne limity CPU, pamięci, procesów i obracane logi. Wolumen bazy nadal wymaga kontroli wolnego miejsca i limitu dysku maszyny wirtualnej.

## Przygotowanie

1. Zainstaluj aktualne Docker Engine i Compose w przeznaczonej do tego maszynie wirtualnej.
2. Skopiuj `.env.production.example` do `.env.production`. Ustaw publiczny adres HTTPS, unikalny sekret sesji oraz różne hasła bazy i aplikacji. Użyj losowych ciągów co najmniej 32 znaków. Dla `APP_DB_PASSWORD` użyj cyfr i liter, np. losowego ciągu szesnastkowego, ponieważ hasło jest częścią adresu połączenia.
3. Ogranicz uprawnienia `.env.production` do administratora, np. `chmod 600 .env.production`. Nigdy nie dodawaj tego pliku do Git. Nie zapisuj wyniku `docker compose config` z sekretami do publicznych logów.
4. Sprawdź konfigurację i zbuduj obraz:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
```

Obraz instaluje pakiety z pliku blokady bez skryptów instalacyjnych. Przed wydaniem zweryfikuj pochodzenie obrazów bazowych i zapisz ich digesty. Aktualizacje obrazów i zależności wymagają ponownych testów.

## Pierwszy start i kontrola

Uruchom dopiero po ustawieniu izolacji i zapory:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:3000/api/health
```

Inicjalizacja bazy działa tylko na pustym wolumenie. Istniejącej bazy te skrypty nie zmienią. Nie kasuj wolumenu, żeby wymusić inicjalizację. Zrób kopię, a ewentualne zmiany i nadanie uprawnień wykonaj osobno jako właściciel bazy. Aplikacja z `AUTO_INIT_DATABASE=false` nie tworzy tabel ani danych demo przy starcie i zakończy pracę, jeśli brakuje tabeli użytkowników.

Sprawdź w działających kontenerach użytkownika, montowania, usunięte uprawnienia, `no-new-privileges`, limity CPU, pamięci, procesów i logów. Z innego komputera sprawdź brak dostępu do portów 3000 i 5432. Nie otwieraj ich na routerze.

Cloudflare Tunnel uruchom na tej samej maszynie wirtualnej co Docker i skieruj wyłącznie do `http://127.0.0.1:3000`. Zdalny konektor ani osobny kontener nie korzystają z tej samej pętli lokalnej. Nie używaj trybu sieci hosta ani montowania gniazda Dockera w aplikacji.

Przed udostępnieniem potwierdź przez rzeczywisty tunel, że Express widzi prawidłowy adres klienta przy `trust proxy=1`. Żądania z dwóch różnych komputerów powinny mieć osobne limity, a własny nagłówek `X-Forwarded-For` nie może pozwalać na wybór dowolnego adresu. Jeśli układ proxy tego nie zapewnia, popraw zaufanie do proxy przed publikacją.

Sprawdź też blokadę połączeń z kontenera do sieci zarządzania i pozostałego LAN. Zwykła sieć `web` daje aplikacji dostęp wychodzący i nie jest zaporą dla LAN. Cloudflare nie zastępuje tej zapory.

Przed zbieraniem prawdziwych danych wykonaj kopię bazy na osobny nośnik lub host i sprawdź odtworzenie w osobnej bazie. Wolumen Dockera nie jest samodzielną kopią zapasową.

## Testy kodu

W folderze `backend` uruchom `npm test` na Node 22 lub nowszym. Testy korzystają z lokalnych atrap bazy i poczty, bez wysyłania maili i bez połączenia z prawdziwą bazą. Sprawdzają wspólne limity dla różnych zapisów tego samego adresu, pojemność i wygasanie liczników, limit pracy nad hasłami oraz poprawne logowanie i reset hasła.
