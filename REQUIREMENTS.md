# Platforma turniejowa esportowa z integracją FACEIT API
## Wymagania biznesowe — wersja MVP (community & tournament-centered)

**Wersja:** 0.1  
**Status:** Draft  
**Główny cel:** organizacja amatorskich turniejów, rekrutacja zawodników (LFG), automatyczna weryfikacja wyników meczowych  
**Źródło bazowe danych:** FACEIT API, baza własna aplikacji

---

## 1. Cel projektu

Celem projektu jest stworzenie platformy turniejowej dedykowanej graczom amatorskim (w pierwszej kolejności scenie Counter-Strike 2), rozwiązującej dwa kluczowe problemy organizacyjne: trudność w skompletowaniu pełnego składu drużyny przed turniejem oraz czasochłonne, podatne na spory i błędy ręczne raportowanie wyników meczowych.

Platforma ma eliminować bariery wejścia poprzez maksymalne uproszczenie rejestracji (brak wymogu weryfikacji e-mail na etapie startowym), wbudowaną tablicę ogłoszeń z bezpośrednim czatem tekstowym oraz pełną automatyzację aktualizacji drabinek turniejowych na podstawie linków do pokojów meczowych w serwisie FACEIT.

Przykładowe pytanie biznesowe, na które platforma powinna odpowiadać:

> W jaki sposób kapitan niepełnej drużyny może w ciągu kilku minut znaleźć brakującego zawodnika o określonym poziomie umiejętności, zaprosić go do składu, zapisać zespół do turnieju, a po rozegranym spotkaniu zaktualizować drabinkę w czasie rzeczywistym bez udziału sędziego i bez przesyłania zrzutów ekranu?

---

## 2. Główna zasada produktu

Platforma w wersji MVP skupia się wyłącznie na **niezbędnych procesach operacyjnych i społecznościowych (lean & friction-free)**.

Oznacza to, że:

- kluczowym celem jest płynne przejście od braku drużyny do rozegrania meczu w turnieju;
- na etapie MVP świadomie rezygnuje się ze złożonych systemów rankingowych (Elo, Glicko-2) oraz zaawansowanych statystyk indywidualnych na rzecz natychmiastowej użyteczności;
- weryfikacja wyników opiera się w 100% na danych źródłowych z zewnętrznego API FACEIT;
- komunikacja między graczami odbywa się bezpośrednio na platformie w czasie rzeczywistym, bez konieczności natychmiastowego przenoszenia kontaktu na platformy zewnętrzne (np. Discord);
- rejestracja i logowanie są zoptymalizowane pod kątem minimalnego czasu potrzebnego do podjęcia akcji na platformie.

---

## 3. Główne zastosowania biznesowe

Platforma ma wspierać przede wszystkim:

1. błyskawiczne tworzenie kont użytkowników bez zbędnych barier formalnych;
2. tworzenie zespołów i sprawne dołączanie zawodników za pomocą jednorazowych lub odnawialnych kodów zaproszeń;
3. publikację ogłoszeń poszukiwania gracza / drużyny (moduł LFG) z parametrami ról i poziomu umiejętności;
4. natychmiastową komunikację bezpośrednią (czat 1-na-1) pomiędzy graczami w celu ustalenia szczegółów gry;
5. rejestrację pełnych zespołów do turniejów w zdefiniowanych formatach;
6. automatyczne generowanie i obsługę drabinki pucharowej (Single Elimination);
7. automatyczne pobieranie, walidację i zatwierdzanie wyników meczów z wykorzystaniem linku do FACEIT;
8. arbitraż administracyjny w przypadku sytuacji spornych lub błędów API.

---

## 4. Podstawowy użytkownik

Platforma definiuje trzy podstawowe role użytkowników:

1. **Gracz indywidualny (Free Agent):** osoba bez stałego zespołu, chcąca opublikować ogłoszenie, znaleźć drużynę i wziąć udział w rozgrywkach.
2. **Kapitan drużyny:** osoba zarządzająca składem, zapraszająca graczy, zgłaszająca zespół do turnieju oraz wprowadzająca linki wynikowe z platformy FACEIT.
3. **Organizator / Administrator:** osoba zarządzająca turniejami, konfigurująca parametry drabinek oraz rozstrzygająca sytuacje sporne.

Użytkownik powinien móc bez wiedzy technicznej:
- założyć konto w kilka sekund;
- znaleźć interesujące ogłoszenie lub drużynę za pomocą filtrów;
- napisać na czacie do innego gracza bez przeładowywania strony;
- dołączyć do drużyny kodem lub zapisać swoją drużynę do otwartego turnieju;
- wprowadzić wynik meczu wyłącznie poprzez wklejenie linku URL.

---

## 5. Główne obiekty biznesowe

Platforma powinna operować co najmniej na następujących obiektach domenowych:

- **Użytkownik (User):** profil zawodnika w systemie, powiązany z tożsamością FACEIT;
- **Drużyna (Team):** jednostka rywalizująca w turnieju, posiadająca kapitana, skład główny i rezerwowy;
- **Członkostwo w drużynie (TeamMember):** relacja przypisania użytkownika do zespołu wraz z określeniem roli (podstawa / rezerwa);
- **Ogłoszenie LFG (Advertisement):** wpis rekrutacyjny gracza lub zespołu;
- **Rozmowa i Wiadomość (Conversation / Message):** wątek komunikacyjny czasu rzeczywistego pomiędzy użytkownikami;
- **Turniej (Tournament):** instancja rozgrywek z określonym limitem miejsc, harmonogramem i statusem;
- **Mecz turniejowy (Match):** para rywalizujących drużyn w danym etapie drabinki wraz z wynikiem i statusem weryfikacji.

---

## 6. Użytkownicy, konta i profile

### BR-001 — Uproszczona rejestracja konta
Rejestracja użytkownika w systemie wymaga wyłącznie unikalnego identyfikatora (nick) oraz hasła wraz z jego potwierdzeniem. System nie wymaga podawania adresu e-mail ani przejścia procedury weryfikacyjnej na etapie startowym.

### BR-002 — Bezpieczeństwo poświadczeń
Hasła użytkowników muszą być bezwzględnie haszowane przy użyciu bezpiecznych algorytmów kryptograficznych (np. BCrypt) przed zapisem w bazie danych. Wersja jawna hasła nigdy nie może być utrwalana ani logowana.

### BR-003 — Uwierzytelnianie sesyjne i tokeny
Po poprawnym uwierzytelnieniu użytkownik otrzymuje token sesyjny (np. JWT), umożliwiający identyfikację zapytań bez konieczności ponownego logowania przy każdym żądaniu.

### BR-004 — Ochrona przed atakami brute-force
Mechanizm logowania musi posiadać limit nieudanych prób logowania w określonym oknie czasowym per adres IP / login.

### BR-005 — Procedura odzyskiwania dostępu
Z uwagi na brak adresu e-mail, odzyskiwanie dostępu do konta musi być realizowane za pomocą:
- jednorazowego kodu ratunkowego wygenerowanego podczas rejestracji, lub
- ręcznego resetu poświadczeń przez administratora systemu.

### BR-006 — Dane profilowe gracza
Profil użytkownika powinien umożliwiać zdefiniowanie:
- nazwy użytkownika w systemie,
- identyfikatora / nicku na platformie FACEIT,
- poziomu FACEIT (1–10),
- preferowanej roli w grze (np. entry, support, AWP, IGL, uniwersalna),
- przedziałów czasowych aktywności (dostępności do gry),
- krótkiego opisu (bio),
- aktualnej przynależności drużynowej oraz historii udziału w turniejach.

---

## 7. Zarządzanie drużynami i zaproszeniami

### BR-007 — Zakładanie drużyny
Każdy zarejestrowany użytkownik ma prawo utworzyć drużynę, podając jej unikalną nazwę oraz skrót (tag o długości 3–4 znaków). Twórca drużyny automatycznie otrzymuje uprawnienia Kapitana.

### BR-008 — Dołączanie przez kod zaproszenia
Dołączenie do zespołu odbywa się za pośrednictwem unikalnego, alfanumerycznego kodu lub bezpośredniego linku zaproszeniowego generowanego przez Kapitana. Wpisanie ważnego kodu natychmiast przypisuje gracza do składu drużyny.

### BR-009 — Zarządzanie kodem dostępu
Kapitan ma możliwość unieważnienia aktualnego kodu zaproszenia i wygenerowania nowego w przypadku nieuprawnionego wycieku poprzedniego identyfikatora.

### BR-010 — Uprawnienia kapitana
Wyłącznie Kapitan zespołu posiada uprawnienia do:
- edycji danych drużyny,
- usuwania członków zespołu,
- przekazania roli Kapitana innemu członkowi drużyny,
- otwierania i zamykania naboru do zespołu,
- dokonywania zapisów drużyny na turnieje,
- wprowadzania linków do raportowania wyników meczowych.

### BR-011 — Ograniczenia liczbowe składu
Drużyna turniejowa składa się z 5 graczy składu podstawowego oraz maksymalnie 2 graczy rezerwowych.

### BR-012 — Wyłączność reprezentacji w turnieju
Dany zawodnik może w ramach jednego turnieju reprezentować wyłącznie jedną drużynę. System musi blokować próby równoległego zgłoszenia tego samego gracza w wielu składach.

---

## 8. Moduł szukania graczy (LFG)

### BR-013 — Typy ogłoszeń rekrutacyjnych
Platforma udostępnia dwa warianty wpisów w module LFG:
1. **Gracz szuka drużyny (LFC — Looking for Clan)**,
2. **Drużyna szuka gracza (LFM — Looking for Member)**.

### BR-014 — Parametryzacja ogłoszenia
Wpis ogłoszeniowy musi zawierać co najmniej:
- tytuł gry (domyślnie CS2),
- poziom umiejętności / rangę (poziom FACEIT 1–10),
- preferowaną rolę taktyczną,
- dyspozycyjność czasową (np. wieczory, weekendy, określone dni tygodnia),
- preferowany język komunikacji,
- treść wiadomości / opis.

### BR-015 — Filtrowanie tablicy ogłoszeń
System musi zapewniać możliwość zawężania listy ogłoszeń na podstawie roli, deklarowanego poziomu umiejętności oraz pory rozgrywek.

### BR-016 — Cykl życia ogłoszenia
Ogłoszenie pozostaje aktywne przez maksymalnie 7 dni od momentu publikacji, po czym wygasa i zostaje ukryte. Autor ma możliwość odświeżenia ważności ogłoszenia jednym kliknięciem lub jego natychmiastowego zamknięcia po skompletowaniu składu.

### BR-017 — Konwersja ogłoszenia do kontaktu
Każda karta ogłoszenia musi zawierać bezpośredni punkt styku w postaci przycisku wywołującego okno bezpośredniego czatu z autorem ogłoszenia.

---

## 9. Komunikacja w czasie rzeczywistym (Czat)

### BR-018 — Kanał bezpośredni 1-na-1
System udostępnia moduł wymiany wiadomości tekstowych pomiędzy dwoma użytkownikami, dostępny z poziomu ogłoszenia LFG lub widoku profilu gracza.

### BR-019 — Dostarczanie wiadomości w czasie rzeczywistym
Komunikacja musi opierać się na protokole zapewniającym ciągłe połączenie dwukierunkowe (WebSockets), gwarantując dostarczanie wiadomości bez konieczności odświeżania strony przez odbiorcę.

### BR-020 — Trwałość historii konwersacji
Wszystkie wiadomości podlegają trwałemu zapisowi w relacyjnej bazie danych. Historia rozmowy musi być dostępna po ponownym załadowaniu aplikacji lub ponownym logowaniu.

### BR-021 — Stany przeczytania i powiadomienia
Interfejs listy rozmów musi prezentować statusy nieprzeczytanych wiadomości dla każdego aktywnego wątku.

### BR-022 — Moderacja i bezpieczeństwo użytkownika
Każdy uczestnik rozmowy musi mieć możliwość zablokowania otrzymywania wiadomości od wskazanego użytkownika oraz zgłoszenia naruszenia regulaminu do administratora platformy.

---

## 10. Organizacja turniejów i drabinka

### BR-023 — Parametryzacja turnieju
Administrator tworzy turniej, określając:
- nazwę rozgrywek,
- dyscyplinę (CS2),
- datę i godzinę startu,
- maksymalną liczbę slotów (np. 8 lub 16 drużyn),
- format rozgrywania meczów (Best-of-1 lub Best-of-3),
- opcjonalny regulamin rozgrywek (zasady wyboru map, walkowery, czasy oczekiwania).

### BR-024 — Walidacja zapisu drużyny
Próba zapisu drużyny do turnieju przez Kapitana podlega walidacji systemowej:
- czy drużyna posiada wymaganą regulaminowo liczbę aktywnych graczy (minimum 5),
- czy żaden z graczy nie jest już zarejestrowany w innym zespole w ramach tego samego turnieju,
- czy limit dostępnych miejsc w turnieju nie został wyczerpany.

### BR-025 — Generowanie drabinki turniejowej
Po zamknięciu etapu rejestracji system dokonuje losowania par turniejowych i generuje strukturę drabinki w formacie pojedynczej eliminacji (Single Elimination).

### BR-026 — Wolny los (BYE)
W sytuacji, gdy liczba zapisanych zespołów jest mniejsza niż rozmiar drabinki wynikający z potęgi dwójki, wybrane losowo drużyny otrzymują tzw. wolny los i są automatycznie kwalifikowane do kolejnej rundy.

### BR-027 — Stany meczu turniejowego
Każdy węzeł drabinki przyjmuje jeden z dopuszczalnych stanów cyklu życia:
- `Zaplanowany` (oczekuje na wyłonienie rywali),
- `Gotowy do rozegrania` (obie drużyny są znane),
- `Oczekiwanie na wynik` (mecz w toku),
- `Zakończony` (wynik poprawnie zatwierdzony, awans przyznany),
- `Sporny` (wstrzymany, wymaga weryfikacji sędziowskiej).

---

## 11. Integracja z FACEIT API i raportowanie wyników

### BR-028 — Model bezobsługowego wprowadzania wyniku
System eliminuje ręczne wprowadzanie punktacji przez graczy oraz konieczność dołączania zrzutów ekranu. Podstawą raportowania wyniku jest wyłącznie poprawny adres URL do pokoju meczowego na platformie FACEIT (`match_id`).

### BR-029 — Ekstrakcja identyfikatora meczu
System automatycznie weryfikuje strukturę wklejonego adresu URL i wyodrębnia z niego unikalny identyfikator meczu FACEIT. Wprowadzenie błędnego formatu skutkuje natychmiastowym komunikatem walidacyjnym.

### BR-030 — Zapytanie do FACEIT API
Backend aplikacji wykonuje autoryzowane zapytanie do oficjalnego interfejsu programistycznego FACEIT API w celu pobrania metadanych i stanu wskazanego meczu.

### BR-031 — Weryfikacja zakończenia meczu
Jeżeli status meczu w API FACEIT wskazuje, że rozgrywka jest w toku, platforma wstrzymuje operację i informuje użytkownika o konieczności ponowienia próby po faktycznym zakończeniu spotkania na serwerze gry.

### BR-032 — Weryfikacja tożsamości uczestników (anty-spoofing)
Przed zatwierdzeniem rezultatu system bezwzględnie weryfikuje, czy identyfikatory graczy biorących udział w meczu na FACEIT odpowiadają profilom graczy zgłoszonych w obu rywalizujących zespołach turniejowych. W przypadku braku zgodności mecz nie zostaje rozliczony.

### BR-033 — Jednokrotność użycia meczu zewnętrznego
Dany identyfikator meczu FACEIT może zostać przypisany wyłącznie do jednego meczu turniejowego w bazie platformy. Próba ponownego użycia tego samego linku zostaje zablokowana.

### BR-034 — Aktualizacja węzła drabinki
Po pomyślnej weryfikacji danych z API system automatycznie:
- wprowadza oficjalną punktację rund (np. 13:10),
- oznacza mecz jako zakończony,
- promuje zwycięski zespół do właściwego węzła w kolejnej rundzie drabinki.

### BR-035 — Procedura awaryjna (Manual Override)
W przypadku niedostępności API FACEIT, limitów zapytaniowych (rate limiting) lub błędów uniemożliwiających automatyczne rozliczenie, Administrator posiada dedykowany interfejs umożliwiający ręczne wprowadzenie wyniku i wymuszenie awansu drużyny.

---

## 12. Przykładowe scenariusze użytkownika (Use Cases)

### UC-001 — Szybka rejestracja i skompletowanie profilu
> Gracz wchodzi na stronę, podaje nick oraz hasło. Po 3 sekundach posiada aktywne konto i w ustawieniach profilu podaje swój identyfikator FACEIT oraz preferowaną rolę "Support".

### UC-002 — Rekrutacja brakującego gracza przez tablicę LFG
> Kapitan czteroosobowej drużyny publikuje ogłoszenie o poszukiwaniu gracza na pozycję "Entry Fragger" z poziomem FACEIT 6+. Przegląda tablicę ogłoszeń, odnajduje zgłoszenie pasującego gracza i klika przycisk „Napisz”.

### UC-003 — Uzgodnienie składu i dołączenie kodem
> Kapitan oraz gracz prowadzą bezpośrednią rozmowę na czacie bez przeładowywania widoku. Kapitan przekazuje w wiadomości wygenerowany 6-znakowy kod zaproszeniowy. Gracz wpisuje kod w panelu drużyn i natychmiast staje się pełnoprawnym członkiem składu.

### UC-004 — Zapis i generowanie drabinki turniejowej
> Kapitan zgłasza skompletowaną drużynę do nadchodzącego turnieju 8-zespołowego. Po upływie czasu na zapisy system automatycznie zamyka listę chętnych, losuje pary ćwierćfinałowe i renderuje interaktywną drabinkę.

### UC-005 — Rozegranie meczu i automatyczne zatwierdzenie wyniku
> Po wygraniu spotkania na serwerze FACEIT Kapitan zwycięskiej drużyny wkleja adres URL pokoju meczowego do panelu meczu turniejowego. System weryfikuje obecność graczy obu ekip, pobiera rezultat 13:8 i automatycznie przesuwa drużynę do półfinału.

---

## 13. Wymagania dotyczące bazy danych i trwałości danych

Model danych na poziomie MVP musi obejmować następujące relacje:

- **Users:** unikalny identyfikator, nick, skrót hasła (hash), nick FACEIT, poziom FACEIT, preferowana rola, opis profilu, data rejestracji;
- **Teams:** unikalny identyfikator, pełna nazwa, tag (skrót), relacja do kapitana (User_ID), kod zaproszenia, status rekrutacji (otwarta/zamknięta);
- **TeamMembers:** relacja wiążąca Użytkownika z Drużyną, flaga statusu (podstawowy / rezerwowy), data dołączenia;
- **Advertisements:** relacja do autora (User lub Team), typ ogłoszenia, dyscyplina, wymagany/posiadany poziom, rola, ramy czasowe dostępności, data wygaśnięcia;
- **Conversations & Messages:** relacje identyfikujące uczestników konwersacji, poszczególne wiadomości wraz ze znacznikiem czasu, treścią i flagą stanu odczytania;
- **Tournaments:** unikalny identyfikator, nazwa, gra, limit drużyn, format (BO1/BO3), status rejestracji, data rozpoczęcia;
- **Matches:** relacja do turnieju i rundy, odnośniki do rywalizujących drużyn, przypisany identyfikator meczu FACEIT, wynik punktowy, status meczu.

---

## 14. Reguły biznesowe

### RB-001
Użytkownik bez zweryfikowanego (przypisanego) identyfikatora FACEIT nie może zostać dodany do aktywnego składu turniejowego.

### RB-002
Kod zaproszenia do drużyny jest bezterminowy do momentu jego unieważnienia (zresetowania) przez Kapitana zespołu lub skasowania drużyny.

### RB-003
W turnieju pucharowym mecz zakończony remisem nie może zostać zakwalifikowany jako poprawny; system wymaga rozstrzygnięcia dogrywkowego (zgodnie z logiką meczu FACEIT).

### RB-004
W przypadku wykrycia rozbieżności pomiędzy składem zarejestrowanym na platformie a graczami figurującymi w podsumowaniu meczu FACEIT, system nadaje meczowi status `Sporny` i blokuje dalszy postęp danej gałęzi drabinki.

### RB-005
Zgłoszenie zespołu do turnieju staje się wiążące i blokuje możliwość opuszczenia drużyny przez któregokolwiek z 5 podstawowych graczy na czas trwania rozgrywek.

---

## 15. Zakres MVP

W pierwszej wersji produktu priorytetem jest dostarczenie funkcjonalności:

1. rejestracji i logowania opartego wyłącznie o nick i hasło (brak weryfikacji mailowej);
2. zarządzania profilem gracza z parametrami esportowymi (FACEIT nick/level, rola);
3. tworzenia drużyn i rekrutacji członków za pomocą kodów zaproszeń;
4. tablicy ogłoszeń LFG z możliwością filtrowania;
5. komunikatora 1-na-1 w czasie rzeczywistym z obsługą historii;
6. panelu administracyjnego do tworzenia turniejów w formule Single Elimination;
7. automatycznego losowania i rysowania drabinki pucharowej;
8. modułu pobierania i walidacji wyników bezpośrednio z API FACEIT;
9. awaryjnego wprowadzania wyników przez administratora.

---

## 16. Poza zakresem pierwszego MVP

Na pierwszym etapie poza zakresem implementacyjnym bezwzględnie pozostają:

- własne algorytmy rankingowe graczy i drużyn (systemy Elo, Glicko-2);
- szczegółowa analityka statystyczna pobierana z meczów (K/D ratio, % headshotów, heatmapy);
- system odznaczeń, osiągnięć i trofeów profilowych;
- podział rozgrywek na regularne sezony ligowe i tabele punktowe;
- obsługa dodatkowych dyscyplin esportowych poza Counter-Strike 2;
- zaawansowane formaty turniejowe (faza grupowa, drabinka podwójnej eliminacji — Double Elimination, system szwajcarski);
- zautomatyzowane powiadomienia e-mail, SMS oraz integracje z botami platformy Discord;
- integracja logowania federacyjnego (OAuth2) poprzez Steam lub FACEIT;
- systemy płatności i obsługi nagród pieniężnych.

---

## 17. Kryteria akceptacji MVP

### AC-001
Nowy użytkownik jest w stanie założyć konto i zalogować się do systemu w czasie poniżej 15 sekund, bez konieczności odbierania korespondencji elektronicznej.

### AC-002
Kapitan zespołu może wygenerować kod, a inny użytkownik po jego wprowadzeniu natychmiast pojawia się na liście składu drużyny.

### AC-003
Użytkownik bez drużyny może opublikować ogłoszenie LFG, a inny użytkownik może z poziomu tego ogłoszenia zainicjować sesję czatu na żywo.

### AC-004
Wiadomość wysłana w oknie czatu pojawia się u odbiorcy natychmiastowo, bez konieczności manualnego odświeżania widoku przeglądarki.

### AC-005
Zapis do turnieju 8-zespołowego blokuje się automatycznie po zarejestrowaniu 8. uprawnionej drużyny lub po przekroczeniu ustalonego czasu granicznego.

### AC-006
Po zamknięciu zapisów system generuje kompletną, czytelną drabinkę pucharową dla wszystkich zarejestrowanych uczestników.

### AC-007
Po wklejeniu prawidłowego linku do zakończonego meczu FACEIT, system weryfikuje graczy, zapisuje wynik i w czasie poniżej 5 sekund promuje zwycięzcę do kolejnej rundy.

### AC-008
Próba wklejenia linku do meczu z nieprawidłowymi graczami, meczu w toku lub linku niebędącego adresem FACEIT skutkuje jednoznacznym komunikatem błędu i nie modyfikuje stanu turnieju.

### AC-009
Administrator platformy posiada uprawnienie do manualnego nadpisania wyniku dowolnego meczu w stanie spornym z poziomu panelu zarządzania.

---

## 18. Analiza ryzyk i środki zaradcze

| Ryzyko / Zagrożenie | Wpływ biznesowy | Planowane rozwiązanie zaradcze |
| :--- | :--- | :--- |
| **Masowe tworzenie multikont** | Zaśmiecanie bazy, manipulacje w zapisach | Wprowadzenie limitów rejestracji na adres IP oraz wymóg unikalności przypisanego konta FACEIT per profil. |
| **Toksyczność i spam na czacie** | Pogorszenie doświadczenia użytkowników | Mechanizm blokowania niechcianych rozmówców oraz opcja zgłaszania profilu bezpośrednio do moderacji. |
| **Zmiana nazwy gracza na FACEIT** | Niespójność podczas weryfikacji meczu | Identyfikacja użytkowników po stałym, niezmiennym identyfikatorze `player_id` w API FACEIT, a nie zmiennym nicku. |
| **Limity zapytań (Rate Limiting) API FACEIT** | Opóźnienia w zatwierdzaniu wyników | Kolejkowanie zapytań po stronie backendu, buforowanie odpowiedzi oraz obecność procedury manualnego wpisania wyniku. |
| **Rozgrywki poza platformą FACEIT** | Brak możliwości automatycznego pobrania wyniku | Umożliwienie sędziemu/administratorowi manualnego rozstrzygnięcia meczu w trybie arbitrażowym. |

---

## 19. Definicja sukcesu projektu (DoD)

Projekt MVP osiąga swój cel, jeżeli 8 niezależnych drużyn jest w stanie:
1. Zarejestrować się i uzupełnić profile graczy;
2. Skompletować składy za pomocą kodów zaproszeń oraz modułu LFG z wbudowanym czatem;
3. Zapisać się do zorganizowanego turnieju;
4. Rozegrać wszystkie etapy turnieju od ćwierćfinałów do finału, gdzie każdy wynik meczu zostaje pobrany i zatwierdzony w drabince w sposób w pełni zautomatyzowany na podstawie linku z FACEIT bez ingerencji administratora.